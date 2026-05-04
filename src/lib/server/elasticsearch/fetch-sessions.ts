import { V2_ORIGIN_FILTER, CHUNK_DURATION_MS, CHUNK_CONCURRENCY, BATCH_SIZE, BATCH_CONCURRENCY, MAX_SESSIONS } from '$common/constants';
import { queryESWithPagination, type ESHit } from './client';

interface TimeChunk {
	start: string;
	end: string;
}

function splitTimeRange(from: Date, to: Date): TimeChunk[] {
	const chunks: TimeChunk[] = [];
	let current = from.getTime();
	const end = to.getTime();

	while (current < end) {
		const chunkEnd = Math.min(current + CHUNK_DURATION_MS, end);
		chunks.push({
			start: new Date(current).toISOString(),
			end: new Date(chunkEnd).toISOString()
		});
		current = chunkEnd;
	}

	return chunks;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

async function parallelLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
	const results: T[] = [];
	let index = 0;

	async function runNext(): Promise<void> {
		while (index < tasks.length) {
			const currentIndex = index++;
			try {
				results[currentIndex] = await tasks[currentIndex]();
			} catch (e) {
				console.error(`Task ${currentIndex} failed:`, e);
				results[currentIndex] = [] as unknown as T;
			}
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext());
	await Promise.all(workers);
	return results;
}

/**
 * Extract unique session IDs from raw ES hits.
 * Nimble format: serialNumber:|timestamp|sessionId|nimbleSessionId|NIMBLE|shop|...
 * Vayu format: serialNumber|sessionId|requestId|shop|...
 */
function extractSessionIds(hits: ESHit[]): Set<string> {
	const sessionIds = new Set<string>();

	for (const hit of hits) {
		const msg = hit._source.message;
		if (!msg) continue;

		const pipeFields = msg.split('|');

		// Nimble format: 11+ fields, sessionId at index 2
		if (pipeFields.length >= 11) {
			const sessionId = pipeFields[2]?.trim();
			if (sessionId && sessionId.length > 5 && sessionId.length < 50) {
				sessionIds.add(sessionId);
			}
			continue;
		}

		// Vayu format: 10+ fields, sessionId at index 1
		if (pipeFields.length >= 10) {
			const sessionId = pipeFields[1]?.trim();
			if (sessionId && sessionId.length > 5 && sessionId.length < 50) {
				sessionIds.add(sessionId);
			}
		}
	}

	return sessionIds;
}

/**
 * Step 1: Discovery - fetch logs with v2 origin filter, extract session IDs
 */
async function discoverSessionIds(cookie: string, chunk: TimeChunk): Promise<Set<string>> {
	const hits = await queryESWithPagination(cookie, {
		filter: [
			{ range: { 'timestamp': { gte: chunk.start, lte: chunk.end } } },
			{ match_phrase: { message: V2_ORIGIN_FILTER } }
		]
	});

	return extractSessionIds(hits);
}

/**
 * Step 2: Fetch all logs for a batch of session IDs
 */
async function fetchSessionLogs(cookie: string, sessionIds: string[], chunk: TimeChunk): Promise<ESHit[]> {
	if (sessionIds.length === 0) return [];

	return queryESWithPagination(cookie, {
		filter: [
			{ range: { 'timestamp': { gte: chunk.start, lte: chunk.end } } }
		],
		must: {
			bool: {
				should: sessionIds.map(id => ({ match_phrase: { message: id } })),
				minimum_should_match: 1
			}
		}
	});
}

/**
 * Process a single time chunk: discover sessions, then fetch their full logs
 */
async function processChunk(cookie: string, chunk: TimeChunk): Promise<ESHit[]> {
	// Step 1: Discovery
	const sessionIds = await discoverSessionIds(cookie, chunk);

	if (sessionIds.size === 0) return [];

	// Cap session IDs per chunk to avoid explosion
	const sessionArray = Array.from(sessionIds).slice(0, MAX_SESSIONS);

	// Step 2: Fetch full logs for all sessions (batched + parallel)
	const batches = chunkArray(sessionArray, BATCH_SIZE);
	const batchTasks = batches.map(batch => () => fetchSessionLogs(cookie, batch, chunk));

	const batchResults = await parallelLimit(batchTasks, BATCH_CONCURRENCY);
	return batchResults.flat();
}

/**
 * Main entry: fetch all session logs for the given time range
 */
export async function fetchAllSessionLogs(
	cookie: string,
	from: Date,
	to: Date
): Promise<ESHit[]> {
	const chunks = splitTimeRange(from, to);

	// Process chunks in parallel with concurrency limit
	const chunkTasks = chunks.map(chunk => () => processChunk(cookie, chunk));
	const chunkResults = await parallelLimit(chunkTasks, CHUNK_CONCURRENCY);

	// Deduplicate by _id
	const seen = new Set<string>();
	const deduped: ESHit[] = [];
	for (const hits of chunkResults) {
		for (const hit of hits) {
			if (!seen.has(hit._id)) {
				seen.add(hit._id);
				deduped.push(hit);
			}
		}
	}

	return deduped;
}

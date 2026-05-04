import type { ParsedLog, AnalyticsEvent, InfoType, Context } from '$common/types';
import type { ESHit } from '$server/elasticsearch/client';

const VALID_EVENTS: Set<string> = new Set([
	'NetworkCallRequest', 'NetworkCallResponse', 'PageRendered', 'Click',
	'Input', 'Hover', 'Focus', 'Error', 'Exception', 'FunctionCalled',
	'FunctionCallResult', 'RequestReceived', 'ResponseReturned',
	'SectionRendered', 'Navigation', 'DBQueryRequest', 'DBQueryResult',
	'ExternalAPICallRequest', 'ExternalAPICallResponse',
	'Info', 'Debug'
]);

const VALID_INFO_TYPES: Set<string> = new Set([
	'Info', 'Debug', 'Error', 'Critical', 'Warning', 'Exception'
]);

const VALID_CONTEXTS: Set<string> = new Set([
	'App', 'Server', 'Backend', 'Frontend'
]);

function safeJsonParse(str: string): Record<string, unknown> | null {
	try {
		const trimmed = str.trim();
		if (!trimmed || trimmed === '{}' || trimmed === 'null') return null;
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

function extractSourceAndValue(raw: string): { source: string; value: Record<string, unknown> | null } {
	let source = raw;
	let value: Record<string, unknown> | null = null;

	const jsonStart = raw.indexOf('{');
	if (jsonStart > 0) {
		source = raw.substring(0, jsonStart).trim();
		if (source.endsWith(':')) source = source.slice(0, -1);
		const jsonStr = raw.substring(jsonStart);
		value = safeJsonParse(jsonStr);
	} else if (jsonStart === 0) {
		source = '';
		value = safeJsonParse(raw);
	}

	return { source, value };
}

/**
 * Both Nimble and Vayu logs have 11 pipe-delimited fields but with different layouts.
 *
 * Nimble (field[4] = "NIMBLE"):
 *   0: serialNumber:  | 1: timestamp | 2: sessionId | 3: nimbleSessionId | 4: NIMBLE | 5: shop | 6: checkoutId | 7: context | 8: infoType | 9: event | 10: source:{json}
 *
 * Vayu (field[4] = empty or pod_name):
 *   0: serialNumber | 1: sessionId | 2: requestId | 3: shop | 4: (empty) | 5: host/pod | 6: context | 7: infoType | 8: event | 9: source | 10: {json}
 */
function parsePipeLog(message: string, esTimestamp: string): ParsedLog | null {
	const parts = message.split('|');
	if (parts.length < 11) return null;

	const isNimble = parts[4]?.trim() === 'NIMBLE';

	let serialNumber: number;
	let timestamp: string;
	let sessionId: string;
	let host: string;
	let shop: string;
	let checkoutId: string;
	let context: string;
	let infoType: string;
	let event: string;
	let sourceRaw: string;

	if (isNimble) {
		serialNumber = parseInt(parts[0].trim()) || 0;
		timestamp = parts[1]?.trim() || esTimestamp;
		sessionId = parts[2]?.trim();
		host = 'NIMBLE';
		shop = parts[5]?.trim();
		checkoutId = parts[6]?.trim();
		context = parts[7]?.trim();
		infoType = parts[8]?.trim();
		event = parts[9]?.trim();
		sourceRaw = parts.slice(10).join('|').trim();
	} else {
		// Vayu format
		serialNumber = parseInt(parts[0]?.trim()) || 0;
		sessionId = parts[1]?.trim();
		// parts[2] = requestId (skip)
		shop = parts[3]?.trim();
		host = parts[5]?.trim();
		checkoutId = ''; // Vayu doesn't have checkoutId in fixed position
		context = parts[6]?.trim();
		infoType = parts[7]?.trim();
		event = parts[8]?.trim();
		sourceRaw = parts.slice(9).join('|').trim();
		timestamp = esTimestamp;
	}

	if (!sessionId || sessionId.length < 5) return null;
	if (!VALID_EVENTS.has(event)) return null;

	const { source, value } = extractSourceAndValue(sourceRaw);

	return {
		serialNumber,
		timestamp,
		sessionId,
		host: host || '',
		shop: shop || '',
		checkoutId: checkoutId || '',
		context: (VALID_CONTEXTS.has(context) ? context : isNimble ? 'App' : 'Backend') as Context,
		infoType: (VALID_INFO_TYPES.has(infoType) ? infoType : 'Info') as InfoType,
		event: event as AnalyticsEvent,
		source,
		value,
		rawTimestamp: esTimestamp
	};
}

/**
 * Check if an ES hit is from Nimble analytics.
 * Uses service field first, then falls back to pod_name.
 */
function isNimbleService(hit: ESHit): boolean {
	const service = hit._source.service;
	if (typeof service === 'string' && service.toLowerCase().startsWith('nimble')) return true;
	const podName = hit._source.pod_name;
	if (typeof podName === 'string' && podName.includes('analytics')) return true;
	// Also check if the pipe-delimited message has NIMBLE in field[4]
	const message = hit._source.message;
	if (message) {
		const parts = message.split('|');
		if (parts.length >= 11 && parts[4]?.trim() === 'NIMBLE') return true;
	}
	return false;
}

/**
 * Parse a single ES hit into a structured log.
 * Only processes pipe-delimited Nimble analytics logs.
 * Skips structured JSON logs and non-Nimble services.
 */
export function parseESHit(hit: ESHit): ParsedLog | null {
	const message = hit._source.message;
	if (!message) return null;

	// Skip structured JSON logs (not pipe-delimited analytics)
	if (message.startsWith('{')) return null;

	// Only process Nimble service logs
	if (!isNimbleService(hit)) return null;

	const esTimestamp = hit._source.timestamp || hit._source['@timestamp'] || '';
	return parsePipeLog(message, esTimestamp);
}

/**
 * Parse all ES hits, filtering out unparseable logs
 */
export function parseAllHits(hits: ESHit[]): ParsedLog[] {
	const results: ParsedLog[] = [];
	for (const hit of hits) {
		const parsed = parseESHit(hit);
		if (parsed) {
			results.push(parsed);
		}
	}
	return results;
}

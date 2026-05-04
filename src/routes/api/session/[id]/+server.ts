import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryESWithPagination } from '$server/elasticsearch/client';
import { parseAllHits } from '$server/parser';
import { computeSessionMetrics } from '$server/session/metrics';

export const POST: RequestHandler = async ({ request, params }) => {
	const { id } = params;
	const body = await request.json();
	const { cookie, from, to } = body as { cookie: string; from: string; to: string };

	if (!cookie || !from || !to || !id) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	try {
		const hits = await queryESWithPagination(cookie, {
			filter: [
				{ range: { 'timestamp': { gte: from, lte: to } } }
			],
			must: { match_phrase: { message: id } }
		});

		const parsed = parseAllHits(hits);
		const sessionLogs = parsed.filter(l => l.sessionId === id);
		const metrics = computeSessionMetrics(id, sessionLogs);

		return json({
			metrics,
			logs: sessionLogs.sort((a, b) => a.serialNumber - b.serialNumber)
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};

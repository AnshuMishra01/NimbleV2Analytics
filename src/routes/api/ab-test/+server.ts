import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchSessionLogsForVersion } from '$server/elasticsearch/fetch-sessions';
import { parseAllHits } from '$server/parser';
import { computeAllMetrics } from '$server/session/metrics';
import { aggregateDashboard } from '$server/dashboard/aggregate';
import type { ABTestResponse } from '$common/types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { cookie, shopId } = body as { cookie: string; shopId?: string };

	if (!cookie) {
		return json({ error: 'Missing cookie' }, { status: 400 });
	}

	const to = body.to ? new Date(body.to) : new Date();
	const from = body.from ? new Date(body.from) : new Date(to.getTime() - 60 * 60 * 1000);
	const timeRange = { from: from.toISOString(), to: to.toISOString() };

	try {
		// Fetch v1 and v2 in parallel
		const [v1Hits, v2Hits] = await Promise.all([
			fetchSessionLogsForVersion(cookie, from, to, 'v1'),
			fetchSessionLogsForVersion(cookie, from, to, 'v2')
		]);

		// Process both through the same pipeline
		let v1Parsed = parseAllHits(v1Hits);
		let v2Parsed = parseAllHits(v2Hits);

		let v1Metrics = computeAllMetrics(v1Parsed);
		let v2Metrics = computeAllMetrics(v2Parsed);

		// Filter by shop if provided
		if (shopId) {
			const shopLower = shopId.toLowerCase();
			v1Metrics = v1Metrics.filter(s => s.shop.toLowerCase().includes(shopLower));
			v2Metrics = v2Metrics.filter(s => s.shop.toLowerCase().includes(shopLower));

			const v1SessionIds = new Set(v1Metrics.map(s => s.sessionId));
			const v2SessionIds = new Set(v2Metrics.map(s => s.sessionId));
			v1Parsed = v1Parsed.filter(l => v1SessionIds.has(l.sessionId));
			v2Parsed = v2Parsed.filter(l => v2SessionIds.has(l.sessionId));
		}

		const result: ABTestResponse = {
			v1: aggregateDashboard(v1Metrics, v1Parsed, timeRange),
			v2: aggregateDashboard(v2Metrics, v2Parsed, timeRange)
		};

		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};

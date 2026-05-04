import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchAllSessionLogs } from '$server/elasticsearch/fetch-sessions';
import { parseAllHits } from '$server/parser';
import { computeAllMetrics } from '$server/session/metrics';
import { aggregateDashboard } from '$server/dashboard/aggregate';
import { getCached, setCache } from '$server/cache';
import type { DashboardResponse } from '$common/types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { cookie, from, to } = body as { cookie: string; from: string; to: string };

	if (!cookie || !from || !to) {
		return json({ error: 'Missing required fields: cookie, from, to' }, { status: 400 });
	}

	const cacheKey = `dashboard:${from}:${to}`;
	const cached = getCached<DashboardResponse>(cacheKey);
	if (cached) {
		return json(cached);
	}

	try {
		const fromDate = new Date(from);
		const toDate = new Date(to);

		if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
			return json({ error: 'Invalid date format' }, { status: 400 });
		}

		// Pipeline: fetch → parse → compute metrics → aggregate
		const hits = await fetchAllSessionLogs(cookie, fromDate, toDate);
		const parsed = parseAllHits(hits);
		const sessionMetrics = computeAllMetrics(parsed);
		const dashboard = aggregateDashboard(sessionMetrics, parsed, { from, to });

		setCache(cacheKey, dashboard);
		return json(dashboard);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('Dashboard API error:', message);
		return json({ error: message }, { status: 500 });
	}
};

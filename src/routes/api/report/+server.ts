import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchAllSessionLogs } from '$server/elasticsearch/fetch-sessions';
import { parseAllHits } from '$server/parser';
import { computeAllMetrics } from '$server/session/metrics';
import { aggregateDashboard } from '$server/dashboard/aggregate';
import { sendReport } from '$server/email/report';

/**
 * POST /api/report — Trigger a report manually.
 * Body: { cookie, from?, to?, email? }
 * If from/to not provided, defaults to last 1 hour.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { cookie } = body as { cookie: string };

	if (!cookie) {
		return json({ error: 'Missing cookie' }, { status: 400 });
	}

	const to = body.to ? new Date(body.to) : new Date();
	const from = body.from ? new Date(body.from) : new Date(to.getTime() - 60 * 60 * 1000);
	const timeLabel = `${from.toISOString().slice(0, 16)} to ${to.toISOString().slice(0, 16)} UTC`;

	try {
		const hits = await fetchAllSessionLogs(cookie, from, to);
		const parsed = parseAllHits(hits);
		const sessionMetrics = computeAllMetrics(parsed);
		const dashboard = aggregateDashboard(sessionMetrics, parsed, {
			from: from.toISOString(),
			to: to.toISOString()
		});

		await sendReport(dashboard, timeLabel);

		return json({
			success: true,
			message: `Report sent for ${dashboard.sessionCount} sessions`,
			summary: {
				sessions: dashboard.sessionCount,
				errorRate: dashboard.overview.errorRate.toFixed(1) + '%',
				paymentSuccessRate: dashboard.overview.paymentSuccessRate.toFixed(1) + '%',
				apiErrors: dashboard.failures.apiErrors
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};

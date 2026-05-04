import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';
import type { DashboardResponse } from '$common/types';

function getConfig() {
	const SMTP_HOST = env.SMTP_HOST || 'smtp.gmail.com';
	const SMTP_PORT = parseInt(env.SMTP_PORT || '587');
	const SMTP_USER = env.SMTP_USER || '';
	const SMTP_PASS = env.SMTP_PASS || '';
	const REPORT_TO = env.REPORT_TO || 'anshumishra1258@gmail.com';
	const REPORT_FROM = env.REPORT_FROM || SMTP_USER;
	return { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, REPORT_TO, REPORT_FROM };
}

function buildHtml(data: DashboardResponse, timeLabel: string): string {
	const { overview, funnel, failures, paymentHealth, topShops } = data;

	const shopRows = topShops.slice(0, 15).map(s => `
		<tr>
			<td style="padding:6px 12px;border-bottom:1px solid #334155;color:#f1f5f9;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.shop}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #334155;text-align:right;color:#f1f5f9">${s.sessions}</td>
			<td style="padding:6px 12px;border-bottom:1px solid #334155;text-align:right;color:${s.errorRate > 50 ? '#ef4444' : '#f1f5f9'}">${s.errorRate.toFixed(1)}%</td>
			<td style="padding:6px 12px;border-bottom:1px solid #334155;text-align:right;color:${s.paymentSuccessRate > 0 ? '#22c55e' : '#94a3b8'}">${s.paymentSuccessRate.toFixed(1)}%</td>
		</tr>
	`).join('');

	const errorSourceRows = failures.errorsBySource.slice(0, 10).map(e => `
		<tr>
			<td style="padding:4px 12px;border-bottom:1px solid #334155;color:#f1f5f9;font-family:monospace;font-size:12px">${e.source}</td>
			<td style="padding:4px 12px;border-bottom:1px solid #334155;text-align:right;color:#ef4444">${e.count}</td>
		</tr>
	`).join('');

	return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#0f172a;font-family:-apple-system,system-ui,sans-serif;color:#f1f5f9">
	<div style="max-width:700px;margin:0 auto">
		<h1 style="font-size:20px;color:#f1f5f9;margin-bottom:4px">Nimble V2 Analytics Report</h1>
		<p style="font-size:12px;color:#64748b;margin-top:0">${timeLabel} | ${data.sessionCount} sessions</p>

		<!-- Overview -->
		<table style="width:100%;border-collapse:collapse;margin:16px 0">
			<tr>
				<td style="padding:12px;background:#1e293b;border-radius:8px;text-align:center;width:20%">
					<div style="font-size:11px;color:#64748b;text-transform:uppercase">Sessions</div>
					<div style="font-size:24px;font-weight:bold;color:#f1f5f9;margin-top:4px">${overview.totalSessions}</div>
				</td>
				<td style="width:8px"></td>
				<td style="padding:12px;background:#1e293b;border-radius:8px;text-align:center;width:20%">
					<div style="font-size:11px;color:#64748b;text-transform:uppercase">Pay Success</div>
					<div style="font-size:24px;font-weight:bold;color:#22c55e;margin-top:4px">${overview.paymentSuccessRate.toFixed(1)}%</div>
				</td>
				<td style="width:8px"></td>
				<td style="padding:12px;background:#1e293b;border-radius:8px;text-align:center;width:20%">
					<div style="font-size:11px;color:#64748b;text-transform:uppercase">Error Rate</div>
					<div style="font-size:24px;font-weight:bold;color:#ef4444;margin-top:4px">${overview.errorRate.toFixed(1)}%</div>
				</td>
				<td style="width:8px"></td>
				<td style="padding:12px;background:#1e293b;border-radius:8px;text-align:center;width:20%">
					<div style="font-size:11px;color:#64748b;text-transform:uppercase">Exceptions</div>
					<div style="font-size:24px;font-weight:bold;color:#f59e0b;margin-top:4px">${overview.exceptionCount}</div>
				</td>
			</tr>
		</table>

		<!-- Funnel -->
		<h2 style="font-size:14px;color:#94a3b8;margin:20px 0 8px">Checkout Funnel</h2>
		<table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden">
			<tr><td style="padding:6px 12px;color:#94a3b8;font-size:12px">Session Started</td><td style="padding:6px 12px;text-align:right;color:#f1f5f9;font-weight:bold">${funnel.sessionStarted}</td></tr>
			<tr><td style="padding:6px 12px;color:#94a3b8;font-size:12px;border-top:1px solid #334155">Reached Auth</td><td style="padding:6px 12px;text-align:right;color:#f1f5f9;border-top:1px solid #334155">${funnel.reachedAuth}</td></tr>
			<tr><td style="padding:6px 12px;color:#94a3b8;font-size:12px;border-top:1px solid #334155">Auth Success</td><td style="padding:6px 12px;text-align:right;color:#f1f5f9;border-top:1px solid #334155">${funnel.reachedAuthSuccess}</td></tr>
			<tr><td style="padding:6px 12px;color:#94a3b8;font-size:12px;border-top:1px solid #334155">Reached Address</td><td style="padding:6px 12px;text-align:right;color:#f1f5f9;border-top:1px solid #334155">${funnel.reachedAddress}</td></tr>
			<tr><td style="padding:6px 12px;color:#94a3b8;font-size:12px;border-top:1px solid #334155">Reached Payment</td><td style="padding:6px 12px;text-align:right;color:#f1f5f9;border-top:1px solid #334155">${funnel.reachedPayment}</td></tr>
			<tr><td style="padding:6px 12px;color:#94a3b8;font-size:12px;border-top:1px solid #334155">Reached Order</td><td style="padding:6px 12px;text-align:right;color:#22c55e;font-weight:bold;border-top:1px solid #334155">${funnel.reachedOrder}</td></tr>
		</table>

		<!-- Failures -->
		<h2 style="font-size:14px;color:#94a3b8;margin:20px 0 8px">Key Failures</h2>
		<table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;font-size:12px">
			${failures.apiErrors > 0 ? `<tr><td style="padding:6px 12px;color:#94a3b8">API Errors</td><td style="padding:6px 12px;text-align:right;color:#ef4444;font-weight:bold">${failures.apiErrors}</td></tr>` : ''}
			${failures.networkErrors > 0 ? `<tr><td style="padding:6px 12px;color:#94a3b8;border-top:1px solid #334155">Network Errors</td><td style="padding:6px 12px;text-align:right;color:#ef4444;border-top:1px solid #334155">${failures.networkErrors}</td></tr>` : ''}
			${failures.exceptions > 0 ? `<tr><td style="padding:6px 12px;color:#94a3b8;border-top:1px solid #334155">Exceptions</td><td style="padding:6px 12px;text-align:right;color:#ef4444;border-top:1px solid #334155">${failures.exceptions}</td></tr>` : ''}
			${failures.hypersdkErrors > 0 ? `<tr><td style="padding:6px 12px;color:#94a3b8;border-top:1px solid #334155">HyperSDK Errors</td><td style="padding:6px 12px;text-align:right;color:#ef4444;border-top:1px solid #334155">${failures.hypersdkErrors}</td></tr>` : ''}
			${failures.recommendationFailures > 0 ? `<tr><td style="padding:6px 12px;color:#94a3b8;border-top:1px solid #334155">Recommendation Failures</td><td style="padding:6px 12px;text-align:right;color:#ef4444;border-top:1px solid #334155">${failures.recommendationFailures}</td></tr>` : ''}
			${paymentHealth.startPaymentFailures > 0 ? `<tr><td style="padding:6px 12px;color:#94a3b8;border-top:1px solid #334155">Start Payment Failures</td><td style="padding:6px 12px;text-align:right;color:#ef4444;border-top:1px solid #334155">${paymentHealth.startPaymentFailures}</td></tr>` : ''}
		</table>

		${errorSourceRows ? `
		<h2 style="font-size:14px;color:#94a3b8;margin:20px 0 8px">Top Error Sources</h2>
		<table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;font-size:12px">
			${errorSourceRows}
		</table>` : ''}

		<!-- Top Shops -->
		${shopRows ? `
		<h2 style="font-size:14px;color:#94a3b8;margin:20px 0 8px">Top Shops</h2>
		<table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;font-size:12px">
			<tr style="background:#0f172a">
				<th style="padding:8px 12px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Shop</th>
				<th style="padding:8px 12px;text-align:right;color:#64748b;font-size:10px;text-transform:uppercase">Sessions</th>
				<th style="padding:8px 12px;text-align:right;color:#64748b;font-size:10px;text-transform:uppercase">Error %</th>
				<th style="padding:8px 12px;text-align:right;color:#64748b;font-size:10px;text-transform:uppercase">Pay %</th>
			</tr>
			${shopRows}
		</table>` : ''}

		<p style="font-size:11px;color:#475569;margin-top:24px;text-align:center">
			Nimble V2 Analytics | Auto-generated report
		</p>
	</div>
</body>
</html>`;
}

export async function sendReport(data: DashboardResponse, timeLabel: string): Promise<void> {
	const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, REPORT_TO, REPORT_FROM } = getConfig();

	if (!SMTP_USER || !SMTP_PASS) {
		console.log('SMTP not configured, skipping email. Set SMTP_USER and SMTP_PASS env vars.');
		console.log('Current SMTP_USER:', SMTP_USER ? '(set)' : '(empty)');
		return;
	}

	console.log(`Sending report to: ${REPORT_TO} from: ${REPORT_FROM}`);

	const transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: SMTP_PORT,
		secure: SMTP_PORT === 465,
		auth: { user: SMTP_USER, pass: SMTP_PASS }
	});

	const subject = `Nimble V2 Report | ${data.sessionCount} sessions | ${data.overview.errorRate.toFixed(0)}% errors | ${timeLabel}`;

	await transporter.sendMail({
		from: REPORT_FROM,
		to: REPORT_TO,
		subject,
		html: buildHtml(data, timeLabel)
	});

	console.log(`Report sent successfully to ${REPORT_TO}`);
}

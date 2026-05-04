// Startup script: starts the cron scheduler then boots the SvelteKit server
import cron from 'node-cron';

const CRON_ENABLED = process.env.CRON_ENABLED === 'true';
const CRON_COOKIE = process.env.CRON_COOKIE || '';

if (CRON_ENABLED && CRON_COOKIE) {
	console.log('[Cron] Starting hourly report scheduler...');

	cron.schedule('5 * * * *', async () => {
		const to = new Date();
		const from = new Date(to.getTime() - 60 * 60 * 1000);
		const timeLabel = `${from.toISOString().slice(0, 16)} to ${to.toISOString().slice(0, 16)} UTC`;
		console.log(`[Cron] Triggering report: ${timeLabel}`);

		try {
			const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/report`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cookie: CRON_COOKIE,
					from: from.toISOString(),
					to: to.toISOString()
				})
			});
			const data = await res.json();
			console.log('[Cron] Result:', data.message || data.error);
		} catch (err) {
			console.error('[Cron] Failed:', err.message);
		}
	});

	console.log('[Cron] Scheduled at :05 past every hour');
} else {
	console.log('[Cron] Disabled (set CRON_ENABLED=true and CRON_COOKIE)');
}

// Boot the SvelteKit server
import('./build/index.js');

<script lang="ts">
	import { cookie, timeFrom, timeTo, loading, error } from '$client/stores/filters';
	import type { DashboardResponse, SessionSummary, ErrorLog } from '$common/types';

	let data: DashboardResponse | null = $state(null);
	let expandedShop: string | null = $state(null);
	let expandedSession: string | null = $state(null);
	let lastFetchTime: string | null = $state(null);

	let funnelSteps = $derived(data ? [
		{ label: 'Session Started', value: data.funnel.sessionStarted, color: 'var(--accent)' },
		{ label: 'Reached Auth', value: data.funnel.reachedAuth, color: '#8b5cf6' },
		{ label: 'Auth Success', value: data.funnel.reachedAuthSuccess, color: '#6366f1' },
		{ label: 'Reached Address', value: data.funnel.reachedAddress, color: '#14b8a6' },
		{ label: 'Reached Payment', value: data.funnel.reachedPayment, color: '#f59e0b' },
		{ label: 'Reached Order', value: data.funnel.reachedOrder, color: '#22c55e' }
	] : []);

	let failures = $derived(data ? [
		['OTP Send', data.failures.otpSendFailures],
		['OTP Verify', data.failures.otpVerifyFailures],
		['Cart Creation', data.failures.cartFailures],
		['Offer Apply', data.failures.offerFailures],
		['Address Save', data.failures.addressSaveFailures],
		['Address Validation', data.failures.addressValidationFailures],
		['Order Creation', data.failures.orderCreationFailures],
		['Order Status', data.failures.orderStatusFailures],
		['API Errors', data.failures.apiErrors],
		['Network Errors', data.failures.networkErrors],
		['Exceptions', data.failures.exceptions],
		['HyperSDK Errors', data.failures.hypersdkErrors],
		['Recommendation Failures', data.failures.recommendationFailures]
	] as [string, number][] : []);

	let instruments = $derived(data ? [
		['UPI', data.paymentHealth.instrumentFailures.upi],
		['Card', data.paymentHealth.instrumentFailures.card],
		['NetBanking', data.paymentHealth.instrumentFailures.netbanking],
		['Wallet', data.paymentHealth.instrumentFailures.wallet],
		['BNPL', data.paymentHealth.instrumentFailures.bnpl],
		['COD', data.paymentHealth.instrumentFailures.cod]
	] as [string, number][] : []);

	function getShopSessions(shop: string): SessionSummary[] {
		if (!data) return [];
		return data.sessions.filter(s => s.shop === shop);
	}

	function getSessionErrors(sessionId: string): ErrorLog[] {
		if (!data) return [];
		return data.errorLogs.filter(e => e.sessionId === sessionId);
	}

	function getShopErrors(shop: string): ErrorLog[] {
		if (!data) return [];
		return data.errorLogs.filter(e => e.shop === shop);
	}

	function toggleShop(shop: string) {
		expandedShop = expandedShop === shop ? null : shop;
		expandedSession = null;
	}

	function toggleSession(sessionId: string) {
		expandedSession = expandedSession === sessionId ? null : sessionId;
	}

	function formatTime(ts: string): string {
		try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
	}

	function formatJson(val: Record<string, unknown> | null): string {
		if (!val) return '';
		try {
			const s = JSON.stringify(val, null, 2);
			return s.length > 500 ? s.substring(0, 500) + '\n...' : s;
		} catch { return ''; }
	}

	async function fetchDashboard() {
		if (!$cookie || !$timeFrom || !$timeTo) {
			$error = 'Please provide cookie and time range';
			return;
		}
		$loading = true;
		$error = '';
		data = null;
		expandedShop = null;
		expandedSession = null;

		try {
			const res = await fetch('/api/dashboard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cookie: $cookie,
					from: new Date($timeFrom).toISOString(),
					to: new Date($timeTo).toISOString()
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Failed to fetch');
			data = json as DashboardResponse;
			lastFetchTime = new Date().toLocaleTimeString();
		} catch (e) {
			$error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			$loading = false;
		}
	}
</script>

<div class="space-y-5">
	<!-- Filters -->
	<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
		<div class="flex flex-wrap items-end gap-4">
			<div class="flex-1 min-w-[300px]">
				<label class="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Kibana Cookie</label>
				<input
					type="password"
					bind:value={$cookie}
					placeholder="Paste your _pomerium cookie here..."
					class="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
				/>
			</div>
			<div>
				<label class="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">From</label>
				<input
					type="datetime-local"
					bind:value={$timeFrom}
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
				/>
			</div>
			<div>
				<label class="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">To</label>
				<input
					type="datetime-local"
					bind:value={$timeTo}
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
				/>
			</div>
			<button
				onclick={fetchDashboard}
				disabled={$loading}
				class="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-blue-500/20"
			>
				{$loading ? 'Processing...' : 'Analyze'}
			</button>
		</div>
		{#if $error}
			<div class="mt-3 px-3 py-2 bg-[var(--danger-subtle)] border border-[var(--danger)]/30 rounded-lg">
				<p class="text-sm text-[var(--danger)]">{$error}</p>
			</div>
		{/if}
	</div>

	{#if $loading}
		<div class="text-center py-16">
			<div class="inline-block w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
			<p class="text-[var(--text-secondary)]">Fetching and processing Nimble V2 logs...</p>
			<p class="text-xs text-[var(--text-muted)] mt-1">Discovering sessions, parsing logs, computing metrics</p>
		</div>
	{/if}

	{#if data}
		<!-- Status bar -->
		<div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
			<span>{data.sessionCount} sessions analyzed | {data.timeRange.from.slice(0, 16)} to {data.timeRange.to.slice(0, 16)}</span>
			{#if lastFetchTime}<span>Last updated: {lastFetchTime}</span>{/if}
		</div>

		<!-- Overview Cards -->
		<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--text-muted)] transition-colors">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Sessions</p>
				<p class="text-3xl font-bold mt-2 tabular-nums">{data.overview.totalSessions}</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--success)]/30 transition-colors">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Payment Success</p>
				<p class="text-3xl font-bold mt-2 text-[var(--success)] tabular-nums">{data.overview.paymentSuccessRate.toFixed(1)}%</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--danger)]/30 transition-colors">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Error Rate</p>
				<p class="text-3xl font-bold mt-2 text-[var(--danger)] tabular-nums">{data.overview.errorRate.toFixed(1)}%</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--warning)]/30 transition-colors">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Exceptions</p>
				<p class="text-3xl font-bold mt-2 text-[var(--warning)] tabular-nums">{data.overview.exceptionCount}</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--text-muted)] transition-colors">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Avg Pay Attempts</p>
				<p class="text-3xl font-bold mt-2 tabular-nums">{data.overview.avgPaymentAttempts.toFixed(1)}</p>
			</div>
		</div>

		<!-- Funnel -->
		<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
			<h2 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Checkout Funnel</h2>
			<div class="space-y-3">
				{#each funnelSteps as step}
					{@const pct = data.funnel.sessionStarted > 0 ? (step.value / data.funnel.sessionStarted) * 100 : 0}
					<div class="flex items-center gap-4">
						<span class="text-xs text-[var(--text-secondary)] w-36 shrink-0">{step.label}</span>
						<div class="flex-1 bg-[var(--bg-primary)] rounded-full h-6 overflow-hidden">
							<div class="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2" style="width: {Math.max(pct, 2)}%; background: {step.color}">
								{#if pct > 15}
									<span class="text-[10px] font-medium text-white">{pct.toFixed(0)}%</span>
								{/if}
							</div>
						</div>
						<span class="text-xs font-mono w-20 text-right tabular-nums text-[var(--text-secondary)]">{step.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Failures + Payment Health -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
				<h2 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Failure Breakdown</h2>
				<div class="space-y-2 text-sm">
					{#each failures as [label, count]}
						<div class="flex justify-between items-center py-0.5">
							<span class="text-[var(--text-secondary)]">{label}</span>
							{#if count > 0}
								<span class="font-mono tabular-nums px-2 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)] text-xs">{count}</span>
							{:else}
								<span class="font-mono tabular-nums text-[var(--text-muted)] text-xs">0</span>
							{/if}
						</div>
					{/each}
				</div>

				{#if data.failures.errorsBySource.length > 0}
					<hr class="border-[var(--border)] my-4" />
					<h3 class="text-xs font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wider">Errors by Source</h3>
					<div class="space-y-2.5">
						{#each data.failures.errorsBySource as err}
							<div class="bg-[var(--bg-primary)] rounded-lg p-2.5">
								<div class="flex justify-between items-start">
									<span class="text-[var(--text-primary)] font-mono text-xs break-all">{err.source}</span>
									<span class="font-mono text-[var(--danger)] shrink-0 ml-2 px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-xs">{err.count}</span>
								</div>
								{#if err.sampleMessage}
									<p class="text-[10px] text-[var(--text-muted)] mt-1.5 break-all leading-relaxed select-text">{err.sampleMessage}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
				<h2 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Payment Health</h2>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between py-0.5">
						<span class="text-[var(--text-secondary)]">Total Attempts</span>
						<span class="font-mono tabular-nums">{data.paymentHealth.totalAttempts}</span>
					</div>
					<div class="flex justify-between py-0.5">
						<span class="text-[var(--text-secondary)]">Successful</span>
						<span class="font-mono tabular-nums px-2 py-0.5 rounded bg-[var(--success-subtle)] text-[var(--success)] text-xs">{data.paymentHealth.successCount}</span>
					</div>
					<div class="flex justify-between py-0.5">
						<span class="text-[var(--text-secondary)]">Success Rate</span>
						<span class="font-mono tabular-nums text-[var(--success)]">{data.paymentHealth.successRate.toFixed(1)}%</span>
					</div>
					<hr class="border-[var(--border)] my-3" />
					<p class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-2">Instrument Failures</p>
					{#each instruments as [label, count]}
						<div class="flex justify-between items-center py-0.5">
							<span class="text-[var(--text-secondary)]">{label}</span>
							{#if count > 0}
								<span class="font-mono tabular-nums px-2 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)] text-xs">{count}</span>
							{:else}
								<span class="font-mono tabular-nums text-[var(--text-muted)] text-xs">0</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Platform & Shops -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#if data.platforms.length > 0}
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
					<h2 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Platforms</h2>
					<table class="w-full text-sm">
						<thead>
							<tr class="text-[var(--text-muted)] text-xs uppercase tracking-wider">
								<th class="text-left pb-3">Platform</th>
								<th class="text-right pb-3">Sessions</th>
								<th class="text-right pb-3">Error %</th>
								<th class="text-right pb-3">Pay %</th>
							</tr>
						</thead>
						<tbody>
							{#each data.platforms as p}
								<tr class="border-t border-[var(--border)]">
									<td class="py-2.5 font-medium">{p.platform}</td>
									<td class="text-right font-mono tabular-nums">{p.sessions}</td>
									<td class="text-right font-mono tabular-nums text-[var(--danger)]">{p.errorRate.toFixed(1)}%</td>
									<td class="text-right font-mono tabular-nums text-[var(--success)]">{p.paymentSuccessRate.toFixed(1)}%</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if data.topShops.length > 0}
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
					<h2 class="text-sm font-semibold text-[var(--text-primary)] mb-1">Top Shops</h2>
					<p class="text-xs text-[var(--text-muted)] mb-4">Click a row to drill into sessions and error logs</p>
					<table class="w-full text-sm">
						<thead>
							<tr class="text-[var(--text-muted)] text-xs uppercase tracking-wider">
								<th class="text-left pb-3">Shop</th>
								<th class="text-right pb-3">Sessions</th>
								<th class="text-right pb-3">Error %</th>
								<th class="text-right pb-3">Pay %</th>
							</tr>
						</thead>
						<tbody>
							{#each data.topShops as s}
								<tr
									class="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
									class:bg-[var(--accent-subtle)]={expandedShop === s.shop}
									onclick={() => toggleShop(s.shop)}
								>
									<td class="py-2.5 max-w-[200px] truncate select-text" title={s.shop}>{s.shop}</td>
									<td class="text-right font-mono tabular-nums">{s.sessions}</td>
									<td class="text-right font-mono tabular-nums text-[var(--danger)]">{s.errorRate.toFixed(1)}%</td>
									<td class="text-right font-mono tabular-nums text-[var(--success)]">{s.paymentSuccessRate.toFixed(1)}%</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Expanded Shop Detail -->
		{#if expandedShop}
			{@const shopSessions = getShopSessions(expandedShop)}
			{@const shopErrors = getShopErrors(expandedShop)}
			<div class="bg-[var(--bg-card)] rounded-xl border-2 border-[var(--accent)]/40 p-5 shadow-lg shadow-blue-500/5">
				<div class="flex items-center justify-between mb-5">
					<div>
						<h2 class="text-sm font-semibold text-[var(--text-primary)]">Shop Detail</h2>
						<p class="text-xs font-mono text-[var(--accent)] mt-0.5 select-text">{expandedShop}</p>
					</div>
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-3 text-xs">
							<span class="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)]">{shopSessions.length} sessions</span>
							<span class="px-2 py-1 rounded bg-[var(--danger-subtle)] text-[var(--danger)]">{shopErrors.length} errors</span>
						</div>
						<button onclick={() => { expandedShop = null; expandedSession = null; }} class="text-xs px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Close</button>
					</div>
				</div>

				<!-- Sessions table -->
				<div class="overflow-x-auto mb-4">
					<table class="w-full text-xs">
						<thead>
							<tr class="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
								<th class="text-left p-2">Session ID</th>
								<th class="text-right p-2">Logs</th>
								<th class="text-right p-2">Errors</th>
								<th class="text-right p-2">Pay Attempts</th>
								<th class="text-right p-2">Successes</th>
								<th class="text-left p-2">Platform</th>
								<th class="text-left p-2">Error Sources</th>
							</tr>
						</thead>
						<tbody>
							{#each shopSessions as sess}
								{@const hasErrors = sess.apiErrorCount > 0 || sess.exceptionCount > 0}
								<tr
									class="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
									class:bg-[var(--accent-subtle)]={expandedSession === sess.sessionId}
									onclick={() => toggleSession(sess.sessionId)}
								>
									<td class="p-2 font-mono max-w-[180px] truncate select-text" title={sess.sessionId}>{sess.sessionId}</td>
									<td class="text-right p-2 font-mono tabular-nums">{sess.logCount}</td>
									<td class="text-right p-2 font-mono tabular-nums">
										{#if hasErrors}
											<span class="px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)]">{sess.apiErrorCount + sess.exceptionCount}</span>
										{:else}
											<span class="text-[var(--text-muted)]">0</span>
										{/if}
									</td>
									<td class="text-right p-2 font-mono tabular-nums">{sess.paymentAttemptCount}</td>
									<td class="text-right p-2 font-mono tabular-nums text-[var(--success)]">{sess.txnInitiationSuccessCount}</td>
									<td class="p-2">{sess.platform}</td>
									<td class="p-2 max-w-[200px] truncate text-[var(--text-muted)]" title={sess.errorSources.join(', ')}>{sess.errorSources.join(', ') || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Expanded Session Error Logs -->
				{#if expandedSession}
					{@const sessionErrors = getSessionErrors(expandedSession)}
					<div class="border-t border-[var(--border)] pt-4">
						<div class="flex items-center gap-2 mb-3">
							<h3 class="text-xs font-semibold text-[var(--text-primary)]">Error Logs</h3>
							<span class="text-[10px] font-mono text-[var(--accent)] select-text">{expandedSession}</span>
							<span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)]">{sessionErrors.length}</span>
						</div>
						{#if sessionErrors.length === 0}
							<p class="text-xs text-[var(--text-muted)] py-4">No error logs found for this session.</p>
						{:else}
							<div class="max-h-[500px] overflow-y-auto space-y-2">
								{#each sessionErrors as err}
									<div class="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
										<div class="flex items-center gap-2 mb-2 flex-wrap">
											<span class="px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)] text-[10px] font-medium">{err.event}</span>
											<span class="px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-secondary)] text-[10px]">{err.infoType}</span>
											<span class="font-mono text-[var(--accent)] text-[10px] select-text">{err.source}</span>
											<span class="text-[var(--text-muted)] text-[10px] ml-auto tabular-nums">{formatTime(err.timestamp)}</span>
										</div>
										{#if err.value}
											<pre class="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-all leading-relaxed select-text bg-[var(--bg-card)] rounded p-2 max-h-[200px] overflow-y-auto">{formatJson(err.value)}</pre>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Shop error summary (when no session selected) -->
				{#if shopErrors.length > 0 && !expandedSession}
					<div class="border-t border-[var(--border)] pt-4">
						<h3 class="text-xs font-semibold text-[var(--text-primary)] mb-3">All Errors for this Shop ({shopErrors.length})</h3>
						<div class="max-h-[400px] overflow-y-auto space-y-2">
							{#each shopErrors.slice(0, 50) as err}
								<div class="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)] text-[10px] font-medium">{err.event}</span>
										<span class="font-mono text-[var(--accent)] text-[10px] select-text">{err.source}</span>
										<span class="font-mono text-[var(--text-muted)] text-[10px] truncate max-w-[140px] select-text" title={err.sessionId}>{err.sessionId}</span>
										<span class="text-[var(--text-muted)] text-[10px] ml-auto tabular-nums">{formatTime(err.timestamp)}</span>
									</div>
									{#if err.value}
										<pre class="text-[10px] text-[var(--text-muted)] whitespace-pre-wrap break-all mt-1.5 max-h-[80px] overflow-y-auto select-text">{formatJson(err.value)}</pre>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Time Series -->
		{#if data.timeSeries.apiErrors.length > 0}
			{@const apiMax = Math.max(...data.timeSeries.apiErrors.map(p => p.value), 1)}
			{@const payMax = Math.max(...data.timeSeries.paymentAttempts.map(p => p.value), 1)}
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
				<h2 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Trends (5-min buckets)</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<p class="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider">API Errors</p>
						<div class="flex items-end gap-0.5 h-20">
							{#each data.timeSeries.apiErrors as point}
								<div
									class="flex-1 bg-[var(--danger)] rounded-t opacity-60 hover:opacity-100 transition-opacity"
									style="height: {Math.max((point.value / apiMax) * 100, 2)}%"
									title="{new Date(point.timestamp).toLocaleTimeString()}: {point.value}"
								></div>
							{/each}
						</div>
					</div>
					<div>
						<p class="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider">Payment Attempts</p>
						<div class="flex items-end gap-0.5 h-20">
							{#each data.timeSeries.paymentAttempts as point}
								<div
									class="flex-1 bg-[var(--accent)] rounded-t opacity-60 hover:opacity-100 transition-opacity"
									style="height: {Math.max((point.value / payMax) * 100, 2)}%"
									title="{new Date(point.timestamp).toLocaleTimeString()}: {point.value}"
								></div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

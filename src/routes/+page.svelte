<script lang="ts">
	import { cookie, timeFrom, timeTo, loading, error } from '$client/stores/filters';
	import type { DashboardResponse, SessionSummary, ErrorLog } from '$common/types';

	let data: DashboardResponse | null = $state(null);
	let expandedShop: string | null = $state(null);
	let expandedSession: string | null = $state(null);

	let funnelSteps = $derived(data ? [
		{ label: 'Session Started', value: data.funnel.sessionStarted },
		{ label: 'Reached Auth', value: data.funnel.reachedAuth },
		{ label: 'Auth Success', value: data.funnel.reachedAuthSuccess },
		{ label: 'Reached Address', value: data.funnel.reachedAddress },
		{ label: 'Reached Payment', value: data.funnel.reachedPayment },
		{ label: 'Reached Order', value: data.funnel.reachedOrder }
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
		['HyperSDK Errors', data.failures.hypersdkErrors]
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
		try {
			return new Date(ts).toLocaleTimeString();
		} catch {
			return ts;
		}
	}

	function truncateJson(val: Record<string, unknown> | null): string {
		if (!val) return '';
		const s = JSON.stringify(val);
		return s.length > 200 ? s.substring(0, 200) + '...' : s;
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
		} catch (e) {
			$error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			$loading = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Filters -->
	<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
		<div class="flex flex-wrap items-end gap-4">
			<div class="flex-1 min-w-[300px]">
				<label class="block text-xs text-[var(--text-secondary)] mb-1">Kibana Cookie</label>
				<input
					type="password"
					bind:value={$cookie}
					placeholder="Paste your Kibana cookie here..."
					class="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
				/>
			</div>
			<div>
				<label class="block text-xs text-[var(--text-secondary)] mb-1">From</label>
				<input
					type="datetime-local"
					bind:value={$timeFrom}
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)]"
				/>
			</div>
			<div>
				<label class="block text-xs text-[var(--text-secondary)] mb-1">To</label>
				<input
					type="datetime-local"
					bind:value={$timeTo}
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)]"
				/>
			</div>
			<button
				onclick={fetchDashboard}
				disabled={$loading}
				class="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 rounded text-sm font-medium text-white"
			>
				{$loading ? 'Loading...' : 'Fetch'}
			</button>
		</div>
		{#if $error}
			<p class="mt-2 text-sm text-[var(--danger)]">{$error}</p>
		{/if}
	</div>

	{#if $loading}
		<div class="text-center py-12 text-[var(--text-secondary)]">
			<p class="text-lg">Fetching and processing logs...</p>
			<p class="text-sm mt-2">This may take a moment depending on the time range.</p>
		</div>
	{/if}

	{#if data}
		<!-- Overview Cards -->
		<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<p class="text-xs text-[var(--text-secondary)]">Total Sessions</p>
				<p class="text-2xl font-bold mt-1">{data.overview.totalSessions}</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<p class="text-xs text-[var(--text-secondary)]">Payment Success Rate</p>
				<p class="text-2xl font-bold mt-1 text-[var(--success)]">{data.overview.paymentSuccessRate.toFixed(1)}%</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<p class="text-xs text-[var(--text-secondary)]">Error Rate</p>
				<p class="text-2xl font-bold mt-1 text-[var(--danger)]">{data.overview.errorRate.toFixed(1)}%</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<p class="text-xs text-[var(--text-secondary)]">Exceptions</p>
				<p class="text-2xl font-bold mt-1 text-[var(--warning)]">{data.overview.exceptionCount}</p>
			</div>
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<p class="text-xs text-[var(--text-secondary)]">Avg Payment Attempts</p>
				<p class="text-2xl font-bold mt-1">{data.overview.avgPaymentAttempts.toFixed(1)}</p>
			</div>
		</div>

		<!-- Funnel -->
		<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
			<h2 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Checkout Funnel</h2>
			<div class="space-y-2">
				{#each funnelSteps as step}
					{@const pct = data.funnel.sessionStarted > 0 ? (step.value / data.funnel.sessionStarted) * 100 : 0}
					<div class="flex items-center gap-3">
						<span class="text-xs text-[var(--text-secondary)] w-32 shrink-0">{step.label}</span>
						<div class="flex-1 bg-[var(--bg-primary)] rounded-full h-5 overflow-hidden">
							<div class="h-full bg-[var(--accent)] rounded-full transition-all" style="width: {pct}%"></div>
						</div>
						<span class="text-xs font-mono w-16 text-right">{step.value} ({pct.toFixed(0)}%)</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Failures + Errors by Source -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<h2 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Failure Breakdown</h2>
				<div class="space-y-1.5 text-sm">
					{#each failures as [label, count]}
						<div class="flex justify-between">
							<span class="text-[var(--text-secondary)]">{label}</span>
							<span class="font-mono {count > 0 ? 'text-[var(--danger)]' : ''}">{count}</span>
						</div>
					{/each}
				</div>

				{#if data.failures.errorsBySource.length > 0}
					<hr class="border-[var(--border)] my-3" />
					<h3 class="text-xs font-medium text-[var(--text-secondary)] mb-2">Errors by Source</h3>
					<div class="space-y-1.5 text-sm">
						{#each data.failures.errorsBySource as err}
							<div>
								<div class="flex justify-between">
									<span class="text-[var(--text-primary)] font-mono text-xs truncate max-w-[250px]" title={err.source}>{err.source}</span>
									<span class="font-mono text-[var(--danger)] shrink-0 ml-2">{err.count}</span>
								</div>
								{#if err.sampleMessage}
									<p class="text-xs text-[var(--text-secondary)] mt-0.5 truncate" title={err.sampleMessage}>{err.sampleMessage}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<h2 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Payment Health</h2>
				<div class="space-y-1.5 text-sm">
					<div class="flex justify-between">
						<span class="text-[var(--text-secondary)]">Total Attempts</span>
						<span class="font-mono">{data.paymentHealth.totalAttempts}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-[var(--text-secondary)]">Success Count</span>
						<span class="font-mono text-[var(--success)]">{data.paymentHealth.successCount}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-[var(--text-secondary)]">Success Rate</span>
						<span class="font-mono text-[var(--success)]">{data.paymentHealth.successRate.toFixed(1)}%</span>
					</div>
					<hr class="border-[var(--border)] my-2" />
					<p class="text-xs text-[var(--text-secondary)] font-medium">Instrument Failures (sessions)</p>
					{#each instruments as [label, count]}
						<div class="flex justify-between">
							<span class="text-[var(--text-secondary)]">{label}</span>
							<span class="font-mono {count > 0 ? 'text-[var(--danger)]' : ''}">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Platform & Shops -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#if data.platforms.length > 0}
				<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
					<h2 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Platforms</h2>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="text-[var(--text-secondary)] text-xs">
									<th class="text-left pb-2">Platform</th>
									<th class="text-right pb-2">Sessions</th>
									<th class="text-right pb-2">Error %</th>
									<th class="text-right pb-2">Pay Success %</th>
								</tr>
							</thead>
							<tbody>
								{#each data.platforms as p}
									<tr class="border-t border-[var(--border)]">
										<td class="py-1.5">{p.platform}</td>
										<td class="text-right font-mono">{p.sessions}</td>
										<td class="text-right font-mono text-[var(--danger)]">{p.errorRate.toFixed(1)}%</td>
										<td class="text-right font-mono text-[var(--success)]">{p.paymentSuccessRate.toFixed(1)}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			{#if data.topShops.length > 0}
				<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
					<h2 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Top Shops <span class="text-xs font-normal">(click to expand)</span></h2>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="text-[var(--text-secondary)] text-xs">
									<th class="text-left pb-2">Shop</th>
									<th class="text-right pb-2">Sessions</th>
									<th class="text-right pb-2">Error %</th>
									<th class="text-right pb-2">Pay Success %</th>
								</tr>
							</thead>
							<tbody>
								{#each data.topShops as s}
									<tr
										class="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--bg-primary)] transition-colors"
										class:bg-[var(--bg-primary)]={expandedShop === s.shop}
										onclick={() => toggleShop(s.shop)}
									>
										<td class="py-1.5 max-w-[200px] truncate" title={s.shop}>{s.shop}</td>
										<td class="text-right font-mono">{s.sessions}</td>
										<td class="text-right font-mono text-[var(--danger)]">{s.errorRate.toFixed(1)}%</td>
										<td class="text-right font-mono text-[var(--success)]">{s.paymentSuccessRate.toFixed(1)}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>

		<!-- Expanded Shop Detail -->
		{#if expandedShop}
			{@const shopSessions = getShopSessions(expandedShop)}
			{@const shopErrors = getShopErrors(expandedShop)}
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--accent)] p-4">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-sm font-medium">
						Shop: <span class="font-mono text-[var(--accent)]">{expandedShop}</span>
						<span class="text-[var(--text-secondary)] ml-2">({shopSessions.length} sessions, {shopErrors.length} errors)</span>
					</h2>
					<button onclick={() => { expandedShop = null; expandedSession = null; }} class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Close</button>
				</div>

				<!-- Sessions table -->
				<div class="overflow-x-auto mb-4">
					<table class="w-full text-xs font-mono">
						<thead>
							<tr class="text-[var(--text-secondary)]">
								<th class="text-left p-1.5">Session ID</th>
								<th class="text-right p-1.5">Logs</th>
								<th class="text-right p-1.5">Errors</th>
								<th class="text-right p-1.5">Pay Attempts</th>
								<th class="text-right p-1.5">Pay Success</th>
								<th class="text-left p-1.5">Platform</th>
								<th class="text-left p-1.5">Error Sources</th>
							</tr>
						</thead>
						<tbody>
							{#each shopSessions as sess}
								<tr
									class="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--bg-primary)] transition-colors"
									class:bg-[var(--bg-primary)]={expandedSession === sess.sessionId}
									class:text-red-400={sess.apiErrorCount > 0}
									onclick={() => toggleSession(sess.sessionId)}
								>
									<td class="p-1.5 max-w-[180px] truncate" title={sess.sessionId}>{sess.sessionId}</td>
									<td class="text-right p-1.5">{sess.logCount}</td>
									<td class="text-right p-1.5">{sess.apiErrorCount + sess.exceptionCount}</td>
									<td class="text-right p-1.5">{sess.paymentAttemptCount}</td>
									<td class="text-right p-1.5">{sess.txnInitiationSuccessCount}</td>
									<td class="p-1.5">{sess.platform}</td>
									<td class="p-1.5 max-w-[200px] truncate" title={sess.errorSources.join(', ')}>{sess.errorSources.join(', ') || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Expanded Session Error Logs -->
				{#if expandedSession}
					{@const sessionErrors = getSessionErrors(expandedSession)}
					<div class="border-t border-[var(--border)] pt-3">
						<h3 class="text-xs font-medium text-[var(--text-secondary)] mb-2">
							Error Logs for <span class="text-[var(--accent)]">{expandedSession}</span>
							({sessionErrors.length} errors)
						</h3>
						{#if sessionErrors.length === 0}
							<p class="text-xs text-[var(--text-secondary)]">No error logs for this session.</p>
						{:else}
							<div class="max-h-[400px] overflow-y-auto space-y-2">
								{#each sessionErrors as err}
									<div class="bg-[var(--bg-primary)] rounded p-2 text-xs">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-[var(--danger)] font-medium">{err.event}</span>
											<span class="text-[var(--text-secondary)]">{err.infoType}</span>
											<span class="text-[var(--accent)] font-mono">{err.source}</span>
											<span class="text-[var(--text-secondary)] ml-auto">{formatTime(err.timestamp)}</span>
										</div>
										{#if err.value}
											<pre class="text-[var(--text-secondary)] whitespace-pre-wrap break-all text-[10px] mt-1 max-h-[150px] overflow-y-auto">{truncateJson(err.value)}</pre>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Shop-level error summary -->
				{#if shopErrors.length > 0 && !expandedSession}
					<div class="border-t border-[var(--border)] pt-3">
						<h3 class="text-xs font-medium text-[var(--text-secondary)] mb-2">Recent Errors ({shopErrors.length})</h3>
						<div class="max-h-[300px] overflow-y-auto space-y-2">
							{#each shopErrors.slice(0, 50) as err}
								<div class="bg-[var(--bg-primary)] rounded p-2 text-xs">
									<div class="flex items-center gap-2">
										<span class="text-[var(--danger)] font-medium">{err.event}</span>
										<span class="text-[var(--accent)] font-mono">{err.source}</span>
										<span class="text-[var(--text-secondary)] font-mono truncate max-w-[120px]" title={err.sessionId}>{err.sessionId}</span>
										<span class="text-[var(--text-secondary)] ml-auto">{formatTime(err.timestamp)}</span>
									</div>
									{#if err.value}
										<pre class="text-[var(--text-secondary)] whitespace-pre-wrap break-all text-[10px] mt-1 max-h-[80px] overflow-y-auto">{truncateJson(err.value)}</pre>
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
			<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
				<h2 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Trends (5-min buckets)</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<p class="text-xs text-[var(--text-secondary)] mb-2">API Errors</p>
						<div class="flex items-end gap-0.5 h-16">
							{#each data.timeSeries.apiErrors as point}
								<div
									class="flex-1 bg-[var(--danger)] rounded-t opacity-70 hover:opacity-100 transition-opacity"
									style="height: {(point.value / apiMax) * 100}%"
									title="{point.timestamp}: {point.value}"
								></div>
							{/each}
						</div>
					</div>
					<div>
						<p class="text-xs text-[var(--text-secondary)] mb-2">Payment Attempts</p>
						<div class="flex items-end gap-0.5 h-16">
							{#each data.timeSeries.paymentAttempts as point}
								<div
									class="flex-1 bg-[var(--accent)] rounded-t opacity-70 hover:opacity-100 transition-opacity"
									style="height: {(point.value / payMax) * 100}%"
									title="{point.timestamp}: {point.value}"
								></div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

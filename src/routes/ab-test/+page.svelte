<script lang="ts">
	import { cookie, timeFrom, timeTo, loading, error } from '$client/stores/filters';
	import type { ABTestResponse, DashboardResponse } from '$common/types';

	let data: ABTestResponse | null = $state(null);
	let shopId: string = $state('');
	let lastFetchTime: string | null = $state(null);

	function delta(v2: number, v1: number): string {
		const diff = v2 - v1;
		if (diff === 0) return '0';
		return (diff > 0 ? '+' : '') + diff.toFixed(1);
	}

	function deltaColor(diff: number, lowerIsBetter = false): string {
		if (diff === 0) return 'var(--text-muted)';
		const good = lowerIsBetter ? diff < 0 : diff > 0;
		return good ? 'var(--success)' : 'var(--danger)';
	}

	function funnelSteps(d: DashboardResponse) {
		return [
			{ label: 'Session Started', value: d.funnel.sessionStarted, color: 'var(--accent)' },
			{ label: 'Reached Auth', value: d.funnel.reachedAuth, color: '#8b5cf6' },
			{ label: 'Auth Success', value: d.funnel.reachedAuthSuccess, color: '#6366f1' },
			{ label: 'Reached Address', value: d.funnel.reachedAddress, color: '#14b8a6' },
			{ label: 'Reached Payment', value: d.funnel.reachedPayment, color: '#f59e0b' },
			{ label: 'Reached Order', value: d.funnel.reachedOrder, color: '#22c55e' }
		];
	}

	function failureList(d: DashboardResponse) {
		return [
			['API Errors', d.failures.apiErrors],
			['Network Errors', d.failures.networkErrors],
			['Exceptions', d.failures.exceptions],
			['HyperSDK Errors', d.failures.hypersdkErrors],
			['Recommendation Failures', d.failures.recommendationFailures],
			['OTP Send', d.failures.otpSendFailures],
			['OTP Verify', d.failures.otpVerifyFailures],
			['Cart Creation', d.failures.cartFailures],
			['Address Save', d.failures.addressSaveFailures],
			['Order Creation', d.failures.orderCreationFailures],
		] as [string, number][];
	}

	async function fetchComparison() {
		if (!$cookie || !$timeFrom || !$timeTo) {
			$error = 'Please provide cookie and time range';
			return;
		}
		$loading = true;
		$error = '';
		data = null;

		try {
			const res = await fetch('/api/ab-test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cookie: $cookie,
					from: new Date($timeFrom).toISOString(),
					to: new Date($timeTo).toISOString(),
					...(shopId.trim() ? { shopId: shopId.trim() } : {})
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Failed to fetch');
			data = json as ABTestResponse;
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
			<div class="flex-1 min-w-[250px]">
				<label class="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Kibana Cookie</label>
				<input
					type="password"
					bind:value={$cookie}
					placeholder="Paste your _pomerium cookie..."
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
			<div>
				<label class="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Shop ID <span class="text-[var(--text-muted)]">(optional)</span></label>
				<input
					type="text"
					bind:value={shopId}
					placeholder="e.g. myshop.myshopify.com"
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors w-56"
				/>
			</div>
			<button
				onclick={fetchComparison}
				disabled={$loading}
				class="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-blue-500/20"
			>
				{$loading ? 'Comparing...' : 'Compare'}
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
			<p class="text-[var(--text-secondary)]">Fetching Nimble v1 and v2 sessions in parallel...</p>
			<p class="text-xs text-[var(--text-muted)] mt-1">This may take longer as both versions are being analyzed</p>
		</div>
	{/if}

	{#if data}
		{@const v1 = data.v1}
		{@const v2 = data.v2}
		{@const errDiff = v2.overview.errorRate - v1.overview.errorRate}
		{@const payDiff = v2.overview.paymentSuccessRate - v1.overview.paymentSuccessRate}

		<!-- Status -->
		<div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
			<span>v1: {v1.sessionCount} sessions | v2: {v2.sessionCount} sessions{shopId.trim() ? ` | Shop: ${shopId.trim()}` : ''}</span>
			{#if lastFetchTime}<span>Last updated: {lastFetchTime}</span>{/if}
		</div>

		<!-- Delta Summary -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Sessions</p>
				<div class="flex items-center justify-center gap-3 mt-2">
					<span class="text-lg font-bold text-[var(--text-secondary)]">{v1.sessionCount}</span>
					<span class="text-[var(--text-muted)]">vs</span>
					<span class="text-lg font-bold text-[var(--text-primary)]">{v2.sessionCount}</span>
				</div>
			</div>
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Payment Success</p>
				<div class="flex items-center justify-center gap-3 mt-2">
					<span class="text-lg font-bold text-[var(--text-secondary)]">{v1.overview.paymentSuccessRate.toFixed(1)}%</span>
					<span class="text-sm font-bold px-2 py-0.5 rounded" style="color: {deltaColor(payDiff)}; background: {payDiff > 0 ? 'var(--success-subtle)' : payDiff < 0 ? 'var(--danger-subtle)' : 'transparent'}">{delta(v2.overview.paymentSuccessRate, v1.overview.paymentSuccessRate)}%</span>
					<span class="text-lg font-bold text-[var(--text-primary)]">{v2.overview.paymentSuccessRate.toFixed(1)}%</span>
				</div>
			</div>
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Error Rate</p>
				<div class="flex items-center justify-center gap-3 mt-2">
					<span class="text-lg font-bold text-[var(--text-secondary)]">{v1.overview.errorRate.toFixed(1)}%</span>
					<span class="text-sm font-bold px-2 py-0.5 rounded" style="color: {deltaColor(errDiff, true)}; background: {errDiff < 0 ? 'var(--success-subtle)' : errDiff > 0 ? 'var(--danger-subtle)' : 'transparent'}">{delta(v2.overview.errorRate, v1.overview.errorRate)}%</span>
					<span class="text-lg font-bold text-[var(--text-primary)]">{v2.overview.errorRate.toFixed(1)}%</span>
				</div>
			</div>
			<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 text-center">
				<p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Exceptions</p>
				<div class="flex items-center justify-center gap-3 mt-2">
					<span class="text-lg font-bold text-[var(--text-secondary)]">{v1.overview.exceptionCount}</span>
					<span class="text-[var(--text-muted)]">vs</span>
					<span class="text-lg font-bold text-[var(--text-primary)]">{v2.overview.exceptionCount}</span>
				</div>
			</div>
		</div>

		<!-- Side-by-side comparison -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- V1 Column -->
			<div class="space-y-4">
				<div class="text-center">
					<span class="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Nimble v1</span>
				</div>

				<!-- V1 Overview -->
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
					<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Overview</h3>
					<div class="grid grid-cols-2 gap-3">
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Sessions</p>
							<p class="text-xl font-bold mt-1 tabular-nums">{v1.overview.totalSessions}</p>
						</div>
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Pay Success</p>
							<p class="text-xl font-bold mt-1 text-[var(--success)] tabular-nums">{v1.overview.paymentSuccessRate.toFixed(1)}%</p>
						</div>
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Error Rate</p>
							<p class="text-xl font-bold mt-1 text-[var(--danger)] tabular-nums">{v1.overview.errorRate.toFixed(1)}%</p>
						</div>
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Exceptions</p>
							<p class="text-xl font-bold mt-1 text-[var(--warning)] tabular-nums">{v1.overview.exceptionCount}</p>
						</div>
					</div>
				</div>

				<!-- V1 Funnel -->
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
					<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Funnel</h3>
					<div class="space-y-2">
						{#each funnelSteps(v1) as step}
							{@const pct = v1.funnel.sessionStarted > 0 ? (step.value / v1.funnel.sessionStarted) * 100 : 0}
							<div class="flex items-center gap-3">
								<span class="text-[10px] text-[var(--text-secondary)] w-28 shrink-0">{step.label}</span>
								<div class="flex-1 bg-[var(--bg-primary)] rounded-full h-4 overflow-hidden">
									<div class="h-full rounded-full flex items-center justify-end pr-1.5" style="width: {Math.max(pct, 3)}%; background: {step.color}">
										{#if pct > 20}<span class="text-[8px] font-medium text-white">{pct.toFixed(0)}%</span>{/if}
									</div>
								</div>
								<span class="text-[10px] font-mono w-10 text-right tabular-nums text-[var(--text-muted)]">{step.value}</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- V1 Failures -->
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
					<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Failures</h3>
					<div class="space-y-1.5 text-xs">
						{#each failureList(v1) as [label, count]}
							<div class="flex justify-between items-center py-0.5">
								<span class="text-[var(--text-secondary)]">{label}</span>
								{#if count > 0}
									<span class="font-mono tabular-nums px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)] text-[10px]">{count}</span>
								{:else}
									<span class="font-mono tabular-nums text-[var(--text-muted)] text-[10px]">0</span>
								{/if}
							</div>
						{/each}
					</div>
					{#if v1.failures.errorsBySource.length > 0}
						<hr class="border-[var(--border)] my-3" />
						<h4 class="text-[10px] font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Top Error Sources</h4>
						<div class="space-y-1.5">
							{#each v1.failures.errorsBySource.slice(0, 8) as err}
								<div class="flex justify-between items-center text-[10px]">
									<span class="text-[var(--text-secondary)] font-mono truncate max-w-[180px]" title={err.source}>{err.source}</span>
									<span class="font-mono text-[var(--danger)] shrink-0 ml-2">{err.count}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- V1 Top Shops -->
				{#if v1.topShops.length > 0}
					<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
						<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Top Shops</h3>
						<table class="w-full text-[10px]">
							<thead>
								<tr class="text-[var(--text-muted)] uppercase tracking-wider">
									<th class="text-left pb-2">Shop</th>
									<th class="text-right pb-2">Sessions</th>
									<th class="text-right pb-2">Err%</th>
									<th class="text-right pb-2">Pay%</th>
								</tr>
							</thead>
							<tbody>
								{#each v1.topShops.slice(0, 10) as s}
									<tr class="border-t border-[var(--border)]">
										<td class="py-1.5 truncate max-w-[120px] select-text" title={s.shop}>{s.shop}</td>
										<td class="text-right font-mono tabular-nums">{s.sessions}</td>
										<td class="text-right font-mono tabular-nums text-[var(--danger)]">{s.errorRate.toFixed(0)}%</td>
										<td class="text-right font-mono tabular-nums text-[var(--success)]">{s.paymentSuccessRate.toFixed(0)}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- V2 Column -->
			<div class="space-y-4">
				<div class="text-center">
					<span class="px-3 py-1 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/30 text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">Nimble v2</span>
				</div>

				<!-- V2 Overview -->
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--accent)]/20 p-4">
					<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Overview</h3>
					<div class="grid grid-cols-2 gap-3">
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Sessions</p>
							<p class="text-xl font-bold mt-1 tabular-nums">{v2.overview.totalSessions}</p>
						</div>
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Pay Success</p>
							<p class="text-xl font-bold mt-1 text-[var(--success)] tabular-nums">{v2.overview.paymentSuccessRate.toFixed(1)}%</p>
						</div>
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Error Rate</p>
							<p class="text-xl font-bold mt-1 text-[var(--danger)] tabular-nums">{v2.overview.errorRate.toFixed(1)}%</p>
						</div>
						<div class="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
							<p class="text-[10px] text-[var(--text-muted)] uppercase">Exceptions</p>
							<p class="text-xl font-bold mt-1 text-[var(--warning)] tabular-nums">{v2.overview.exceptionCount}</p>
						</div>
					</div>
				</div>

				<!-- V2 Funnel -->
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--accent)]/20 p-4">
					<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Funnel</h3>
					<div class="space-y-2">
						{#each funnelSteps(v2) as step}
							{@const pct = v2.funnel.sessionStarted > 0 ? (step.value / v2.funnel.sessionStarted) * 100 : 0}
							<div class="flex items-center gap-3">
								<span class="text-[10px] text-[var(--text-secondary)] w-28 shrink-0">{step.label}</span>
								<div class="flex-1 bg-[var(--bg-primary)] rounded-full h-4 overflow-hidden">
									<div class="h-full rounded-full flex items-center justify-end pr-1.5" style="width: {Math.max(pct, 3)}%; background: {step.color}">
										{#if pct > 20}<span class="text-[8px] font-medium text-white">{pct.toFixed(0)}%</span>{/if}
									</div>
								</div>
								<span class="text-[10px] font-mono w-10 text-right tabular-nums text-[var(--text-muted)]">{step.value}</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- V2 Failures -->
				<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--accent)]/20 p-4">
					<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Failures</h3>
					<div class="space-y-1.5 text-xs">
						{#each failureList(v2) as [label, count], i}
							{@const v1Count = failureList(v1)[i]?.[1] ?? 0}
							{@const diff = count - v1Count}
							<div class="flex justify-between items-center py-0.5">
								<span class="text-[var(--text-secondary)]">{label}</span>
								<div class="flex items-center gap-2">
									{#if diff !== 0}
										<span class="text-[9px] font-mono tabular-nums" style="color: {deltaColor(diff, true)}">{diff > 0 ? '+' : ''}{diff}</span>
									{/if}
									{#if count > 0}
										<span class="font-mono tabular-nums px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)] text-[10px]">{count}</span>
									{:else}
										<span class="font-mono tabular-nums text-[var(--text-muted)] text-[10px]">0</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
					{#if v2.failures.errorsBySource.length > 0}
						<hr class="border-[var(--border)] my-3" />
						<h4 class="text-[10px] font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Top Error Sources</h4>
						<div class="space-y-1.5">
							{#each v2.failures.errorsBySource.slice(0, 8) as err}
								<div class="flex justify-between items-center text-[10px]">
									<span class="text-[var(--text-secondary)] font-mono truncate max-w-[180px]" title={err.source}>{err.source}</span>
									<span class="font-mono text-[var(--danger)] shrink-0 ml-2">{err.count}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- V2 Top Shops -->
				{#if v2.topShops.length > 0}
					<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--accent)]/20 p-4">
						<h3 class="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Top Shops</h3>
						<table class="w-full text-[10px]">
							<thead>
								<tr class="text-[var(--text-muted)] uppercase tracking-wider">
									<th class="text-left pb-2">Shop</th>
									<th class="text-right pb-2">Sessions</th>
									<th class="text-right pb-2">Err%</th>
									<th class="text-right pb-2">Pay%</th>
								</tr>
							</thead>
							<tbody>
								{#each v2.topShops.slice(0, 10) as s}
									<tr class="border-t border-[var(--border)]">
										<td class="py-1.5 truncate max-w-[120px] select-text" title={s.shop}>{s.shop}</td>
										<td class="text-right font-mono tabular-nums">{s.sessions}</td>
										<td class="text-right font-mono tabular-nums text-[var(--danger)]">{s.errorRate.toFixed(0)}%</td>
										<td class="text-right font-mono tabular-nums text-[var(--success)]">{s.paymentSuccessRate.toFixed(0)}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<!-- Payment Health Comparison -->
		<div class="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
			<h2 class="text-sm font-semibold text-[var(--text-primary)] mb-4">Payment Health Comparison</h2>
			<table class="w-full text-sm">
				<thead>
					<tr class="text-[var(--text-muted)] text-xs uppercase tracking-wider">
						<th class="text-left pb-3">Metric</th>
						<th class="text-right pb-3">v1</th>
						<th class="text-right pb-3">v2</th>
						<th class="text-right pb-3">Delta</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-t border-[var(--border)]">
						<td class="py-2 text-[var(--text-secondary)]">Total Attempts</td>
						<td class="text-right font-mono tabular-nums">{v1.paymentHealth.totalAttempts}</td>
						<td class="text-right font-mono tabular-nums">{v2.paymentHealth.totalAttempts}</td>
						<td class="text-right font-mono tabular-nums" style="color: {deltaColor(v2.paymentHealth.totalAttempts - v1.paymentHealth.totalAttempts)}">{delta(v2.paymentHealth.totalAttempts, v1.paymentHealth.totalAttempts)}</td>
					</tr>
					<tr class="border-t border-[var(--border)]">
						<td class="py-2 text-[var(--text-secondary)]">Success Count</td>
						<td class="text-right font-mono tabular-nums">{v1.paymentHealth.successCount}</td>
						<td class="text-right font-mono tabular-nums">{v2.paymentHealth.successCount}</td>
						<td class="text-right font-mono tabular-nums" style="color: {deltaColor(v2.paymentHealth.successCount - v1.paymentHealth.successCount)}">{delta(v2.paymentHealth.successCount, v1.paymentHealth.successCount)}</td>
					</tr>
					<tr class="border-t border-[var(--border)]">
						<td class="py-2 text-[var(--text-secondary)]">Success Rate</td>
						<td class="text-right font-mono tabular-nums text-[var(--success)]">{v1.paymentHealth.successRate.toFixed(1)}%</td>
						<td class="text-right font-mono tabular-nums text-[var(--success)]">{v2.paymentHealth.successRate.toFixed(1)}%</td>
						<td class="text-right font-mono tabular-nums" style="color: {deltaColor(v2.paymentHealth.successRate - v1.paymentHealth.successRate)}">{delta(v2.paymentHealth.successRate, v1.paymentHealth.successRate)}%</td>
					</tr>
					{#each [['UPI', 'upi'], ['Card', 'card'], ['NetBanking', 'netbanking'], ['Wallet', 'wallet'], ['BNPL', 'bnpl'], ['COD', 'cod']] as [label, key]}
						{@const v1Val = v1.paymentHealth.instrumentFailures[key as keyof typeof v1.paymentHealth.instrumentFailures]}
						{@const v2Val = v2.paymentHealth.instrumentFailures[key as keyof typeof v2.paymentHealth.instrumentFailures]}
						{#if v1Val > 0 || v2Val > 0}
							<tr class="border-t border-[var(--border)]">
								<td class="py-2 text-[var(--text-secondary)]">{label} Failures</td>
								<td class="text-right font-mono tabular-nums text-[var(--danger)]">{v1Val}</td>
								<td class="text-right font-mono tabular-nums text-[var(--danger)]">{v2Val}</td>
								<td class="text-right font-mono tabular-nums" style="color: {deltaColor(v2Val - v1Val, true)}">{delta(v2Val, v1Val)}</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

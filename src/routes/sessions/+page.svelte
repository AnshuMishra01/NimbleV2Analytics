<script lang="ts">
	import { cookie, timeFrom, timeTo, loading, error } from '$client/stores/filters';
	import type { SessionMetrics, ParsedLog } from '$common/types';

	let sessions: SessionMetrics[] = $state([]);
	let selectedSession: { metrics: SessionMetrics; logs: ParsedLog[] } | null = $state(null);
	let loadingSession = $state(false);

	async function fetchSessions() {
		if (!$cookie || !$timeFrom || !$timeTo) {
			$error = 'Please provide cookie and time range';
			return;
		}

		$loading = true;
		$error = '';
		sessions = [];

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

			// We need session-level data; reuse the metrics endpoint
			// For now, show summary from dashboard
			$error = '';
		} catch (e) {
			$error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			$loading = false;
		}
	}

	async function viewSession(sessionId: string) {
		if (!$cookie || !$timeFrom || !$timeTo) return;
		loadingSession = true;
		selectedSession = null;

		try {
			const res = await fetch(`/api/session/${sessionId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cookie: $cookie,
					from: new Date($timeFrom).toISOString(),
					to: new Date($timeTo).toISOString()
				})
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Failed to fetch session');
			selectedSession = json;
		} catch (e) {
			$error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loadingSession = false;
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
			<div>
				<label class="block text-xs text-[var(--text-secondary)] mb-1">Session ID (direct lookup)</label>
				<input
					type="text"
					id="session-lookup"
					placeholder="Paste session ID..."
					class="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							const input = e.currentTarget as HTMLInputElement;
							if (input.value.trim()) viewSession(input.value.trim());
						}
					}}
				/>
			</div>
		</div>
		{#if $error}
			<p class="mt-2 text-sm text-[var(--danger)]">{$error}</p>
		{/if}
	</div>

	{#if loadingSession}
		<div class="text-center py-8 text-[var(--text-secondary)]">Loading session details...</div>
	{/if}

	{#if selectedSession}
		<div class="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-medium">Session: <span class="font-mono text-[var(--accent)]">{selectedSession.metrics.sessionId}</span></h2>
				<button onclick={() => { selectedSession = null; }} class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Close</button>
			</div>

			<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
				<div>
					<span class="text-[var(--text-secondary)]">Shop:</span>
					<span class="ml-1 font-mono">{selectedSession.metrics.shop || '-'}</span>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Platform:</span>
					<span class="ml-1">{selectedSession.metrics.platform}</span>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Logs:</span>
					<span class="ml-1 font-mono">{selectedSession.metrics.logCount}</span>
				</div>
				<div>
					<span class="text-[var(--text-secondary)]">Payment Attempts:</span>
					<span class="ml-1 font-mono">{selectedSession.metrics.paymentAttemptCount}</span>
				</div>
			</div>

			<!-- Log timeline -->
			<div class="max-h-[500px] overflow-y-auto">
				<table class="w-full text-xs font-mono">
					<thead class="sticky top-0 bg-[var(--bg-card)]">
						<tr class="text-[var(--text-secondary)]">
							<th class="text-left p-1">#</th>
							<th class="text-left p-1">Event</th>
							<th class="text-left p-1">Source</th>
							<th class="text-left p-1">Info</th>
							<th class="text-left p-1">Context</th>
						</tr>
					</thead>
					<tbody>
						{#each selectedSession.logs as log}
							<tr class="border-t border-[var(--border)] hover:bg-[var(--bg-primary)]"
								class:text-red-400={log.infoType === 'Error' || log.infoType === 'Exception' || log.infoType === 'Critical'}
							>
								<td class="p-1">{log.serialNumber}</td>
								<td class="p-1">{log.event}</td>
								<td class="p-1 max-w-[200px] truncate" title={log.source}>{log.source}</td>
								<td class="p-1">{log.infoType}</td>
								<td class="p-1">{log.context}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

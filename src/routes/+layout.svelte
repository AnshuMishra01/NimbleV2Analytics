<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-screen bg-[var(--bg-primary)]">
	<nav class="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-sm">
		<div class="flex items-center gap-6">
			<h1 class="text-lg font-bold text-[var(--text-primary)] tracking-tight">Nimble V2 Analytics</h1>
			<div class="flex items-center gap-1 bg-[var(--bg-card)] rounded-lg p-0.5">
				<a href="/" class="px-3 py-1.5 text-sm rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">Dashboard</a>
				<a href="/sessions" class="px-3 py-1.5 text-sm rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">Sessions</a>
				<a href="/ab-test" class="px-3 py-1.5 text-sm rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">A/B Test</a>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<span class="text-xs text-[var(--text-muted)]">v2 monitoring</span>
		</div>
	</nav>
	<main class="max-w-[1400px] mx-auto p-6">
		{@render children()}
	</main>
</div>

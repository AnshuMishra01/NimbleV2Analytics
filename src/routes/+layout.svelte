<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-screen bg-[var(--bg-primary)]">
	<nav class="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
		<div class="flex items-center gap-4">
			<h1 class="text-lg font-semibold text-[var(--text-primary)]">Breeze Monitor</h1>
			<a href="/" class="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Dashboard</a>
			<a href="/sessions" class="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Sessions</a>
		</div>
	</nav>
	<main class="p-6">
		{@render children()}
	</main>
</div>

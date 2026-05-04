import { writable } from 'svelte/store';

export const cookie = writable('');
export const timeFrom = writable(getDefaultFrom());
export const timeTo = writable(new Date().toISOString().slice(0, 16));
export const loading = writable(false);
export const error = writable('');

function getDefaultFrom(): string {
	const d = new Date();
	d.setHours(d.getHours() - 1);
	return d.toISOString().slice(0, 16);
}

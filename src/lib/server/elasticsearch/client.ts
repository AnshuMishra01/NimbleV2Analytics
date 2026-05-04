import { ES_ENDPOINT_RELEASE, ES_INDEX, ES_MAX_SIZE } from '$common/constants';

export interface ESQuery {
	filter: Record<string, unknown>[];
	must?: Record<string, unknown>;
	size?: number;
	searchAfter?: unknown[];
}

export interface ESHit {
	_id: string;
	_source: {
		message: string;
		timestamp?: string;
		'@timestamp'?: string;
		pod_name?: string;
		service?: string;
		[key: string]: unknown;
	};
	sort?: unknown[];
}

interface ESResponse {
	rawResponse?: {
		hits?: {
			hits?: ESHit[];
			total?: { value: number };
		};
	};
}

function formatCookie(cookie: string): string {
	// If it looks like a cookie header (contains "key=value" pattern with a name before '=')
	// e.g. "gjaw=eyJ..." or "sid=abc; gjaw=eyJ..."
	if (/^[a-zA-Z_][a-zA-Z0-9_]*=/.test(cookie.trim())) return cookie;
	// Otherwise it's a raw JWT token — wrap as gjaw=<jwt>
	return `gjaw=${cookie}`;
}

export async function queryES(cookie: string, query: ESQuery): Promise<ESHit[]> {
	const body: Record<string, unknown> = {
		query: {
			bool: {
				filter: query.filter,
				...(query.must ? { must: query.must } : {})
			}
		},
		sort: [{ 'timestamp': { order: 'desc' } }],
		size: query.size ?? ES_MAX_SIZE
	};

	if (query.searchAfter) {
		body.search_after = query.searchAfter;
	}

	const response = await fetch(ES_ENDPOINT_RELEASE, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'kbn-xsrf': 'true',
			Cookie: formatCookie(cookie)
		},
		body: JSON.stringify({
			params: {
				index: ES_INDEX,
				body
			}
		}),
		signal: AbortSignal.timeout(30000)
	});

	const text = await response.text();

	if (!response.ok) {
		console.error(`ES query failed: ${response.status}`, text.substring(0, 300));
		throw new Error(`ES query failed: ${response.status} ${response.statusText}`);
	}

	let data: ESResponse;
	try {
		data = JSON.parse(text) as ESResponse;
	} catch {
		console.error('ES returned non-JSON:', text.substring(0, 300));
		throw new Error('ES returned non-JSON response (likely auth redirect)');
	}

	// Handle ES-level errors (status 200 but query error inside)
	if ((data as Record<string, unknown>).statusCode === 400) {
		console.error('ES query error:', text.substring(0, 300));
		throw new Error('ES query error: ' + ((data as Record<string, unknown>).message || 'unknown'));
	}

	const hits = data?.rawResponse?.hits?.hits ?? [];
	return hits;
}

export async function queryESWithPagination(
	cookie: string,
	query: ESQuery,
	maxResults: number = ES_MAX_SIZE
): Promise<ESHit[]> {
	const allHits: ESHit[] = [];
	let searchAfter: unknown[] | undefined;

	while (allHits.length < maxResults) {
		const hits = await queryES(cookie, {
			...query,
			size: Math.min(ES_MAX_SIZE, maxResults - allHits.length),
			searchAfter
		});

		if (hits.length === 0) break;

		allHits.push(...hits);
		searchAfter = hits[hits.length - 1].sort;

		if (hits.length < ES_MAX_SIZE) break; // no more results
	}

	return allHits;
}

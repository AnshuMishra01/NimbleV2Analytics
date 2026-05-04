import type {
	ParsedLog,
	SessionMetrics,
	DashboardResponse,
	OverviewData,
	FunnelData,
	FailureData,
	PaymentHealthData,
	PlatformData,
	ShopData,
	TimeSeriesPoint,
	ErrorBySource,
	SessionSummary,
	ErrorLog
} from '$common/types';

function computeOverview(sessions: SessionMetrics[]): OverviewData {
	const total = sessions.length;
	if (total === 0) {
		return { totalSessions: 0, paymentSuccessRate: 0, errorRate: 0, exceptionCount: 0, avgPaymentAttempts: 0 };
	}

	const sessionsWithPayment = sessions.filter(s => s.paymentAttemptCount > 0);
	const successfulPayments = sessions.reduce((sum, s) => sum + s.txnInitiationSuccessCount, 0);
	const totalAttempts = sessions.reduce((sum, s) => sum + s.paymentAttemptCount, 0);
	const errorSessions = sessions.filter(s => s.apiErrorCount > 0 || s.exceptionCount > 0).length;
	const totalExceptions = sessions.reduce((sum, s) => sum + s.exceptionCount, 0);

	return {
		totalSessions: total,
		paymentSuccessRate: totalAttempts > 0 ? (successfulPayments / totalAttempts) * 100 : 0,
		errorRate: (errorSessions / total) * 100,
		exceptionCount: totalExceptions,
		avgPaymentAttempts: sessionsWithPayment.length > 0
			? totalAttempts / sessionsWithPayment.length
			: 0
	};
}

function computeFunnel(sessions: SessionMetrics[]): FunnelData {
	return {
		sessionStarted: sessions.length,
		reachedAuth: sessions.filter(s => s.reachedAuth).length,
		reachedAuthSuccess: sessions.filter(s => s.reachedAuthSuccess).length,
		reachedAddress: sessions.filter(s => s.reachedAddress).length,
		reachedPayment: sessions.filter(s => s.reachedPayment).length,
		reachedOrder: sessions.filter(s => s.reachedOrder).length
	};
}

function computeErrorsBySource(logs: ParsedLog[]): ErrorBySource[] {
	const sourceMap = new Map<string, { count: number; sample?: string }>();

	for (const log of logs) {
		if (log.event === 'Error' || log.infoType === 'Error' || log.infoType === 'Exception' || log.infoType === 'Critical') {
			const source = log.source || log.event;
			const existing = sourceMap.get(source);
			if (existing) {
				existing.count++;
			} else {
				// Extract a meaningful error message from value
				let sample: string | undefined;
				if (log.value) {
					const err = log.value.error ?? log.value.message ?? log.value.reason;
					if (typeof err === 'string') sample = err.substring(0, 200);
					else if (typeof err === 'object' && err !== null) {
						const msg = (err as Record<string, unknown>).message;
						if (typeof msg === 'string') sample = msg.substring(0, 200);
					}
				}
				sourceMap.set(source, { count: 1, sample });
			}
		}
	}

	return Array.from(sourceMap.entries())
		.map(([source, { count, sample }]) => ({ source, count, sampleMessage: sample }))
		.sort((a, b) => b.count - a.count);
}

function collectErrorLogs(logs: ParsedLog[]): ErrorLog[] {
	const errors: ErrorLog[] = [];
	for (const log of logs) {
		if (log.event === 'Error' || log.infoType === 'Error' || log.infoType === 'Exception' || log.infoType === 'Critical') {
			errors.push({
				sessionId: log.sessionId,
				shop: log.shop,
				event: log.event,
				source: log.source,
				infoType: log.infoType,
				timestamp: log.timestamp,
				value: log.value
			});
		}
	}
	return errors.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, 500);
}

function computeFailures(sessions: SessionMetrics[], logs: ParsedLog[]): FailureData {
	return {
		otpSendFailures: sessions.reduce((sum, s) => sum + s.otpSendFailureCount, 0),
		otpVerifyFailures: sessions.reduce((sum, s) => sum + s.otpVerifyFailureCount, 0),
		cartFailures: sessions.reduce((sum, s) => sum + s.cartCreationFailureCount, 0),
		offerFailures: sessions.reduce((sum, s) => sum + s.offerApplyFailureCount, 0),
		addressSaveFailures: sessions.reduce((sum, s) => sum + s.addressSaveFailureCount, 0),
		addressValidationFailures: sessions.reduce((sum, s) => sum + s.addressValidationFailureCount, 0),
		orderCreationFailures: sessions.reduce((sum, s) => sum + s.orderCreationFailureCount, 0),
		orderStatusFailures: sessions.reduce((sum, s) => sum + s.orderStatusFailureCount, 0),
		apiErrors: sessions.reduce((sum, s) => sum + s.apiErrorCount, 0),
		networkErrors: sessions.reduce((sum, s) => sum + s.networkErrorCount, 0),
		exceptions: sessions.reduce((sum, s) => sum + s.exceptionCount, 0),
		hypersdkErrors: sessions.reduce((sum, s) => sum + s.hypersdkErrorCount, 0),
		errorsBySource: computeErrorsBySource(logs)
	};
}

function computePaymentHealth(sessions: SessionMetrics[]): PaymentHealthData {
	const totalAttempts = sessions.reduce((sum, s) => sum + s.paymentAttemptCount, 0);
	const successCount = sessions.reduce((sum, s) => sum + s.txnInitiationSuccessCount, 0);

	return {
		totalAttempts,
		successCount,
		successRate: totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0,
		instrumentFailures: {
			upi: sessions.filter(s => s.upiFailure).length,
			card: sessions.filter(s => s.cardFailure).length,
			netbanking: sessions.filter(s => s.netbankingFailure).length,
			wallet: sessions.filter(s => s.walletFailure).length,
			bnpl: sessions.filter(s => s.bnplFailure).length,
			cod: sessions.filter(s => s.codFailure).length
		},
		startPaymentFailures: sessions.filter(s => s.startPaymentApiFailure).length,
		txnPollFailures: sessions.reduce((sum, s) => sum + s.txnPollFailureCount, 0),
		customPaymentFailures: sessions.reduce((sum, s) => sum + s.customPaymentFailureCount, 0)
	};
}

function computePlatforms(sessions: SessionMetrics[]): PlatformData[] {
	const platformMap = new Map<string, SessionMetrics[]>();
	for (const s of sessions) {
		const existing = platformMap.get(s.platform);
		if (existing) existing.push(s);
		else platformMap.set(s.platform, [s]);
	}

	return Array.from(platformMap.entries())
		.map(([platform, platformSessions]) => {
			const errorSessions = platformSessions.filter(s => s.apiErrorCount > 0 || s.exceptionCount > 0).length;
			const totalAttempts = platformSessions.reduce((sum, s) => sum + s.paymentAttemptCount, 0);
			const successCount = platformSessions.reduce((sum, s) => sum + s.txnInitiationSuccessCount, 0);
			return {
				platform,
				sessions: platformSessions.length,
				errorRate: (errorSessions / platformSessions.length) * 100,
				paymentSuccessRate: totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0
			};
		})
		.sort((a, b) => b.sessions - a.sessions);
}

function computeTopShops(sessions: SessionMetrics[]): ShopData[] {
	const shopMap = new Map<string, SessionMetrics[]>();
	for (const s of sessions) {
		if (!s.shop) continue;
		const existing = shopMap.get(s.shop);
		if (existing) existing.push(s);
		else shopMap.set(s.shop, [s]);
	}

	return Array.from(shopMap.entries())
		.map(([shop, shopSessions]) => {
			const errorSessions = shopSessions.filter(s => s.apiErrorCount > 0 || s.exceptionCount > 0).length;
			const totalAttempts = shopSessions.reduce((sum, s) => sum + s.paymentAttemptCount, 0);
			const successCount = shopSessions.reduce((sum, s) => sum + s.txnInitiationSuccessCount, 0);
			return {
				shop,
				sessions: shopSessions.length,
				errorRate: (errorSessions / shopSessions.length) * 100,
				paymentSuccessRate: totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0
			};
		})
		.sort((a, b) => b.sessions - a.sessions)
		.slice(0, 50);
}

function computeTimeSeries(sessions: SessionMetrics[]): DashboardResponse['timeSeries'] {
	const bucketMs = 5 * 60 * 1000;
	const buckets = new Map<number, SessionMetrics[]>();

	for (const s of sessions) {
		if (!s.firstTimestamp) continue;
		const ts = new Date(s.firstTimestamp).getTime();
		if (isNaN(ts)) continue;
		const bucket = Math.floor(ts / bucketMs) * bucketMs;
		const existing = buckets.get(bucket);
		if (existing) existing.push(s);
		else buckets.set(bucket, [s]);
	}

	const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);

	const apiErrors: TimeSeriesPoint[] = [];
	const networkErrors: TimeSeriesPoint[] = [];
	const exceptions: TimeSeriesPoint[] = [];
	const paymentAttempts: TimeSeriesPoint[] = [];

	for (const [ts, bucketSessions] of sortedBuckets) {
		const timestamp = new Date(ts).toISOString();
		apiErrors.push({ timestamp, value: bucketSessions.reduce((sum, s) => sum + s.apiErrorCount, 0) });
		networkErrors.push({ timestamp, value: bucketSessions.reduce((sum, s) => sum + s.networkErrorCount, 0) });
		exceptions.push({ timestamp, value: bucketSessions.reduce((sum, s) => sum + s.exceptionCount, 0) });
		paymentAttempts.push({ timestamp, value: bucketSessions.reduce((sum, s) => sum + s.paymentAttemptCount, 0) });
	}

	return { apiErrors, networkErrors, exceptions, paymentAttempts };
}

function buildSessionSummaries(sessions: SessionMetrics[], logs: ParsedLog[]): SessionSummary[] {
	// Build error source map per session
	const errorSourceMap = new Map<string, Set<string>>();
	for (const log of logs) {
		if (log.event === 'Error' || log.infoType === 'Error' || log.infoType === 'Exception') {
			const sources = errorSourceMap.get(log.sessionId) ?? new Set();
			sources.add(log.source || log.event);
			errorSourceMap.set(log.sessionId, sources);
		}
	}

	return sessions.map(s => ({
		sessionId: s.sessionId,
		shop: s.shop,
		platform: s.platform,
		logCount: s.logCount,
		apiErrorCount: s.apiErrorCount,
		exceptionCount: s.exceptionCount,
		paymentAttemptCount: s.paymentAttemptCount,
		txnInitiationSuccessCount: s.txnInitiationSuccessCount,
		firstTimestamp: s.firstTimestamp,
		lastTimestamp: s.lastTimestamp,
		errorSources: Array.from(errorSourceMap.get(s.sessionId) ?? [])
	}));
}

/**
 * Aggregate all session metrics into a full dashboard response
 */
export function aggregateDashboard(
	sessions: SessionMetrics[],
	logs: ParsedLog[],
	timeRange: { from: string; to: string }
): DashboardResponse {
	return {
		overview: computeOverview(sessions),
		funnel: computeFunnel(sessions),
		failures: computeFailures(sessions, logs),
		paymentHealth: computePaymentHealth(sessions),
		platforms: computePlatforms(sessions),
		topShops: computeTopShops(sessions),
		timeSeries: computeTimeSeries(sessions),
		sessionCount: sessions.length,
		sessions: buildSessionSummaries(sessions, logs),
		errorLogs: collectErrorLogs(logs),
		timeRange
	};
}

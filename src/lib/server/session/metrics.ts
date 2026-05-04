import type { ParsedLog, SessionMetrics } from '$common/types';
import {
	OTP_SEND_SOURCES,
	OTP_VERIFY_SOURCES,
	CART_CREATION_SOURCES,
	OFFER_SOURCES,
	START_PAYMENT_SOURCES,
	PAYMENT_VERIFY_SOURCES,
	CUSTOM_PAYMENT_SOURCES,
	ADDRESS_SAVE_SOURCES,
	ADDRESS_VALIDATE_SOURCES,
	ORDER_CREATION_SOURCES,
	ORDER_STATUS_SOURCES,
	RECOMMENDATION_SOURCES,
	HYPERSDK_SOURCES,
	INSTRUMENT_KEYWORDS
} from '$common/constants';

type InstrumentType = keyof typeof INSTRUMENT_KEYWORDS;

function isFailure(log: ParsedLog): boolean {
	return log.infoType === 'Error' || log.infoType === 'Exception' || log.infoType === 'Critical';
}

function isNetworkResponse(log: ParsedLog): boolean {
	return log.event === 'NetworkCallResponse' || log.event === 'FunctionCallResult';
}

function isNetworkError(log: ParsedLog): boolean {
	if (log.event !== 'NetworkCallResponse') return false;
	if (!log.value) return false;
	const status = log.value.statusCode ?? log.value.status ?? log.value.code;
	if (typeof status === 'number' && status >= 400) return true;
	if (log.value.error || log.value.isError) return true;
	// Catch errors with errorMessage/errorDetails even when errorCode is 200
	if (log.value.errorMessage || log.value.errorDetails || log.value.errorResponse) return true;
	return false;
}

function hasErrorFields(log: ParsedLog): boolean {
	if (!log.value) return false;
	return !!(log.value.errorMessage || log.value.errorDetails || log.value.errorResponse);
}

function detectInstrument(log: ParsedLog): InstrumentType | null {
	const payload = JSON.stringify(log.value ?? {}) + ' ' + log.source;
	for (const [instrument, keywords] of Object.entries(INSTRUMENT_KEYWORDS)) {
		for (const kw of keywords) {
			if (payload.includes(kw)) return instrument as InstrumentType;
		}
	}
	return null;
}

function sourceMatches(source: string, sources: readonly string[]): boolean {
	const lower = source.toLowerCase();
	return sources.some(s => lower.includes(s.toLowerCase()));
}

function extractPlatform(logs: ParsedLog[]): string {
	for (const log of logs) {
		if (log.value) {
			const ua = log.value.userAgent ?? log.value.user_agent ?? log.value.platform;
			if (typeof ua === 'string') {
				if (ua.includes('Android') || ua.includes('android')) return 'Android';
				if (ua.includes('iPhone') || ua.includes('iOS') || ua.includes('ios')) return 'iOS';
				if (ua.includes('Windows')) return 'Windows';
				if (ua.includes('Mac')) return 'macOS';
				return ua.substring(0, 20);
			}
		}
		if (log.host) {
			if (log.host.includes('android') || log.host.includes('Android')) return 'Android';
			if (log.host.includes('ios') || log.host.includes('iOS')) return 'iOS';
		}
	}
	return 'Unknown';
}

function extractDevice(logs: ParsedLog[]): string {
	for (const log of logs) {
		if (log.value) {
			const device = log.value.deviceModel ?? log.value.device ?? log.value.deviceName;
			if (typeof device === 'string' && device.length > 0) return device;
		}
	}
	return 'Unknown';
}

/**
 * Compute metrics for a single session from its parsed logs
 */
export function computeSessionMetrics(sessionId: string, logs: ParsedLog[]): SessionMetrics {
	const metrics: SessionMetrics = {
		sessionId,
		shop: '',
		checkoutId: '',
		platform: 'Unknown',
		device: 'Unknown',

		otpSendFailureCount: 0,
		otpVerifyFailureCount: 0,
		offerApplyFailureCount: 0,
		cartCreationFailureCount: 0,
		startPaymentApiFailure: false,

		upiFailure: false,
		cardFailure: false,
		netbankingFailure: false,
		walletFailure: false,
		bnplFailure: false,
		codFailure: false,

		apiErrorCount: 0,
		exceptionCount: 0,
		networkErrorCount: 0,
		hypersdkErrorCount: 0,

		addressValidationFailureCount: 0,
		addressSaveFailureCount: 0,
		orderCreationFailureCount: 0,
		orderStatusFailureCount: 0,
		paymentAttemptCount: 0,

		txnInitiationFailureCount: 0,
		txnPollFailureCount: 0,
		txnInitiationSuccessCount: 0,
		customPaymentFailureCount: 0,
		recommendationFailureCount: 0,

		reachedAuth: false,
		reachedAuthSuccess: false,
		reachedAddress: false,
		reachedPayment: false,
		reachedOrder: false,

		logCount: logs.length,
		firstTimestamp: '',
		lastTimestamp: ''
	};

	if (logs.length === 0) return metrics;

	// Sort by serial number for correct ordering
	logs.sort((a, b) => a.serialNumber - b.serialNumber);

	metrics.firstTimestamp = logs[0].timestamp || logs[0].rawTimestamp;
	metrics.lastTimestamp = logs[logs.length - 1].timestamp || logs[logs.length - 1].rawTimestamp;

	// Extract shop and checkoutId from first log that has them
	for (const log of logs) {
		if (!metrics.shop && log.shop) metrics.shop = log.shop;
		if (!metrics.checkoutId && log.checkoutId) metrics.checkoutId = log.checkoutId;
		if (metrics.shop && metrics.checkoutId) break;
	}

	metrics.platform = extractPlatform(logs);
	metrics.device = extractDevice(logs);

	for (const log of logs) {
		const source = log.source;
		const failed = isFailure(log);
		const isResponse = isNetworkResponse(log);

		// --- Exceptions & Errors ---
		if (log.event === 'Exception' || log.infoType === 'Exception') {
			metrics.exceptionCount++;
		}
		if (log.event === 'Error' || log.infoType === 'Error') {
			metrics.apiErrorCount++;
		}
		if (isNetworkError(log)) {
			metrics.networkErrorCount++;
		}

		// --- Auth (OTP) ---
		if (sourceMatches(source, OTP_SEND_SOURCES)) {
			metrics.reachedAuth = true;
			if (isResponse && failed) metrics.otpSendFailureCount++;
		}
		if (sourceMatches(source, OTP_VERIFY_SOURCES)) {
			if (isResponse && !failed) {
				metrics.reachedAuthSuccess = true;
			}
			if (isResponse && failed) metrics.otpVerifyFailureCount++;
		}

		// --- Cart ---
		if (sourceMatches(source, CART_CREATION_SOURCES)) {
			if (isResponse && failed) metrics.cartCreationFailureCount++;
		}

		// --- Offers ---
		if (sourceMatches(source, OFFER_SOURCES)) {
			if (isResponse && failed) metrics.offerApplyFailureCount++;
		}

		// --- Address ---
		if (sourceMatches(source, ADDRESS_SAVE_SOURCES)) {
			metrics.reachedAddress = true;
			if (isResponse && failed) metrics.addressSaveFailureCount++;
		}
		if (sourceMatches(source, ADDRESS_VALIDATE_SOURCES)) {
			metrics.reachedAddress = true;
			if (isResponse && failed) metrics.addressValidationFailureCount++;
		}

		// --- Payment ---
		if (sourceMatches(source, START_PAYMENT_SOURCES)) {
			metrics.reachedPayment = true;
			metrics.paymentAttemptCount++;
			if (isResponse && failed) metrics.startPaymentApiFailure = true;
		}
		if (sourceMatches(source, PAYMENT_VERIFY_SOURCES)) {
			if (isResponse && failed) {
				metrics.txnPollFailureCount++;
			} else if (isResponse && !failed) {
				metrics.txnInitiationSuccessCount++;
			}
		}
		if (sourceMatches(source, CUSTOM_PAYMENT_SOURCES)) {
			if (isResponse && failed) metrics.customPaymentFailureCount++;
		}

		// --- Recommendations ---
		if (sourceMatches(source, RECOMMENDATION_SOURCES)) {
			if (isResponse && (failed || isNetworkError(log) || hasErrorFields(log))) {
				metrics.recommendationFailureCount++;
			}
		}

		// --- HyperSDK ---
		if (sourceMatches(source, HYPERSDK_SOURCES)) {
			if (failed) metrics.hypersdkErrorCount++;

			// Detect instrument failures from HyperSDK events
			if (isResponse && failed) {
				const instrument = detectInstrument(log);
				if (instrument) {
					metrics.txnInitiationFailureCount++;
					switch (instrument) {
						case 'upi': metrics.upiFailure = true; break;
						case 'card': metrics.cardFailure = true; break;
						case 'netbanking': metrics.netbankingFailure = true; break;
						case 'wallet': metrics.walletFailure = true; break;
						case 'bnpl': metrics.bnplFailure = true; break;
						case 'cod': metrics.codFailure = true; break;
					}
				}
			}
		}

		// --- Order ---
		if (sourceMatches(source, ORDER_CREATION_SOURCES)) {
			metrics.reachedOrder = true;
			if (isResponse && failed) metrics.orderCreationFailureCount++;
		}
		if (sourceMatches(source, ORDER_STATUS_SOURCES)) {
			if (isResponse && failed) metrics.orderStatusFailureCount++;
		}
	}

	return metrics;
}

/**
 * Group parsed logs by session ID and compute metrics for each
 */
export function computeAllMetrics(logs: ParsedLog[]): SessionMetrics[] {
	const sessionMap = new Map<string, ParsedLog[]>();

	for (const log of logs) {
		const existing = sessionMap.get(log.sessionId);
		if (existing) {
			existing.push(log);
		} else {
			sessionMap.set(log.sessionId, [log]);
		}
	}

	const metrics: SessionMetrics[] = [];
	for (const [sessionId, sessionLogs] of sessionMap) {
		metrics.push(computeSessionMetrics(sessionId, sessionLogs));
	}

	return metrics;
}

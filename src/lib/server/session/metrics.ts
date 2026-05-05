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

/**
 * Map a raw payment method type string to our instrument categories.
 * Sources: PaymentInstrument.selectItem (pmt), verifyPaymentAttempt (paymentMethodType),
 * processHeadless action, autoRetryTxn instrument.
 */
function mapToInstrument(pmt: string): InstrumentType | null {
	if (!pmt) return null;
	const upper = pmt.toUpperCase();
	if (upper.includes('UPI') || upper === 'UPI_INTENT' || upper === 'UPI_COLLECT' || upper === 'UPI_PAY') return 'upi';
	if (upper.includes('CARD') || upper === 'EMI' || upper.includes('BAJAJ') || upper.includes('AMEX')) return 'card';
	if (upper.includes('NB') || upper.includes('NETBANKING')) return 'netbanking';
	if (upper.includes('WALLET') || upper.includes('BREEZE_WALLET')) return 'wallet';
	if (upper.includes('BNPL') || upper.includes('PAYLATER') || upper.includes('PAY_LATER') || upper.includes('LAZYPAY') || upper.includes('SIMPL') || upper.includes('SNAPMINT') || upper.includes('CONSUMER_FINANCE')) return 'bnpl';
	if (upper.includes('COD') || upper.includes('CASH')) return 'cod';
	return null;
}

/**
 * Extract instrument type from a processHeadless/processHeadlessSync FunctionCalled payload.
 * action field: "upiTxn", "upi", "cardTxn", "nbTxn", "walletTxn", "consumerFinanceTxn"
 */
function instrumentFromHeadlessAction(log: ParsedLog): InstrumentType | null {
	const fcp = log.value?.functionCallParams as Record<string, unknown> | undefined;
	const payload = fcp?.payload as Record<string, unknown> | undefined;
	const inner = payload?.payload as Record<string, unknown> | undefined;
	const action = inner?.action;
	if (typeof action !== 'string') return null;
	const a = action.toLowerCase();
	if (a.includes('upi')) return 'upi';
	if (a.includes('card')) return 'card';
	if (a.includes('nb') || a.includes('netbanking')) return 'netbanking';
	if (a.includes('wallet')) return 'wallet';
	if (a.includes('consumer') || a.includes('bnpl')) return 'bnpl';
	return null;
}

/**
 * Extract paymentMethodType from verifyPaymentAttempt NetworkCallRequest body.
 * Body is a JSON string inside value.body.
 */
function instrumentFromVerifyRequest(log: ParsedLog): InstrumentType | null {
	const body = log.value?.body;
	if (typeof body !== 'string') return null;
	try {
		const parsed = JSON.parse(body);
		return mapToInstrument(parsed.paymentMethodType || parsed.paymentMethod || '');
	} catch {
		return null;
	}
}

/**
 * Extract instrument from PaymentInstrument.selectItem click.
 * value.info.pmt = "UPI", "UPI_INTENT", "EMI", "CONSUMER_FINANCE", "CARD" etc.
 */
function instrumentFromSelectItem(log: ParsedLog): InstrumentType | null {
	const info = log.value?.info as Record<string, unknown> | undefined;
	return mapToInstrument((info?.pmt as string) || (info?.pm as string) || '');
}

/**
 * Extract instrument from autoRetryTxn Info log.
 * value.info.instrument = "UPI_INTENT" etc.
 */
function instrumentFromAutoRetry(log: ParsedLog): InstrumentType | null {
	const info = log.value?.info as Record<string, unknown> | undefined;
	return mapToInstrument((info?.instrument as string) || '');
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

function markInstrumentFailure(metrics: SessionMetrics, instrument: InstrumentType): void {
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

	// Track current instrument being used across payment flow logs
	let lastInstrument: InstrumentType | null = null;
	let paymentSuccess = false;

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
			// Only count NetworkCallRequest as attempt (not response)
			if (log.event === 'NetworkCallRequest') {
				metrics.paymentAttemptCount++;
			}
			if (isResponse && failed) metrics.startPaymentApiFailure = true;
		}
		if (sourceMatches(source, PAYMENT_VERIFY_SOURCES)) {
			// verifyPaymentAttempt request has paymentMethodType in body
			if (log.event === 'NetworkCallRequest') {
				const inst = instrumentFromVerifyRequest(log);
				if (inst) lastInstrument = inst;
			}
			if (isResponse && failed) {
				metrics.txnPollFailureCount++;
			} else if (isResponse && !failed) {
				// verifyPaymentAttempt success (approve=true) = payment initiated successfully
				const resp = log.value?.response as Record<string, unknown> | undefined;
				if (resp?.approve === true) {
					metrics.txnInitiationSuccessCount++;
				}
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

		// --- HyperSDK / Instrument Detection ---
		if (sourceMatches(source, HYPERSDK_SOURCES)) {
			if (failed) metrics.hypersdkErrorCount++;

			// Detect instrument from processHeadless FunctionCalled action (upiTxn, cardTxn, etc.)
			if (log.event === 'FunctionCalled') {
				const inst = instrumentFromHeadlessAction(log);
				if (inst) lastInstrument = inst;
			}
		}

		// PaymentInstrument.selectItem click — user selected an instrument
		if (source === 'PaymentInstrument.selectItem' && log.event === 'Click') {
			const inst = instrumentFromSelectItem(log);
			if (inst) lastInstrument = inst;
		}

		// PaymentOptions.choosePaymentOption click — user chose a payment option group
		if (source === 'PaymentOptions.choosePaymentOption' && log.event === 'Click') {
			const info = log.value?.info as Record<string, unknown> | undefined;
			const po = info?.po as Record<string, unknown> | undefined;
			const inst = mapToInstrument((po?.pmt as string) || '');
			if (inst) lastInstrument = inst;
		}

		// autoRetryTxn — has instrument type and indicates a failure
		if (source === 'autoRetryTxn' && log.event === 'Info') {
			const info = log.value?.info as Record<string, unknown> | undefined;
			const inst = instrumentFromAutoRetry(log);
			if (inst) {
				lastInstrument = inst;
				// autoRetryTxn always means the previous attempt failed
				markInstrumentFailure(metrics, inst);
			}
		}

		// getEulerPaymentStatus response — actual payment outcome
		if (source === 'getEulerPaymentStatus' && log.event === 'NetworkCallResponse') {
			const resp = log.value?.response as Record<string, unknown> | undefined;
			const status = (resp?.status as string) || '';
			if (status === 'CHARGED') {
				paymentSuccess = true;
				metrics.txnInitiationSuccessCount++;
			} else if (status && status !== 'PENDING_VBV' && status !== 'NEW') {
				// Terminal failure states: AUTHENTICATION_FAILED, AUTHORIZATION_FAILED, JUSPAY_DECLINED, etc.
				if (lastInstrument) {
					markInstrumentFailure(metrics, lastInstrument);
				}
			}
			// PENDING_VBV means still in progress, don't count yet
		}

		// hyperCallbackHandler — check for txn results with errors
		if (source === 'hyperCallbackHandler' && log.event === 'Info') {
			const info = log.value?.info as Record<string, unknown> | undefined;
			const eventData = info?.event as Record<string, unknown> | undefined;
			const payload = eventData?.payload as Record<string, unknown> | undefined;
			if (payload) {
				const hasError = payload.error === true;
				const errorCode = payload.errorCode as string;
				if (hasError || (errorCode && errorCode !== '')) {
					if (lastInstrument) {
						markInstrumentFailure(metrics, lastInstrument);
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

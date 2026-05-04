// ─── Event Types (from Nimble's AnalyticsRequest.ts) ───
export type AnalyticsEvent =
	| 'NetworkCallRequest'
	| 'NetworkCallResponse'
	| 'PageRendered'
	| 'Click'
	| 'Input'
	| 'Hover'
	| 'Focus'
	| 'Error'
	| 'Exception'
	| 'FunctionCalled'
	| 'FunctionCallResult'
	| 'RequestReceived'
	| 'ResponseReturned'
	| 'SectionRendered'
	| 'Navigation'
	| 'DBQueryRequest'
	| 'DBQueryResult'
	| 'Info'
	| 'Debug';

export type InfoType = 'Info' | 'Debug' | 'Error' | 'Critical' | 'Warning' | 'Exception';

export type Context = 'App' | 'Server' | 'Backend' | 'Frontend';

// ─── Parsed Log Line ───
export interface ParsedLog {
	serialNumber: number;
	timestamp: string;
	sessionId: string;
	host: string;
	shop: string;
	checkoutId: string;
	context: Context;
	infoType: InfoType;
	event: AnalyticsEvent;
	source: string;
	value: Record<string, unknown> | null;
	rawTimestamp: string; // ES @timestamp
}

// ─── Session Metrics (computed per session) ───
export interface SessionMetrics {
	sessionId: string;
	shop: string;
	checkoutId: string;
	platform: string;
	device: string;

	// Auth
	otpSendFailureCount: number;
	otpVerifyFailureCount: number;

	// Offer
	offerApplyFailureCount: number;

	// Cart
	cartCreationFailureCount: number;

	// Payment Initiation
	startPaymentApiFailure: boolean;

	// Per Instrument Failures
	upiFailure: boolean;
	cardFailure: boolean;
	netbankingFailure: boolean;
	walletFailure: boolean;
	bnplFailure: boolean;
	codFailure: boolean;

	// Technical Errors
	apiErrorCount: number;
	exceptionCount: number;
	networkErrorCount: number;
	hypersdkErrorCount: number;

	// Address
	addressValidationFailureCount: number;
	addressSaveFailureCount: number;

	// Order
	orderCreationFailureCount: number;
	orderStatusFailureCount: number;
	paymentAttemptCount: number;

	// Transactions
	txnInitiationFailureCount: number;
	txnPollFailureCount: number;
	txnInitiationSuccessCount: number;

	// Custom Payment
	customPaymentFailureCount: number;

	// Funnel stages reached
	reachedAuth: boolean;
	reachedAuthSuccess: boolean;
	reachedAddress: boolean;
	reachedPayment: boolean;
	reachedOrder: boolean;

	// Meta
	logCount: number;
	firstTimestamp: string;
	lastTimestamp: string;
}

// ─── Dashboard Panel Data ───
export interface OverviewData {
	totalSessions: number;
	paymentSuccessRate: number;
	errorRate: number;
	exceptionCount: number;
	avgPaymentAttempts: number;
}

export interface FunnelData {
	sessionStarted: number;
	reachedAuth: number;
	reachedAuthSuccess: number;
	reachedAddress: number;
	reachedPayment: number;
	reachedOrder: number;
}

export interface ErrorBySource {
	source: string;
	count: number;
	sampleMessage?: string;
}

export interface FailureData {
	otpSendFailures: number;
	otpVerifyFailures: number;
	cartFailures: number;
	offerFailures: number;
	addressSaveFailures: number;
	addressValidationFailures: number;
	orderCreationFailures: number;
	orderStatusFailures: number;
	apiErrors: number;
	networkErrors: number;
	exceptions: number;
	hypersdkErrors: number;
	errorsBySource: ErrorBySource[];
}

export interface SessionSummary {
	sessionId: string;
	shop: string;
	platform: string;
	logCount: number;
	apiErrorCount: number;
	exceptionCount: number;
	paymentAttemptCount: number;
	txnInitiationSuccessCount: number;
	firstTimestamp: string;
	lastTimestamp: string;
	errorSources: string[];
}

export interface PaymentHealthData {
	totalAttempts: number;
	successCount: number;
	successRate: number;
	instrumentFailures: {
		upi: number;
		card: number;
		netbanking: number;
		wallet: number;
		bnpl: number;
		cod: number;
	};
	startPaymentFailures: number;
	txnPollFailures: number;
	customPaymentFailures: number;
}

export interface PlatformData {
	platform: string;
	sessions: number;
	errorRate: number;
	paymentSuccessRate: number;
}

export interface ShopData {
	shop: string;
	sessions: number;
	errorRate: number;
	paymentSuccessRate: number;
}

export interface TimeSeriesPoint {
	timestamp: string;
	value: number;
}

export interface ErrorLog {
	sessionId: string;
	shop: string;
	event: string;
	source: string;
	infoType: string;
	timestamp: string;
	value: Record<string, unknown> | null;
}

export interface DashboardResponse {
	overview: OverviewData;
	funnel: FunnelData;
	failures: FailureData;
	paymentHealth: PaymentHealthData;
	platforms: PlatformData[];
	topShops: ShopData[];
	timeSeries: {
		apiErrors: TimeSeriesPoint[];
		networkErrors: TimeSeriesPoint[];
		exceptions: TimeSeriesPoint[];
		paymentAttempts: TimeSeriesPoint[];
	};
	sessionCount: number;
	sessions: SessionSummary[];
	errorLogs: ErrorLog[];
	timeRange: { from: string; to: string };
}

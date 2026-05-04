// ─── Source names from Nimble codebase ───

// Auth
export const OTP_SEND_SOURCES = ['sendOTP', 'resendOTP'];
export const OTP_VERIFY_SOURCES = ['verifyOTP'];

// Cart
export const CART_CREATION_SOURCES = ['createCart'];

// Offer
export const OFFER_SOURCES = ['getOffersListV1', 'applyOffer'];

// Payment
export const START_PAYMENT_SOURCES = ['startPayment'];
export const PAYMENT_VERIFY_SOURCES = ['verifyPaymentAttempt'];
export const CUSTOM_PAYMENT_SOURCES = ['getCustomPaymentOptions', 'applyCustomInstrumentCredits'];

// Address
export const ADDRESS_SAVE_SOURCES = ['addNewAddress', 'saveAddress'];
export const ADDRESS_VALIDATE_SOURCES = ['getAddressValidation', 'validateAddress'];

// Order
export const ORDER_CREATION_SOURCES = ['createOrder', 'updateOrder'];
export const ORDER_STATUS_SOURCES = ['getOrderStatus'];

// HyperSDK
export const HYPERSDK_SOURCES = ['processHeadless', 'processHeadlessSync', 'processWidgetWithPayload', 'onSDKEvent'];

// Payment Instruments (detected from FunctionCalled/FunctionCallResult payload)
export const INSTRUMENT_KEYWORDS = {
	upi: ['UPI', 'upi', 'Upi'],
	card: ['CARD', 'card', 'Card', 'DEBIT_CARD', 'CREDIT_CARD'],
	netbanking: ['NB', 'NETBANKING', 'netbanking', 'NetBanking'],
	wallet: ['WALLET', 'wallet', 'Wallet'],
	bnpl: ['BNPL', 'bnpl', 'PayLater', 'PAY_LATER'],
	cod: ['COD', 'cod', 'CASH']
} as const;

// Origin filter
export const V2_ORIGIN_FILTER = 'app.v2.breeze.in';

// ES config
export const ES_ENDPOINT_RELEASE = 'https://kibana.sso.utils.breeze.juspay.net/_plugin/kibana/internal/search/es';
export const ES_INDEX = 'breeze-v2-*';
export const ES_MAX_SIZE = 4000;

// Processing limits
export const CHUNK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const CHUNK_CONCURRENCY = 5;
export const BATCH_SIZE = 25; // session_ids per ES query
export const BATCH_CONCURRENCY = 3;
export const MAX_SESSIONS = 500;
export const CACHE_TTL_MS = 30 * 1000; // 30 seconds

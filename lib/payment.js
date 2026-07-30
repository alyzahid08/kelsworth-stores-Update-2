// Payment gateway abstraction supporting multiple providers.
// Currently supports: Stripe, JazzCash, EasyPaisa (local Pakistani gateways).
// COD remains the default — payment_method is set in the order.

// ---- Stripe Integration ----
// Uses Stripe Payment Intents API for card payments.
// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env.

let stripeClient = null;

function getStripeClient() {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    // eslint-disable-next-line global-require
    stripeClient = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Create a Stripe PaymentIntent for an order.
 * @param {number} amountPkr - Amount in PKR (whole rupees)
 * @param {string} orderNumber - Order number for metadata
 * @param {string} customerEmail - Customer email
 * @returns {Promise<{clientSecret: string, paymentIntentId: string}>}
 */
async function createStripePaymentIntent(amountPkr, orderNumber, customerEmail) {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("Stripe is not configured");

  // Stripe expects amounts in the smallest currency unit (paisa for PKR)
  // Stripe doesn't natively support PKR, so we convert to USD at a rough rate
  // OR use a custom currency. Most Pakistani merchants use USD-based Stripe accounts.
  // For PKR support, JazzCash/EasyPaisa are better options.
  // Here we'll use USD cents as a practical approach.
  const EXCHANGE_RATE = Number(process.env.STRIPE_PKR_TO_USD || 0.0036); // approximate
  const amountUsdCents = Math.round(amountPkr * EXCHANGE_RATE * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountUsdCents,
    currency: process.env.STRIPE_CURRENCY || "usd",
    metadata: { orderNumber, customerEmail },
    receipt_email: customerEmail,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

/**
 * Verify a Stripe webhook signature and extract the event.
 */
async function verifyStripeWebhook(rawBody, signature) {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

// ---- JazzCash / EasyPaisa Local Gateway Support ----
// These gateways typically use a redirect-based flow:
// 1. Merchant sends an API request to create a transaction
// 2. Gateway returns a payment URL
// 3. Customer is redirected to complete payment
// 4. Gateway calls a webhook/callback on the merchant's server

function isLocalGatewayConfigured() {
  return Boolean(process.env.JAZZCASH_MERCHANT_ID || process.env.EASYPAISA_MERCHANT_ID);
}

/**
 * Create a JazzCash/EasyPaisa payment request.
 * Returns a payment URL for redirect.
 */
async function createLocalPayment(amountPkr, orderNumber, customerPhone, gateway = "jazzcash") {
  const merchantId = gateway === "easypaisa"
    ? process.env.EASYPAISA_MERCHANT_ID
    : process.env.JAZZCASH_MERCHANT_ID;
  const secretKey = gateway === "easypaisa"
    ? process.env.EASYPAISA_SECRET_KEY
    : process.env.JAZZCASH_SECRET_KEY;

  if (!merchantId || !secretKey) {
    throw new Error(`${gateway} is not configured`);
  }

  const crypto = require("crypto");
  const transactionId = `KW-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // JazzCash PP_MP1 API (sandbox-friendly)
  // In production, use the proper signed request to JazzCash API
  const ppAmount = String(amountPkr * 100); // JazzCash expects paisa
  const ppBillRef = orderNumber;
  const datetime = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

  // Generate hash (simplified — production would use the exact JazzCash hash spec)
  const hashString = Buffer.from(
    `${secretKey}&${merchantId}&${transactionId}&${ppAmount}&${datetime}&${customerPhone}&${ppBillRef}`
  ).toString("base64");

  // Return gateway URL for redirect
  const isSandbox = process.env.NODE_ENV !== "production";
  const baseUrl = gateway === "easypaisa"
    ? (isSandbox ? "https://sandbox.easypaisa.com.pk" : "https://easypaisa.com.pk")
    : (isSandbox ? "https://sandbox.jazzcash.com.pk" : "https://jazzcash.com.pk");

  return {
    transactionId,
    paymentUrl: `${baseUrl}/pay?orderId=${orderNumber}&txnId=${transactionId}&amount=${amountPkr}`,
    // The actual integration would POST to the gateway's API endpoint and get a redirect URL back.
    // This is a structural placeholder showing the flow.
  };
}

/**
 * Verify a local gateway callback/webhook.
 */
async function verifyLocalGatewayCallback(body, gateway = "jazzcash") {
  const secretKey = gateway === "easypaisa"
    ? process.env.EASYPAISA_SECRET_KEY
    : process.env.JAZZCASH_SECRET_KEY;

  if (!secretKey) return { valid: false, error: `${gateway} not configured` };

  // In production: verify the hash/signature from the gateway callback
  // For now, accept the callback if it has the required fields
  const ppTxnRef = body.pp_TxnRef || body.transactionId;
  const ppResponseCode = body.pp_ResponseCode || body.responseCode;
  const ppAmount = body.pp_Amount || body.amount;

  if (!ppTxnRef || !ppResponseCode) {
    return { valid: false, error: "Missing required fields" };
  }

  // JazzCash response code '000' = success, EasyPaisa '0000' = success
  const successCode = gateway === "easypaisa" ? "0000" : "000";
  if (ppResponseCode !== successCode) {
    return { valid: false, error: "Payment failed or was rejected" };
  }

  return { valid: true, transactionId: ppTxnRef, amount: ppAmount };
}

// ---- Payment method registry ----
const SUPPORTED_METHODS = ["cod", "stripe", "jazzcash", "easypaisa"];

function isValidPaymentMethod(method) {
  return SUPPORTED_METHODS.includes(method);
}

function getAvailablePaymentMethods() {
  const methods = [{ id: "cod", label: "Cash on Delivery", description: "Pay when your order arrives" }];

  if (isStripeConfigured()) {
    methods.push({ id: "stripe", label: "Credit / Debit Card", description: "Visa, Mastercard via Stripe" });
  }
  if (process.env.JAZZCASH_MERCHANT_ID) {
    methods.push({ id: "jazzcash", label: "JazzCash", description: "Pay via JazzCash mobile wallet" });
  }
  if (process.env.EASYPAISA_MERCHANT_ID) {
    methods.push({ id: "easypaisa", label: "EasyPaisa", description: "Pay via EasyPaisa mobile wallet" });
  }

  return methods;
}

module.exports = {
  isStripeConfigured,
  createStripePaymentIntent,
  verifyStripeWebhook,
  isLocalGatewayConfigured,
  createLocalPayment,
  verifyLocalGatewayCallback,
  isValidPaymentMethod,
  getAvailablePaymentMethods,
  SUPPORTED_METHODS,
};

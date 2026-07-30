const express = require("express");
const { query } = require("../db");
const { requireCustomer, attachCustomerIfPresent } = require("../middleware/customerAuth");
const {
  isStripeConfigured,
  createStripePaymentIntent,
  verifyStripeWebhook,
  isLocalGatewayConfigured,
  createLocalPayment,
  verifyLocalGatewayCallback,
  isValidPaymentMethod,
  getAvailablePaymentMethods,
} = require("../lib/payment");

const router = express.Router();

// GET /api/payment/methods — list available payment methods
router.get("/methods", (req, res) => {
  res.json(getAvailablePaymentMethods());
});

// POST /api/payment/create-intent — create a payment intent for an order total
// This is called before placing the actual order, to get a clientSecret for the frontend.
router.post("/create-intent", async (req, res) => {
  const { amount, paymentMethod, orderNumber, email, phone } = req.body || {};

  if (!amount || !paymentMethod) {
    return res.status(400).json({ error: "Amount and payment method are required" });
  }
  if (!isValidPaymentMethod(paymentMethod)) {
    return res.status(400).json({ error: "Unsupported payment method" });
  }
  if (paymentMethod === "cod") {
    return res.json({ paymentMethod: "cod", clientSecret: null });
  }

  try {
    if (paymentMethod === "stripe") {
      if (!isStripeConfigured()) {
        return res.status(400).json({ error: "Stripe payments are not available" });
      }
      const result = await createStripePaymentIntent(amount, orderNumber, email);
      return res.json({
        paymentMethod: "stripe",
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
      });
    }

    if (paymentMethod === "jazzcash" || paymentMethod === "easypaisa") {
      if (!isLocalGatewayConfigured()) {
        return res.status(400).json({ error: `${paymentMethod} payments are not available` });
      }
      const result = await createLocalPayment(amount, orderNumber, phone, paymentMethod);
      return res.json({
        paymentMethod,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
      });
    }

    res.status(400).json({ error: "Unsupported payment method" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create payment" });
  }
});

// POST /api/payment/webhook/stripe — Stripe webhook endpoint
// Stripe sends events here when payment succeeds/fails.
// Requires raw body for signature verification.
router.post("/webhook/stripe", express.json({ type: 'application/json' }), async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).json({ error: "Missing signature" });

  try {
    const event = verifyStripeWebhook(req.rawBody || JSON.stringify(req.body), sig);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const orderNumber = paymentIntent.metadata?.orderNumber;

      if (orderNumber) {
        await query(
          `UPDATE orders
           SET payment_status = 'paid', payment_intent_id = $1
           WHERE order_number = $2 AND payment_method = 'stripe' AND payment_status = 'pending'`,
          [paymentIntent.id, orderNumber]
        );
        console.log(`[payment] Stripe payment succeeded for order ${orderNumber}`);
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const orderNumber = paymentIntent.metadata?.orderNumber;
      if (orderNumber) {
        await query(
          `UPDATE orders
           SET payment_status = 'failed'
           WHERE order_number = $2 AND payment_method = 'stripe' AND payment_status = 'pending'`,
          [paymentIntent.id, orderNumber]
        );
        console.log(`[payment] Stripe payment failed for order ${orderNumber}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[payment] Stripe webhook error:", err.message);
    res.status(400).json({ error: "Webhook signature verification failed" });
  }
});

// POST /api/payment/webhook/jazzcash — JazzCash callback endpoint
router.post("/webhook/jazzcash", async (req, res) => {
  try {
    const result = await verifyLocalGatewayCallback(req.body, "jazzcash");
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    await query(
      `UPDATE orders
       SET payment_status = 'paid', gateway_transaction_id = $1
       WHERE order_number = $2 AND payment_method = 'jazzcash' AND payment_status = 'pending'`,
      [result.transactionId, req.body.pp_BillRef]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[payment] JazzCash webhook error:", err.message);
    res.status(400).json({ error: "Verification failed" });
  }
});

// POST /api/payment/webhook/easypaisa — EasyPaisa callback endpoint
router.post("/webhook/easypaisa", async (req, res) => {
  try {
    const result = await verifyLocalGatewayCallback(req.body, "easypaisa");
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    await query(
      `UPDATE orders
       SET payment_status = 'paid', gateway_transaction_id = $1
       WHERE order_number = $2 AND payment_method = 'easypaisa' AND payment_status = 'pending'`,
      [result.transactionId, req.body.orderId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[payment] EasyPaisa webhook error:", err.message);
    res.status(400).json({ error: "Verification failed" });
  }
});

module.exports = router;

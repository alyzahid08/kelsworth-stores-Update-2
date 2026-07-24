const express = require("express");
const crypto = require("crypto");
const { query, withTransaction } = require("../db");
const { validatePromoCode } = require("../lib/promo");
const { sendOrderConfirmation } = require("../lib/email");
const { attachCustomerIfPresent } = require("../middleware/customerAuth");

const router = express.Router();

const SHIP_THRESHOLD = 5000;
const SHIP_FLAT = 250;
// Kelsworth's prices are tax-inclusive today, so this is 0 — it's a real
// column on the order and a real line in every total, ready to switch on
// without touching the checkout flow or migrating existing orders.
const TAX_RATE = 0;

// Loose on purpose: accepts spaces/dashes/parentheses and an optional
// country code, just makes sure there's a plausible run of 10-13 digits.
function isPlausiblePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

// Thrown for problems the customer can fix (bad size, out of stock, bad promo
// code) so the route handler can return a clean 400 instead of a generic 500.
class OrderError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

function generateOrderNumber() {
  return "KW-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function uniqueOrderNumber(client) {
  for (let i = 0; i < 5; i++) {
    const candidate = generateOrderNumber();
    const { rows } = await client.query("SELECT 1 FROM orders WHERE order_number = $1", [candidate]);
    if (!rows.length) return candidate;
  }
  throw new Error("Could not generate a unique order number");
}

// POST /api/orders — place an order.
// - Prices are recomputed server-side from the database, never trusted from
//   the browser, so nobody can tamper with totals from the client.
// - Stock is checked and decremented inside one locked transaction, so two
//   customers buying the last unit at the same time can't both succeed.
// - If the visitor is logged in (customer cookie present), the order is
//   linked to their account; otherwise it's saved as a guest order.
router.post("/", attachCustomerIfPresent, async (req, res) => {
  const { items, customer, promoCode, deliveryNotes, giftMessage, saveAddress } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty" });
  }
  const required = ["firstName", "lastName", "email", "phone", "address", "city"];
  for (const field of required) {
    if (!customer || !customer[field] || !String(customer[field]).trim()) {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }
  if (!isPlausiblePhone(customer.phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number" });
  }

  try {
    const result = await withTransaction(async (client) => {
      const lineItems = [];
      let subtotal = 0;

      for (const item of items) {
        const { rows } = await client.query(
          "SELECT * FROM products WHERE slug = $1 AND active = true FOR UPDATE",
          [item.productId]
        );
        const product = rows[0];
        if (!product) throw new OrderError(`Product ${item.productId} is no longer available`);

        const sizes = product.sizes || [];
        if (!sizes.includes(item.size)) {
          throw new OrderError(`${product.name} is not available in size ${item.size}`);
        }

        const qty = Math.max(1, Math.min(10, parseInt(item.qty, 10) || 1));
        const stockBySize = product.stock_by_size || {};
        const sizeHasTrackedStock = Object.prototype.hasOwnProperty.call(stockBySize, item.size);

        // If this size has explicit tracked stock, enforce it exactly.
        // If not (e.g. an older product that hasn't been given per-size
        // stock yet), fall back to allowing the order so nothing already
        // live on the store breaks — the admin panel can set exact stock
        // per size going forward.
        if (sizeHasTrackedStock && Number(stockBySize[item.size]) < qty) {
          const available = Number(stockBySize[item.size]);
          throw new OrderError(
            available > 0
              ? `Only ${available} left of ${product.name} in size ${item.size}`
              : `${product.name} in size ${item.size} is out of stock`
          );
        }

        const unitPrice = product.sale_price ?? product.price;
        subtotal += unitPrice * qty;
        lineItems.push({
          productId: product.id,
          productName: product.name,
          size: item.size,
          qty,
          unitPrice,
          sizeHasTrackedStock,
          newStockForSize: sizeHasTrackedStock ? Number(stockBySize[item.size]) - qty : null,
          stockBySize,
        });
      }

      let discount = 0;
      let appliedPromoCode = null;
      if (promoCode && String(promoCode).trim()) {
        const promoResult = await validatePromoCode(promoCode, subtotal);
        if (!promoResult.valid) throw new OrderError(promoResult.error);
        discount = promoResult.discountAmount;
        appliedPromoCode = promoResult.code;
      }

      const shipping = subtotal >= SHIP_THRESHOLD ? 0 : SHIP_FLAT;
      const tax = Math.round(subtotal * TAX_RATE);
      const total = subtotal + shipping + tax - discount;
      const orderNumber = await uniqueOrderNumber(client);
      const customerId = req.customer ? req.customer.sub : null;

      const { rows: orderRows } = await client.query(
        `INSERT INTO orders
          (order_number, customer_id, first_name, last_name, email, phone, address, city, postal_code, payment_method, promo_code, subtotal, shipping, discount, total, delivery_notes, gift_message, tax)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          orderNumber,
          customerId,
          customer.firstName.trim(),
          customer.lastName.trim(),
          customer.email.trim(),
          customer.phone.trim(),
          customer.address.trim(),
          customer.city.trim(),
          (customer.postalCode || "").trim(),
          "cod",
          appliedPromoCode,
          subtotal,
          shipping,
          discount,
          total,
          (deliveryNotes || "").trim() || null,
          (giftMessage || "").trim() || null,
          tax,
        ]
      );
      const order = orderRows[0];

      // Logged-in customers can opt to keep this shipping address on file
      // for next time — never happens for guest checkouts (no account to
      // attach it to).
      if (customerId && saveAddress) {
        await client.query(
          `INSERT INTO customer_addresses (customer_id, label, first_name, last_name, phone, address, city, postal_code, is_default)
           VALUES ($1,'Home',$2,$3,$4,$5,$6,$7, NOT EXISTS (SELECT 1 FROM customer_addresses WHERE customer_id = $1))`,
          [
            customerId, customer.firstName.trim(), customer.lastName.trim(), customer.phone.trim(),
            customer.address.trim(), customer.city.trim(), (customer.postalCode || "").trim(),
          ]
        );
      }

      for (const li of lineItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, size, qty, unit_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, li.productId, li.productName, li.size, li.qty, li.unitPrice]
        );

        if (li.sizeHasTrackedStock) {
          const updatedStockBySize = { ...li.stockBySize, [li.size]: Math.max(0, li.newStockForSize) };
          await client.query(
            "UPDATE products SET stock_by_size = $1, stock = GREATEST(stock - $2, 0) WHERE id = $3",
            [JSON.stringify(updatedStockBySize), li.qty, li.productId]
          );
        } else {
          await client.query(
            "UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2",
            [li.qty, li.productId]
          );
        }
      }

      return { order, lineItems };
    });

    const { order, lineItems } = result;

    // Order is already saved at this point — email is best-effort and never
    // blocks or fails the response back to the customer.
    sendOrderConfirmation(order, lineItems.map((li) => ({ product_name: li.productName, size: li.size, qty: li.qty, unit_price: li.unitPrice })));

    res.status(201).json({
      orderNumber: order.order_number,
      subtotal: order.subtotal,
      shipping: order.shipping,
      tax: order.tax,
      discount: order.discount,
      total: order.total,
      giftMessage: order.gift_message,
    });
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Could not place your order. Please try again." });
  }
});

// GET /api/orders/lookup?orderNumber=KW-XXXX&email=... — lets a customer
// check their own order status without logging into the admin panel.
router.get("/lookup", async (req, res) => {
  const { orderNumber, email } = req.query;
  if (!orderNumber || !email) {
    return res.status(400).json({ error: "orderNumber and email are required" });
  }
  try {
    const { rows } = await query(
      "SELECT * FROM orders WHERE order_number = $1 AND email = $2",
      [orderNumber, email]
    );
    if (!rows.length) return res.status(404).json({ error: "No matching order found" });
    const order = rows[0];
    const { rows: items } = await query(
      "SELECT product_name, size, qty, unit_price FROM order_items WHERE order_id = $1",
      [order.id]
    );
    res.json({ ...order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not look up order" });
  }
});

module.exports = router;

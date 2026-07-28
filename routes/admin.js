const express = require("express");
const { query } = require("../db");
const { requireAdminApi } = require("../middleware/auth");
const { sendOrderStatusUpdate } = require("../lib/email");

const router = express.Router();
router.use(requireAdminApi);

/* ---------------------------- Orders ---------------------------- */

// GET /api/admin/orders?status=pending&q=search
router.get("/orders", async (req, res) => {
  const { status, q } = req.query;
  const clauses = [];
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(
      `(order_number ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR (first_name || ' ' || last_name) ILIKE $${params.length})`
    );
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  try {
    const { rows } = await query(
      `SELECT id, order_number, first_name, last_name, email, phone, city, total, status, created_at
       FROM orders ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load orders" });
  }
});

// GET /api/admin/orders/:id — full order detail with line items
router.get("/orders/:id", async (req, res) => {
  try {
    const { rows: orderRows } = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!orderRows.length) return res.status(404).json({ error: "Order not found" });
    const { rows: items } = await query(
      "SELECT product_name, size, qty, unit_price FROM order_items WHERE order_id = $1",
      [req.params.id]
    );
    res.json({ ...orderRows[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load order" });
  }
});

const VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

// PATCH /api/admin/orders/:id — update order status
router.patch("/orders/:id", async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  try {
    const { rows } = await query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Order not found" });
    // Best-effort, same pattern as the confirmation email at checkout — never
    // let a slow/failed email hold up or fail the status update itself.
    sendOrderStatusUpdate(rows[0]);
    res.json({ id: rows[0].id, status: rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update order" });
  }
});

/* --------------------------- Products --------------------------- */

// GET /api/admin/products — includes inactive products, unlike the public API
router.get("/products", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM products ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load products" });
  }
});

function validateProductBody(body) {
  const required = ["slug", "name", "category", "fit", "color", "price", "sizes", "image"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  if (!Array.isArray(body.sizes) || body.sizes.length === 0) {
    return "Sizes must be a non-empty list";
  }
  if (isNaN(Number(body.price))) return "Price must be a number";
  return null;
}

// Sums a { "30": 12, "32": 8 } style map into a single total, for the
// legacy `stock` column that the admin table still shows at a glance.
function sumStockBySize(stockBySize) {
  if (!stockBySize || typeof stockBySize !== "object") return null;
  return Object.values(stockBySize).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

// POST /api/admin/products — create
router.post("/products", async (req, res) => {
  const body = req.body || {};
  const error = validateProductBody(body);
  if (error) return res.status(400).json({ error });

  const stockBySize = body.stockBySize && typeof body.stockBySize === "object" ? body.stockBySize : {};
  const totalStock = body.stock !== undefined ? Number(body.stock) : sumStockBySize(stockBySize) ?? 100;
  const images = Array.isArray(body.images) ? body.images : [];
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const skuBySize = body.skuBySize && typeof body.skuBySize === "object" ? body.skuBySize : {};
  const completeTheLook = Array.isArray(body.completeTheLook) ? body.completeTheLook : [];
  const frequentlyBoughtWith = Array.isArray(body.frequentlyBoughtWith) ? body.frequentlyBoughtWith : [];

  try {
    const { rows } = await query(
      `INSERT INTO products
        (slug, name, category, fit, color, price, sale_price, sizes, image, badge, description, fabric, care, stock, stock_by_size, active,
         images, video_url, tags, sku, sku_by_size, style_code, size_type, low_stock_threshold, complete_the_look, frequently_bought_with,
         estimated_delivery, return_policy, material, stretch, collection, is_bestseller)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
               $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
               COALESCE($27, '3–5 working days in major cities, 5–7 elsewhere'),
               COALESCE($28, 'Free exchange within 14 days of delivery, tags attached and unworn.'),
               $29, $30, $31, $32)
       RETURNING *`,
      [
        body.slug, body.name, body.category, body.fit, body.color,
        Number(body.price), body.salePrice ? Number(body.salePrice) : null,
        JSON.stringify(body.sizes), body.image, body.badge || null,
        body.description || "", body.fabric || "", body.care || "",
        totalStock, JSON.stringify(stockBySize),
        body.active !== undefined ? Boolean(body.active) : true,
        JSON.stringify(images), body.videoUrl || null, JSON.stringify(tags),
        body.sku || null, JSON.stringify(skuBySize), body.styleCode || null,
        body.sizeType || "standard", body.lowStockThreshold !== undefined ? Number(body.lowStockThreshold) : 5,
        JSON.stringify(completeTheLook), JSON.stringify(frequentlyBoughtWith),
        body.estimatedDelivery || null, body.returnPolicy || null,
        body.material || null, body.stretch || "none", body.collection || null,
        Boolean(body.isBestseller),
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "A product with that slug already exists" });
    res.status(500).json({ error: "Could not create product" });
  }
});

// PATCH /api/admin/products/:id — update any subset of fields
router.patch("/products/:id", async (req, res) => {
  const body = req.body || {};
  const fieldMap = {
    slug: "slug", name: "name", category: "category", fit: "fit", color: "color",
    price: "price", salePrice: "sale_price", image: "image", badge: "badge",
    description: "description", fabric: "fabric", care: "care", active: "active",
    videoUrl: "video_url", sku: "sku", styleCode: "style_code", sizeType: "size_type",
    lowStockThreshold: "low_stock_threshold", estimatedDelivery: "estimated_delivery",
    returnPolicy: "return_policy", material: "material", stretch: "stretch", collection: "collection",
    isBestseller: "is_bestseller",
  };
  const jsonFieldMap = {
    images: "images", tags: "tags", skuBySize: "sku_by_size",
    completeTheLook: "complete_the_look", frequentlyBoughtWith: "frequently_bought_with",
  };
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      params.push(body[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  for (const [key, column] of Object.entries(jsonFieldMap)) {
    if (body[key] !== undefined) {
      params.push(JSON.stringify(body[key]));
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (body.sizes !== undefined) {
    params.push(JSON.stringify(body.sizes));
    sets.push(`sizes = $${params.length}`);
  }
  if (body.stockBySize !== undefined) {
    params.push(JSON.stringify(body.stockBySize));
    sets.push(`stock_by_size = $${params.length}`);
    // Keep the legacy total roughly in sync whenever per-size stock is edited,
    // unless the caller also explicitly sent a `stock` value (handled below).
    if (body.stock === undefined) {
      params.push(sumStockBySize(body.stockBySize) ?? 0);
      sets.push(`stock = $${params.length}`);
    }
  }
  if (body.stock !== undefined) {
    params.push(Number(body.stock));
    sets.push(`stock = $${params.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: "No fields to update" });

  params.push(req.params.id);
  try {
    const { rows } = await query(
      `UPDATE products SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "A product with that slug already exists" });
    res.status(500).json({ error: "Could not update product" });
  }
});

// DELETE /api/admin/products/:id
router.delete("/products/:id", async (req, res) => {
  try {
    const { rows } = await query("DELETE FROM products WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Product not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete product" });
  }
});

/* --------------------------- Contact Messages --------------------------- */

// GET /api/admin/contact-messages
router.get("/contact-messages", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load messages" });
  }
});

// PATCH /api/admin/contact-messages/:id — mark read/unread
router.patch("/contact-messages/:id", async (req, res) => {
  const { isRead } = req.body || {};
  try {
    const { rows } = await query(
      "UPDATE contact_messages SET is_read = $1 WHERE id = $2 RETURNING id",
      [Boolean(isRead), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Message not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update message" });
  }
});

// DELETE /api/admin/contact-messages/:id
router.delete("/contact-messages/:id", async (req, res) => {
  try {
    const { rows } = await query("DELETE FROM contact_messages WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Message not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete message" });
  }
});

/* --------------------------- Reviews (moderation) --------------------------- */

// GET /api/admin/reviews — most recent reviews across all products
router.get("/reviews", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.*, p.name AS product_name, p.slug AS product_slug
       FROM product_reviews r JOIN products p ON p.id = r.product_id
       ORDER BY r.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load reviews" });
  }
});

// DELETE /api/admin/reviews/:id — remove a review (e.g. abusive/spam content)
router.delete("/reviews/:id", async (req, res) => {
  try {
    const { rows } = await query("DELETE FROM product_reviews WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Review not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete review" });
  }
});

/* -------------------------- Promo Codes -------------------------- */

// GET /api/admin/promo-codes
router.get("/promo-codes", async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM promo_codes ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load promo codes" });
  }
});

// POST /api/admin/promo-codes
router.post("/promo-codes", async (req, res) => {
  const { code, discountPercent, minSubtotal, expiresAt, active } = req.body || {};
  if (!code || !String(code).trim()) return res.status(400).json({ error: "Code is required" });
  const pct = Number(discountPercent);
  if (isNaN(pct) || pct <= 0 || pct > 100) {
    return res.status(400).json({ error: "Discount percent must be between 1 and 100" });
  }
  try {
    const { rows } = await query(
      `INSERT INTO promo_codes (code, discount_percent, min_subtotal, expires_at, active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        String(code).trim().toUpperCase(),
        pct,
        minSubtotal ? Number(minSubtotal) : 0,
        expiresAt || null,
        active !== undefined ? Boolean(active) : true,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "That code already exists" });
    res.status(500).json({ error: "Could not create promo code" });
  }
});

// PATCH /api/admin/promo-codes/:id
router.patch("/promo-codes/:id", async (req, res) => {
  const { active } = req.body || {};
  if (active === undefined) return res.status(400).json({ error: "Nothing to update" });
  try {
    const { rows } = await query(
      "UPDATE promo_codes SET active = $1 WHERE id = $2 RETURNING *",
      [Boolean(active), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Promo code not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update promo code" });
  }
});

// DELETE /api/admin/promo-codes/:id
router.delete("/promo-codes/:id", async (req, res) => {
  try {
    const { rows } = await query("DELETE FROM promo_codes WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Promo code not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete promo code" });
  }
});

/* ---------------------------- Analytics ---------------------------- */

// GET /api/admin/analytics — everything the dashboard needs in one call.
// Aggregation happens in SQL (not by pulling every order into JS), so this
// stays fast as the order/product tables grow.
router.get("/analytics", async (req, res) => {
  try {
    const [
      { rows: totalsRows },
      { rows: dailyRows },
      { rows: bestSellers },
      { rows: customerTotals },
      { rows: topCustomers },
      { rows: stockRows },
    ] = await Promise.all([
      query(`
        SELECT
          COALESCE(SUM(total) FILTER (WHERE status != 'cancelled'), 0)::int AS total_revenue,
          COALESCE(SUM(total) FILTER (WHERE status != 'cancelled' AND created_at >= date_trunc('month', now())), 0)::int AS revenue_this_month,
          COALESCE(SUM(total) FILTER (WHERE status != 'cancelled' AND created_at >= date_trunc('day', now())), 0)::int AS revenue_today,
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_orders,
          COUNT(*) FILTER (WHERE status = 'shipped')::int AS shipped_orders,
          COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
          COUNT(*) FILTER (WHERE customer_id IS NOT NULL)::int AS account_orders,
          COUNT(*) FILTER (WHERE customer_id IS NULL)::int AS guest_orders,
          COALESCE(AVG(total) FILTER (WHERE status != 'cancelled'), 0)::int AS avg_order_value
        FROM orders
      `),
      query(`
        SELECT date_trunc('day', created_at)::date AS day,
               COALESCE(SUM(total), 0)::int AS revenue,
               COUNT(*)::int AS orders
        FROM orders
        WHERE status != 'cancelled' AND created_at >= now() - interval '30 days'
        GROUP BY day
        ORDER BY day
      `),
      query(`
        SELECT oi.product_name,
               SUM(oi.qty)::int AS units_sold,
               SUM(oi.qty * oi.unit_price)::int AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
        GROUP BY oi.product_name
        ORDER BY units_sold DESC
        LIMIT 8
      `),
      query(`
        SELECT COUNT(*)::int AS total_customers,
               COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS new_this_month
        FROM customers
      `),
      query(`
        SELECT c.first_name, c.last_name, c.email,
               COUNT(o.id)::int AS order_count,
               SUM(o.total)::int AS total_spent
        FROM customers c
        JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelled'
        GROUP BY c.id
        ORDER BY total_spent DESC
        LIMIT 5
      `),
      query(`
        SELECT id, name, slug, sizes, stock_by_size, low_stock_threshold
        FROM products WHERE active = true
      `),
    ]);

    // Fill in any of the last 30 days that had zero orders, so the chart
    // doesn't just skip gaps.
    const dailyMap = new Map(dailyRows.map((r) => [r.day.toISOString().slice(0, 10), r]));
    const daily = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = dailyMap.get(key);
      daily.push({ day: key, revenue: found ? found.revenue : 0, orders: found ? found.orders : 0 });
    }

    // Small catalog, so computing this in JS is simpler and just as fast as
    // a JSONB-unnesting query would be.
    const lowStockProducts = [];
    for (const p of stockRows) {
      const stockBySize = p.stock_by_size || {};
      const threshold = p.low_stock_threshold ?? 5;
      const sizes = p.sizes || [];
      const lowSizes = sizes.filter((s) => Number(stockBySize[s] ?? 0) <= threshold);
      if (lowSizes.length) {
        lowStockProducts.push({
          name: p.name,
          slug: p.slug,
          lowSizes: lowSizes.map((s) => ({ size: s, stock: Number(stockBySize[s] ?? 0) })),
        });
      }
    }
    lowStockProducts.sort((a, b) => Math.min(...a.lowSizes.map((s) => s.stock)) - Math.min(...b.lowSizes.map((s) => s.stock)));

    res.json({
      ...totalsRows[0],
      ...customerTotals[0],
      dailyRevenue: daily,
      bestSellers,
      topCustomers,
      lowStockProducts: lowStockProducts.slice(0, 12),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load analytics" });
  }
});

module.exports = router;

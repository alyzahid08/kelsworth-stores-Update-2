require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const { requireAdminPage } = require("./middleware/auth");
const productsRoute = require("./routes/products");
const ordersRoute = require("./routes/orders");
const adminAuthRoute = require("./routes/adminAuth");
const adminRoute = require("./routes/admin");
const customersRoute = require("./routes/customers");
const promoRoute = require("./routes/promo");

const app = express();

// Default 100kb is too small once review photo uploads (base64 data URLs)
// are allowed through this same JSON body — raised for that, everything
// else still posts well under this.
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

// ---- Health check (used by most hosting platforms) ----
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ---- API routes ----
app.use("/api/products", productsRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/customers", customersRoute);
app.use("/api/promo", promoRoute);
app.use("/api/admin", adminAuthRoute);
app.use("/api/admin", adminRoute);

// ---- Admin panel (protected static HTML) ----
// login.html stays open; everything else under /admin requires a valid session.
app.get("/admin/dashboard.html", requireAdminPage, (req, res) =>
  res.sendFile(path.join(__dirname, "admin", "dashboard.html"))
);
app.get("/admin/index.html", requireAdminPage, (req, res) =>
  res.sendFile(path.join(__dirname, "admin", "index.html"))
);
app.get("/admin/products.html", requireAdminPage, (req, res) =>
  res.sendFile(path.join(__dirname, "admin", "products.html"))
);
app.get("/admin/promo-codes.html", requireAdminPage, (req, res) =>
  res.sendFile(path.join(__dirname, "admin", "promo-codes.html"))
);
app.get("/admin/", requireAdminPage, (req, res) =>
  res.sendFile(path.join(__dirname, "admin", "dashboard.html"))
);
app.use("/admin", express.static(path.join(__dirname, "admin")));

// ---- Public storefront (static site) ----
app.use(express.static(path.join(__dirname, "public")));

// Friendly JSON 404 for unmatched API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Kelsworth server running on port ${PORT}`);
});

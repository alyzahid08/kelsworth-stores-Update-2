/* Kelsworth — API client
   Talks to the Express backend instead of using a static product array. */

let _productsCache = null;
const PRODUCTS_CACHE_KEY = "vw_products_cache_v1";
const PRODUCTS_CACHE_TTL_MS = 60 * 1000; // short — admin edits should show up quickly

async function fetchProducts() {
  if (_productsCache) return _productsCache;

  // This is a full multi-page site (no SPA router), so every navigation is a
  // fresh page load — an in-memory cache alone only helps within one page.
  // A short-lived sessionStorage cache means clicking Home → Collection →
  // Product → Cart doesn't refetch the whole catalog at every stop.
  try {
    const cached = JSON.parse(sessionStorage.getItem(PRODUCTS_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.at < PRODUCTS_CACHE_TTL_MS) {
      _productsCache = cached.data;
      return _productsCache;
    }
  } catch (e) {}

  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Failed to load products");
  _productsCache = await res.json();
  try {
    sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ at: Date.now(), data: _productsCache }));
  } catch (e) {}
  return _productsCache;
}

async function searchProducts(q, limit = 6) {
  const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  if (!res.ok) return { query: q, products: [], categories: [] };
  return res.json();
}

async function submitContactMessage(payload) {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not send your message");
  return data;
}

async function fetchFeaturedReviews(limit = 6) {
  const res = await fetch(`/api/products/reviews/featured?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchProductById(id) {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchProductVariants(id) {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}/variants`);
  if (!res.ok) return { colorVariants: [], completeTheLook: [], frequentlyBoughtWith: [], related: [] };
  return res.json();
}

async function fetchProductReviews(id, { sort, rating } = {}) {
  const params = new URLSearchParams();
  if (sort) params.set("sort", sort);
  if (rating) params.set("rating", rating);
  const qs = params.toString();
  const res = await fetch(`/api/products/${encodeURIComponent(id)}/reviews${qs ? `?${qs}` : ""}`);
  if (!res.ok) return { average: 0, total: 0, countsByRating: {}, reviews: [] };
  return res.json();
}

async function submitReview(id, payload) {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not submit your review");
  return data;
}

// Guests can still mark a review helpful — a small anonymous id is kept in
// localStorage so the same visitor can't vote twice, without requiring login.
function getAnonId() {
  let id = localStorage.getItem("vw_anon_id");
  if (!id) {
    id = "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("vw_anon_id", id);
  }
  return id;
}

async function voteReviewHelpful(productId, reviewId) {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews/${reviewId}/helpful`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonId: getAnonId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not register your vote");
  return data;
}

async function submitOrder(payload) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not place your order");
  return data;
}

async function lookupOrder(orderNumber, email) {
  const params = new URLSearchParams({ orderNumber, email });
  const res = await fetch(`/api/orders/lookup?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not find that order");
  return data;
}

async function validatePromoCode(code, subtotal) {
  const res = await fetch("/api/promo/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, subtotal }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "That code isn't valid");
  return data;
}

/* ---------------------------- Customer accounts ---------------------------- */

async function registerCustomer(payload) {
  const res = await fetch("/api/customers/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not create account");
  return data;
}

async function loginCustomer(email, password) {
  const res = await fetch("/api/customers/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

async function logoutCustomer() {
  await fetch("/api/customers/logout", { method: "POST" });
}

async function fetchCustomerMe() {
  const res = await fetch("/api/customers/me");
  if (!res.ok) return null;
  return res.json();
}

async function fetchCustomerOrders() {
  const res = await fetch("/api/customers/orders");
  if (!res.ok) throw new Error("Could not load your orders");
  return res.json();
}

async function updateCustomerProfile(payload) {
  const res = await fetch("/api/customers/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not update your profile");
  return data;
}

async function fetchWishlist() {
  const res = await fetch("/api/customers/wishlist");
  if (!res.ok) return [];
  return res.json();
}

async function addToWishlist(productId) {
  const res = await fetch("/api/customers/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not add to wishlist");
  return data;
}

async function removeFromWishlist(productId) {
  const res = await fetch(`/api/customers/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not remove from wishlist");
  return data;
}

async function fetchAddresses() {
  const res = await fetch("/api/customers/addresses");
  if (!res.ok) return [];
  return res.json();
}

async function saveAddress(payload) {
  const res = await fetch("/api/customers/addresses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save address");
  return data;
}

async function deleteAddress(id) {
  const res = await fetch(`/api/customers/addresses/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not delete address");
  return data;
}

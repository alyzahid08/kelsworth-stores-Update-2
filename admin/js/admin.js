/* Kelsworth — admin panel shared chrome + fetch wrapper */

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 401) {
    location.href = "/admin/login.html";
    throw new Error("Not authenticated");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function sidebarHTML(active) {
  return `
  <a href="dashboard.html" class="logo" style="display:block"><img src="/images/logo-wordmark-light.svg" alt="Kelsworth" style="height:20px" /></a>
  <nav class="admin-nav">
    <a href="dashboard.html" class="${active === "dashboard" ? "active" : ""}">Dashboard</a>
    <a href="index.html" class="${active === "orders" ? "active" : ""}">Orders</a>
    <a href="products.html" class="${active === "products" ? "active" : ""}">Products</a>
    <a href="promo-codes.html" class="${active === "promo" ? "active" : ""}">Promo Codes</a>
    <a href="/" target="_blank">View Store ↗</a>
  </nav>
  <div class="spacer"></div>
  <button class="logout-btn" id="logoutBtn">Log Out</button>`;
}

function mountAdminChrome(active) {
  const el = document.getElementById("adminSidebar");
  if (el) el.innerHTML = sidebarHTML(active);
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/api/admin/logout", { method: "POST" });
      location.href = "/admin/login.html";
    });
  }
}

function formatPKR(amount) {
  return "Rs. " + Number(amount).toLocaleString("en-PK");
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

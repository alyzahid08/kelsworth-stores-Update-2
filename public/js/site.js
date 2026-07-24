/* Kelsworth — shared chrome
   Injects the header and footer into every page from one place, so nav
   links / copy only need to change here. */

const CART_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
const ACCOUNT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4S18.8 16.4 20 20"/></svg>`;
const WISHLIST_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20.5S3.5 15.4 3.5 9.4A4.9 4.9 0 0 1 12 6.2a4.9 4.9 0 0 1 8.5 3.2c0 6-8.5 11.1-8.5 11.1Z"/></svg>`;
const MENU_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 5l14 14M19 5 5 19"/></svg>`;

const NAV_LINKS = [
  { label: "Home", href: "index.html", key: "home" },
  { label: "Men's Denim", href: "collection.html", key: "collection" },
  { label: "Jackets", href: "collection.html?category=jackets", key: "jackets" },
  { label: "Shirts", href: "collection.html?category=polos", key: "shirts" },
  { label: "Sale", href: "collection.html?sale=1", key: "sale" },
];

// Update these with the store's real handles/URLs — the icons link out as
// soon as they're filled in, and any left as "#" simply don't render.
const SOCIAL_LINKS = {
  instagram: "https://instagram.com/kelsworth",
  facebook: "https://facebook.com/kelsworth",
  tiktok: "https://tiktok.com/@kelsworth",
  whatsapp: "https://wa.me/923000000000",
};

const SOCIAL_ICONS = {
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 8.5h2.5V5H14c-2 0-3.5 1.6-3.5 3.6V11H8v3.5h2.5V21H14v-6.5h2.4l.6-3.5H14V9c0-.3.2-.5.5-.5H14Z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 4v10.6a3.4 3.4 0 1 1-3.4-3.4c.3 0 .6 0 .9.1"/><path d="M14 4c.3 2 1.8 3.5 3.8 3.8"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6.5 17.5 5 20l2.6-1.4A7.5 7.5 0 1 0 5 12c0 1.3.35 2.5.97 3.55"/><path d="M9.5 9.7c.2-.5.9-.5 1.2 0l.5.9c.15.3.1.6-.1.85l-.4.45c-.2.25-.2.5-.05.75.6 1 1.5 1.85 2.5 2.4.25.15.5.1.7-.1l.45-.45c.2-.2.5-.25.8-.1l1 .5c.4.2.5.7.2 1.05-.6.65-1.55 1.05-2.4.8-1.9-.55-3.9-2.35-4.65-4.15-.3-.75.05-1.65.65-2.2Z"/></svg>`,
};

function socialRowHTML() {
  return Object.entries(SOCIAL_LINKS)
    .filter(([, url]) => url && url !== "#")
    .map(
      ([key, url]) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Kelsworth on ${key}">${SOCIAL_ICONS[key]}</a>`
    )
    .join("");
}

function headerHTML(active) {
  const links = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`
  ).join("");
  return `
  <div class="announce-bar">Free shipping across Pakistan on orders over Rs. 5,000 — Cash on Delivery available</div>
  <div class="header-row">
    <a href="index.html" class="logo"><img src="images/logo-wordmark.svg" alt="Kelsworth" style="height:22px;display:block" /></a>
    <nav class="main-nav">${links}</nav>
    <div class="header-actions">
      <div class="search-wrap" id="searchWrap">
        <form id="headerSearchForm" style="display:flex;align-items:center;position:relative">
          <input type="search" id="headerSearchInput" placeholder="Search products…" aria-label="Search products" autocomplete="off"
            style="width:0;opacity:0;padding:0;border:none;font-family:var(--font-mono);font-size:12px;background:var(--paper-alt);transition:width .2s ease,opacity .2s ease,padding .2s ease" />
          <button class="icon-btn" id="searchToggle" aria-label="Search" type="button">${SEARCH_ICON}</button>
        </form>
        <div class="search-dropdown" id="searchDropdown"></div>
      </div>
      <a class="icon-btn" href="account.html" aria-label="Account">${ACCOUNT_ICON}</a>
      <a class="icon-btn" href="account.html?tab=wishlist" aria-label="Wishlist">${WISHLIST_ICON}</a>
      <a class="icon-btn" href="cart.html" aria-label="Cart">${CART_ICON}<span class="cart-count" data-cart-count style="display:none">0</span></a>
      <button class="nav-toggle" id="mobileNavToggle" aria-label="Open menu" type="button">${MENU_ICON}</button>
    </div>
  </div>`;
}

function mobileNavHTML(active) {
  const links = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`
  ).join("");
  return `
  <div class="mobile-nav-head">
    <span class="logo"><img src="images/logo-wordmark.svg" alt="Kelsworth" style="height:22px;display:block" /></span>
    <button class="nav-toggle" id="mobileNavClose" aria-label="Close menu" type="button">${CLOSE_ICON}</button>
  </div>
  <nav>${links}<a href="account.html">Account</a><a href="track.html">Track Order</a></nav>
  <hr class="stitch-rule" style="margin:30px 0">
  <a href="cart.html" style="font-family:var(--font-mono);font-size:13px;text-transform:uppercase;letter-spacing:.08em">View Cart (<span data-cart-count>0</span>)</a>`;
}

function footerHTML() {
  return `
  <div class="footer-top">
    <div class="newsletter">
      <div>
        <h3>Join the list.</h3>
        <p>New drops, restocks, and first access to sale — no spam, unsubscribe anytime.</p>
      </div>
      <form class="newsletter-form" id="newsletterForm">
        <input type="email" placeholder="Your email address" required aria-label="Email address" />
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
  <div class="footer-grid">
    <div class="footer-col">
      <h4>Kelsworth</h4>
      <p>Denim built for wear, not display. Designed and finished for the way you actually move through a day.</p>
      <div class="social-row">${socialRowHTML()}</div>
    </div>
    <div class="footer-col">
      <h4>Shop</h4>
      <ul>
        <li><a href="collection.html">Men's Denim</a></li>
        <li><a href="collection.html?category=jackets">Jackets</a></li>
        <li><a href="collection.html?category=shorts">Shorts</a></li>
        <li><a href="collection.html?category=polos">Polos</a></li>
        <li><a href="collection.html?category=tees">Tees</a></li>
        <li><a href="collection.html?category=half-sleeve-shirts">Half Sleeve Shirts</a></li>
        <li><a href="collection.html?category=full-sleeve-shirts">Full Sleeve Shirts</a></li>
        <li><a href="collection.html?sale=1">Sale</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Help</h4>
      <ul>
        <li><a href="#">Size Guide</a></li>
        <li><a href="#">Shipping &amp; Returns</a></li>
        <li><a href="track.html">Track Order</a></li>
        <li><a href="#">Contact Us</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Company</h4>
      <ul>
        <li><a href="#">About</a></li>
        <li><a href="#">Store Locations</a></li>
        <li><a href="#">Careers</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} Kelsworth. All rights reserved.</span>
    <span>Karachi, Pakistan</span>
  </div>`;
}

const RECENT_SEARCHES_KEY = "vw_recent_searches";
function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)) || []; } catch (e) { return []; }
}
function addRecentSearch(q) {
  q = q.trim();
  if (!q) return;
  const list = [q, ...getRecentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
}
function clearRecentSearches() { localStorage.removeItem(RECENT_SEARCHES_KEY); }

function mountChrome(active) {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");
  if (headerEl) headerEl.innerHTML = headerHTML(active);
  if (footerEl) footerEl.innerHTML = footerHTML();

  const mobileNav = document.createElement("div");
  mobileNav.className = "mobile-nav";
  mobileNav.id = "mobileNav";
  mobileNav.innerHTML = mobileNavHTML(active);
  document.body.appendChild(mobileNav);

  const openBtn = document.getElementById("mobileNavToggle");
  const closeBtn = document.getElementById("mobileNavClose");
  if (openBtn) openBtn.addEventListener("click", () => mobileNav.classList.add("open"));
  if (closeBtn) closeBtn.addEventListener("click", () => mobileNav.classList.remove("open"));

  const newsletterForm = document.getElementById("newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector("input");
      newsletterForm.innerHTML = `<span style="font-family:var(--font-mono);font-size:12px;color:var(--paper)">Thanks — you're on the list.</span>`;
    });
  }

  const searchToggle = document.getElementById("searchToggle");
  const searchInput = document.getElementById("headerSearchInput");
  const searchForm = document.getElementById("headerSearchForm");
  const searchWrap = document.getElementById("searchWrap");
  const dropdown = document.getElementById("searchDropdown");

  if (searchToggle && searchInput && dropdown) {
    const getRecent = getRecentSearches;
    const addRecent = addRecentSearch;
    const clearRecent = clearRecentSearches;

    const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const highlight = (text, q) => {
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      if (idx === -1) return escapeHTML(text);
      return `${escapeHTML(text.slice(0, idx))}<mark>${escapeHTML(text.slice(idx, idx + q.length))}</mark>${escapeHTML(text.slice(idx + q.length))}`;
    };

    let searchItems = [];
    let activeIndex = -1;
    let debounceTimer = null;

    function closeDropdown() {
      dropdown.classList.remove("open");
      searchItems = [];
      activeIndex = -1;
    }
    function setActive(i) {
      activeIndex = i;
      searchItems.forEach((it, idx) => it.el.classList.toggle("active", idx === i));
      if (i >= 0) searchItems[i].el.scrollIntoView({ block: "nearest" });
    }

    function renderRecent() {
      const recents = getRecent();
      dropdown.classList.add("open");
      if (!recents.length) {
        dropdown.innerHTML = `<p class="search-empty">Start typing to search products…</p>`;
        searchItems = [];
        return;
      }
      dropdown.innerHTML = `
        <div class="search-section-label"><span>Recent Searches</span><button type="button" id="clearRecentBtn">Clear</button></div>
        <div>${recents.map((r) => `<button type="button" class="search-recent-item" data-q="${escapeHTML(r)}">${SEARCH_ICON}<span>${escapeHTML(r)}</span></button>`).join("")}</div>`;
      document.getElementById("clearRecentBtn").addEventListener("click", () => { clearRecent(); renderRecent(); });
      searchItems = [...dropdown.querySelectorAll(".search-recent-item")].map((el) => ({
        el, onSelect: () => { searchInput.value = el.dataset.q; runSearch(el.dataset.q); },
      }));
      searchItems.forEach((it) => it.el.addEventListener("click", it.onSelect));
    }

    async function runSearch(q) {
      if (!q) { renderRecent(); return; }
      dropdown.classList.add("open");
      const data = await searchProducts(q, 6);
      // The query may have changed while this request was in flight.
      if (searchInput.value.trim() !== q) return;

      const categoryRow = data.categories.length
        ? `<div class="search-category-row">${data.categories
            .map((c) => `<a class="search-category-chip" href="collection.html?category=${c.key}">${c.label} <span>(${c.count})</span></a>`)
            .join("")}</div>`
        : "";
      const productRows = data.products.length
        ? `<div>${data.products
            .map(
              (p) => `
          <a class="search-result-row" href="product.html?id=${p.id}">
            <img src="${p.image}" alt="${escapeHTML(p.name)}" loading="lazy" />
            <span class="search-result-info">
              <span class="search-result-name">${highlight(p.matchedName, q)}</span>
              <span class="search-result-price">${formatPKR(p.salePrice ?? p.price)}</span>
            </span>
          </a>`
            )
            .join("")}</div>`
        : `<p class="search-empty">No products found for "${escapeHTML(q)}"</p>`;
      const viewAll = `<a class="search-viewall" href="collection.html?q=${encodeURIComponent(q)}">View all results for &ldquo;${escapeHTML(q)}&rdquo;</a>`;

      dropdown.innerHTML = `
        ${categoryRow}
        ${data.products.length ? `<div class="search-section-label"><span>Products</span></div>` : ""}
        ${productRows}
        ${viewAll}`;

      searchItems = [
        ...dropdown.querySelectorAll(".search-category-chip"),
        ...dropdown.querySelectorAll(".search-result-row"),
        ...dropdown.querySelectorAll(".search-viewall"),
      ].map((el) => ({ el, onSelect: () => el.click() }));
      dropdown.querySelectorAll("a").forEach((el) => el.addEventListener("click", () => addRecent(q)));
    }

    searchToggle.addEventListener("click", () => {
      const isOpen = searchInput.style.width !== "0px" && searchInput.style.width !== "";
      if (isOpen) {
        searchInput.style.width = "0";
        searchInput.style.opacity = "0";
        searchInput.style.padding = "0";
        closeDropdown();
      } else {
        searchInput.style.width = "220px";
        searchInput.style.opacity = "1";
        searchInput.style.padding = "6px 8px";
        searchInput.focus();
      }
    });

    searchInput.addEventListener("focus", () => {
      const q = searchInput.value.trim();
      q ? runSearch(q) : renderRecent();
    });

    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const q = searchInput.value.trim();
      debounceTimer = setTimeout(() => runSearch(q), 200);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (!dropdown.classList.contains("open") || !searchItems.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((activeIndex + 1) % searchItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((activeIndex - 1 + searchItems.length) % searchItems.length);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        searchItems[activeIndex].onSelect();
      } else if (e.key === "Escape") {
        closeDropdown();
        searchInput.blur();
      }
    });

    document.addEventListener("click", (e) => {
      if (searchWrap && !searchWrap.contains(e.target)) closeDropdown();
    });
  }
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) {
        addRecentSearch(q);
        window.location.href = `collection.html?q=${encodeURIComponent(q)}`;
      }
    });
  }

  updateCartBadge();
}

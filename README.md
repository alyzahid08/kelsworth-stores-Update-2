# Kelsworth — Full Store (Backend + Admin Panel)

This is the complete, order-taking version of the site: a Node.js backend
with a real database, sitting behind the storefront — plus an admin panel
to manage products, stock, orders, and promo codes.

```
server.js               App entry point
db.js                    Database connection + transaction helper
schema.sql                Table definitions (run automatically by the seed script)
seed.js                    Creates tables, demo products, your first admin login,
                            and backfills stock for products that predate stock tracking
routes/                    API endpoints
  products.js                Public product listing/detail/search/reviews/variants
  orders.js                   Checkout, stock decrement, order lookup
  customers.js                 Register/login/order history/addresses/wishlist
  contact.js                    Public contact form submissions
  promo.js                      Public promo code validation (cart preview)
  adminAuth.js                   Admin login/logout/change password
  admin.js                        Admin CRUD: orders, products, promo codes,
                                   analytics, contact messages, review moderation
middleware/
  auth.js                    Admin login/session handling
  customerAuth.js             Customer login/session handling (separate from admin)
lib/
  email.js                   Order confirmation/status/welcome emails (optional)
  promo.js                    Shared promo code validation logic
public/                    The storefront
  index.html                  Home — new arrivals, best sellers, testimonials
  collection.html               Full catalog with live search + multi-filters
  product.html                    Gallery, variants, reviews, cross-sell
  cart.html, checkout.html          Cart and checkout (guest or logged in)
  account.html                       Orders, wishlist, addresses, profile
  track.html                          Order tracking (order number + email)
  about.html, contact.html, faq.html,   Business/trust pages
  shipping.html, refund.html,
  privacy.html
  robots.txt                          Crawler rules (sitemap.xml is generated
                                       dynamically by server.js, not a static file)
admin/                     The admin panel
  login.html, index.html (orders), dashboard.html (analytics), products.html,
  promo-codes.html, messages.html (contact form submissions)
```

## 1. What you need before starting
- **Node.js** installed on your computer (v18 or newer) — from nodejs.org
- A place to run this and a database. Recommended: **Railway** — free trial
  credit, easiest setup, no server admin required.

## 2. Recommended hosting: Railway
1. Go to **railway.app**, sign up, click **New Project**.
2. Choose **Deploy from GitHub repo** — push this folder to a GitHub
   repository first if you haven't already.
3. In the same project, click **+ New** → **Database** → **Add PostgreSQL**.
   Railway automatically creates `DATABASE_URL` for your app.
4. Click your app service → **Variables** tab → add:
   - `JWT_SECRET` — any long random string (generate one locally with
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD`
   - `NODE_ENV` — `production`
   - Optional email variables — see section 6 below
5. **Settings → Deploy**: set **Pre-Deploy Command** to `npm run seed` (this
   is safe to leave in place permanently — see "Updating an existing store"
   below for why).
6. **Settings → Networking** → **Generate Domain** for a free
   `*.up.railway.app` URL, or connect your own domain there.

## 3. Running it on your own computer first (recommended before deploying)
1. `npm install`
2. Get a database connection string — a free Postgres database at
   **neon.tech** or **supabase.com** takes under a minute to set up.
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`,
   `ADMIN_INITIAL_USERNAME`, `ADMIN_INITIAL_PASSWORD`.
4. `npm run seed` — sets up tables, demo products, and your admin login.
5. `npm start`
6. Open **http://localhost:3000** for the storefront, and
   **http://localhost:3000/admin/login.html** for the admin panel.

## 4. Updating an already-live store (important)
This project's database schema will keep growing as new features are added.
`schema.sql` and `seed.js` are both written to be **safe to re-run any
time** — every statement either checks "does this already exist?" first, or
only fills in what's missing (like backfilling starter stock for products
that existed before per-size stock tracking did). Re-running never deletes
or overwrites data you already have.

**Practical takeaway:** after pulling any future update from me, just make
sure your deploy runs `npm run seed` before `npm start` (Railway's
Pre-Deploy Command setting from step 2.5 handles this automatically on
every deploy — you don't need to toggle it on and off anymore).

## 5. Logging into the admin panel
`/admin/login.html` — log in with your `ADMIN_INITIAL_USERNAME` /
`ADMIN_INITIAL_PASSWORD`. You'll land on the **Dashboard**. From there:
- **Dashboard** — revenue (today/this month/all-time), order status
  breakdown, a 30-day revenue chart, best-selling products, top customers
  by spend, and low-stock alerts. All computed directly in the database, so
  it stays fast as orders grow.
- **Orders** — every order lands here. Search, filter by status, view full
  details, update status (Pending → Processing → Shipped → Delivered —
  each status change emails the customer if SMTP is configured), export
  the current filtered list to CSV.
- **Products** — add, edit, delete, or hide products. Each size gets its
  own stock number — set a size to 0 to show it as sold out on the
  storefront without deleting the product. Low/out-of-stock items are
  flagged in the list, and a checkbox flags a product for the homepage
  Best Sellers row.
- **Promo Codes** — create percentage-off codes, optionally with a minimum
  order value and an expiry date. Disable a code any time without deleting
  it (so past orders that used it stay accurate).
- **Messages** — every contact form submission from `/contact.html` lands
  here (and is saved even if you haven't set up SMTP yet — email is just a
  notification on top, the database is always the source of truth).

**Change your password** after first login — no UI button for this yet, but
the API supports it: `POST /api/admin/change-password` with
`{"currentPassword": "...", "newPassword": "..."}` while logged in.

## 6. Turning on transactional emails (optional)
Without any setup, the store still works fine — emails just don't send (the
order/message is still saved either way). To turn emails on:

1. Sign up for a free transactional email provider — **Brevo** (brevo.com)
   is a solid free option (300 emails/day free).
2. In Brevo: **SMTP & API** settings → copy your SMTP login details.
3. Add these to your `.env` (or Railway Variables):
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
   - Optionally `CONTACT_TO_EMAIL` if you want contact form notifications
     sent somewhere other than `SMTP_USER`
4. Redeploy — that's it, no code changes needed.

Once configured, four emails send automatically: order confirmation
(checkout), order status updates (whenever an admin changes an order's
status), a welcome email (new account signup), and contact form
notifications (with reply-to set to the sender, so you can just hit reply).

## 7. Customer accounts vs. guest checkout
Customers can check out as a guest (no account needed) or create an account
at `/account.html` for order history and faster checkout next time. Both
paths save real orders — an account just links future orders to that
customer and lets them see past ones.

## 8. Adding real product photos
Products currently use flat illustrated placeholders. Drop real photos into
`public/images/`, then set each product's **Image path or URL** field in
the admin Products page to `/images/your-file.jpg`. For a store with many
photos, cloud image storage (e.g. Cloudinary) is worth adding later instead
of storing files on the server — ask me when you're ready.

## 9. What's real vs. what's next
**Real and working right now:**
- Full product experience — image gallery with zoom/lightbox/swipe, color
  and waist×length variants, fabric/care/shipping info, SKU and stock/low-
  stock indicators, tags, share buttons
- Live search (instant suggestions, thumbnails, keyboard nav, recent
  searches) and multi-filter browsing (price, size, color, material,
  stretch, collection, fit, availability)
- Star ratings and a full review system (verified purchase badges, photo/
  video uploads, helpful votes, sorting/filtering) — shown on the product
  page and as a summary on every product card sitewide
- Complete the Look, Frequently Bought Together, and Related Products
- Cart: free shipping progress bar, save for later, recommendations,
  estimated shipping/tax, auto-revalidated promo codes
- Checkout: guest checkout, saved addresses with autofill, city
  autocomplete, phone validation, delivery notes, gift messages
- Customer accounts: order history with reorder + printable invoice,
  wishlist, recently viewed, saved addresses, profile photo, notification
  preferences
- Product catalog with per-size stock tracking — checkout blocks orders
  that would oversell a size, and decrements stock safely even if two
  people check out for the last unit at the same moment
- Promo/discount codes, validated both in the cart and again at checkout
- Admin panel: order management (search/filter/status/CSV export), product
  management (with low-stock badges and a bestseller flag), promo codes,
  contact message inbox, review moderation, and an analytics dashboard
  (revenue, 30-day trend, best sellers, top customers, low-stock alerts)
- Emails (once SMTP is configured — see section 6): order confirmation,
  order status updates, welcome email on signup, contact form notifications
- Business pages: About, Contact (working form), FAQ, Shipping, Refund &
  Returns, Privacy Policy — plus trust badges and an honest payment note
  (Cash on Delivery only; no fake card logos)
- SEO: Open Graph/Twitter tags and canonical URLs on every page, a
  dynamically generated `/sitemap.xml` (includes every active product,
  regenerated on each request — no rebuild step needed), `robots.txt`,
  and JSON-LD structured data (Organization/WebSite on the homepage,
  Product/AggregateRating/BreadcrumbList on product pages)
- Accessibility: skip-to-content link, visible keyboard focus states
  everywhere, `aria-live` announcements for actions like "added to cart,"
  `role="alert"` on form errors, `prefers-reduced-motion` support
- Mobile: bottom tab bar, sticky add-to-cart/checkout bars, larger tap
  targets, skeleton loading states, lazy-loaded images

**Known limitations worth knowing about:**
- Review photos and profile pictures are stored as base64 in Postgres —
  fine at this scale, but swap for real object storage (S3/Cloudinary)
  before it grows much further
- "Invoices" are a print-ready HTML page (browser's own Print → Save as
  PDF), not a generated PDF file — there's no PDF library in this project
- City autocomplete at checkout is a plain list of major Pakistani cities,
  not full street-address lookup (that needs a paid Places API key)
- The social share image (`public/images/og-banner.svg`) is an SVG — most
  platforms handle this fine, but WhatsApp/Facebook previews are most
  reliable with a real JPG/PNG. Swap that file for an exported PNG
  (1200×630) whenever you have one, no code changes needed

**Still ahead** (happy to start any of these next):
- Payment gateway (needs your merchant account first — JazzCash/Easypaisa/
  PayFast for Pakistan, or Stripe internationally)
- Flash sales, abandoned-cart recovery, courier tracking integration
- WhatsApp notifications/support
- Staff roles/permissions (currently a single admin login with full access)
- Real generated PDF invoices, and full address autocomplete

Tell me which of those you want next and I'll pick it up the same way as
everything else here — incrementally, without touching what already works.

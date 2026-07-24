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
  products.js                Public product listing/detail
  orders.js                   Checkout, stock decrement, order lookup
  customers.js                 Customer register/login/order history
  promo.js                      Public promo code validation (cart preview)
  adminAuth.js                   Admin login/logout/change password
  admin.js                        Admin CRUD: orders, products, promo codes
middleware/
  auth.js                    Admin login/session handling
  customerAuth.js             Customer login/session handling (separate from admin)
lib/
  email.js                   Order confirmation emails (optional — see below)
  promo.js                    Shared promo code validation logic
public/                    The storefront
  index.html, collection.html, product.html, cart.html, checkout.html
  track.html                  Order tracking (order number + email)
  account.html                  Customer login/register + order history
admin/                     The admin panel
  login.html, index.html (orders), products.html, promo-codes.html
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
  breakdown, a 30-day revenue chart, best-selling products, and top
  customers by spend. All computed directly in the database, so it stays
  fast as orders grow.
- **Orders** — every order lands here. Search, filter by status, view full
  details, update status (Pending → Processing → Shipped → Delivered).
- **Products** — add, edit, delete, or hide products. Each size gets its
  own stock number — set a size to 0 to show it as sold out on the
  storefront without deleting the product.
- **Promo Codes** — create percentage-off codes, optionally with a minimum
  order value and an expiry date. Disable a code any time without deleting
  it (so past orders that used it stay accurate).

**Change your password** after first login — no UI button for this yet, but
the API supports it: `POST /api/admin/change-password` with
`{"currentPassword": "...", "newPassword": "..."}` while logged in.

## 6. Turning on order confirmation emails (optional)
Without any setup, checkout still works fine — it just won't email a
confirmation (the order is still saved and visible in the admin panel and
on the tracking page either way). To turn emails on:

1. Sign up for a free transactional email provider — **Brevo** (brevo.com)
   is a solid free option (300 emails/day free).
2. In Brevo: **SMTP & API** settings → copy your SMTP login details.
3. Add these to your `.env` (or Railway Variables):
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
4. Redeploy — that's it, no code changes needed.

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
- Product catalog with per-size stock tracking — checkout blocks orders
  that would oversell a size, and decrements stock safely even if two
  people check out for the last unit at the same moment
- Cart, checkout, order storage, order tracking by order number + email
- Customer accounts with order history; guest checkout still fully works
- Promo/discount codes, validated both in the cart and again at checkout
- Admin login, order status management, product management, promo code
  management
- Storefront search
- Order confirmation emails (once SMTP is configured — see section 6)
- SEO/social preview tags (Open Graph, Twitter Card) on every storefront
  page; admin pages are marked `noindex` so they won't show up in search
- Admin analytics dashboard — revenue (today/month/all-time), order status
  breakdown, a 30-day revenue trend, best-selling products, top customers

**Known limitation:** the social share image (`public/images/og-banner.svg`)
is an SVG — most platforms handle this fine, but WhatsApp/Facebook link
previews are most reliable with a real JPG/PNG. Swap that file for an
exported PNG (1200×630) whenever you have one, no code changes needed.

**Still ahead** (from the full roadmap — happy to start any of these next):
- Payment gateway (needs your merchant account first — JazzCash/Easypaisa/
  PayFast for Pakistan, or Stripe internationally)
- Product reviews, wishlist, quick view, recently viewed, "Complete the
  Look" recommendations
- Flash sales, abandoned-cart recovery, COD verification, courier tracking
- WhatsApp notifications/support
- Staff roles/permissions (currently a single admin login with full access)

Tell me which of those you want next and I'll pick it up the same way as
everything else here — incrementally, without touching what already works.

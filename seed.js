require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { query, pool } = require("./db");

const DEMO_PRODUCTS = [
  {
    slug: "vw-101",
    name: "Slim Tapered Jeans — Raw Indigo",
    category: "jeans",
    fit: "slim",
    color: "Indigo",
    price: 6490,
    salePrice: null,
    sizes: ["28x30", "28x32", "30x30", "30x32", "32x30", "32x32", "34x32", "34x34"],
    sizeType: "waist_length",
    image: "/images/slim-tapered-jeans-indigo.svg",
    badge: "New",
    description:
      "A slim leg that tapers to the ankle without choking your stride. Cut from 12oz raw indigo denim that breaks in exactly where you bend.",
    fabric: "98% cotton, 2% elastane · 12oz denim",
    care: "Wash cold, inside out. Line dry. Avoid tumble drying to protect the wash.",
    material: "Cotton-Elastane Denim",
    stretch: "low",
    collection: "New Arrivals",
    tags: ["raw denim", "new arrival", "slim fit"],
    completeTheLook: ["vw-107", "vw-112"],
    frequentlyBoughtWith: ["vw-111"],
  },
  {
    slug: "vw-102",
    name: "Straight Fit Jeans — Stonewash",
    category: "jeans",
    fit: "straight",
    color: "Stonewash",
    price: 5990,
    salePrice: 4790,
    sizes: ["30", "32", "34", "36", "38"],
    image: "/images/straight-fit-jeans-stonewash.svg",
    badge: "Sale",
    description:
      "The straight leg that goes with everything. Stonewashed for a broken-in feel from the first wear, with a mid-rise waist that sits clean under a tucked shirt.",
    fabric: "100% cotton denim · 11.5oz",
    care: "Machine wash cold on gentle cycle. Do not bleach.",
    material: "100% Cotton Denim",
    stretch: "none",
    collection: "Core",
  },
  {
    slug: "vw-103",
    name: "Regular Fit Jeans — Jet Black",
    category: "jeans",
    fit: "regular",
    color: "Black",
    price: 5990,
    salePrice: null,
    sizes: ["28", "30", "32", "34", "36", "38"],
    image: "/images/regular-fit-jeans-black.svg",
    badge: null,
    description:
      "Overdyed jet black denim in a true regular fit — room through the thigh, straight through the leg. Holds its colour wash after wash.",
    fabric: "99% cotton, 1% elastane · 13oz denim",
    care: "Wash separately for first 3 washes. Cold wash, inside out.",
    material: "Cotton-Elastane Denim",
    stretch: "low",
    collection: "Core",
  },
  {
    slug: "vw-104",
    name: "Relaxed Fit Jeans — Mid Blue",
    category: "jeans",
    fit: "relaxed",
    color: "Mid Blue",
    price: 6290,
    salePrice: null,
    sizes: ["30", "32", "34", "36"],
    image: "/images/relaxed-fit-jeans-midblue.svg",
    badge: null,
    description:
      "Extra room through the seat and thigh for a fit that moves with you. A mid-blue wash with just enough contrast on the whiskering.",
    fabric: "100% cotton denim · 12.5oz",
    care: "Wash cold, inside out. Tumble dry low if needed.",
    material: "100% Cotton Denim",
    stretch: "none",
    collection: "Core",
  },
  {
    slug: "vw-105",
    name: "Distressed Slim Jeans — Washed Grey",
    category: "jeans",
    fit: "slim",
    color: "Washed Grey",
    price: 6990,
    salePrice: 5590,
    sizes: ["28", "30", "32", "34"],
    image: "/images/distressed-slim-jeans-washed.svg",
    badge: "Sale",
    description:
      "Hand-distressed at the knee and hem, garment-washed for a lived-in grey. Each pair carries a slightly different fade — no two are identical.",
    fabric: "97% cotton, 3% elastane · 11oz denim",
    care: "Cold hand wash recommended to preserve distressing.",
    material: "Cotton-Elastane Denim",
    stretch: "low",
    collection: "Limited Edition",
  },
  {
    slug: "vw-106",
    name: "Skinny Jeans — Charcoal",
    category: "jeans",
    fit: "skinny",
    color: "Charcoal",
    price: 5790,
    salePrice: null,
    sizes: ["28", "30", "32", "34"],
    image: "/images/skinny-jeans-charcoal.svg",
    badge: null,
    description:
      "The narrowest cut in the line, built with four-way stretch so it moves without giving up the shape. Charcoal wash reads black from a distance.",
    fabric: "95% cotton, 5% elastane · 10.5oz denim",
    care: "Wash cold, inside out. Do not iron directly on prints.",
    material: "Stretch Cotton Denim",
    stretch: "high",
    collection: "Core",
  },
  {
    slug: "vw-107",
    name: "Denim Trucker Jacket — Indigo",
    category: "jackets",
    fit: "regular",
    color: "Indigo",
    price: 8990,
    salePrice: null,
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: "/images/denim-trucker-jacket-indigo.svg",
    badge: "New",
    description:
      "The trucker jacket, done properly: chest pockets that actually hold something, a boxy body, and raw indigo that will fade to your own wear pattern.",
    fabric: "100% cotton denim · 13.5oz",
    care: "Wash cold, inside out. Line dry to keep its shape.",
    material: "100% Cotton Denim",
    stretch: "none",
    collection: "New Arrivals",
    tags: ["trucker jacket", "new arrival", "layering piece"],
    styleCode: "kw-trucker-jacket",
  },
  {
    slug: "vw-108",
    name: "Denim Jacket — Jet Black",
    category: "jackets",
    fit: "regular",
    color: "Black",
    price: 8990,
    salePrice: 7190,
    sizes: ["S", "M", "L", "XL"],
    image: "/images/denim-jacket-black.svg",
    badge: "Sale",
    description:
      "Same trucker silhouette in overdyed black. Layers over a hoodie without fighting for space through the shoulders.",
    fabric: "99% cotton, 1% elastane · 13oz denim",
    care: "Wash separately, cold, inside out.",
    material: "Cotton-Elastane Denim",
    stretch: "low",
    collection: "Sale",
    tags: ["trucker jacket", "sale", "layering piece"],
    styleCode: "kw-trucker-jacket",
  },
  {
    slug: "vw-109",
    name: "Denim Shorts — Stonewash",
    category: "shorts",
    fit: "regular",
    color: "Stonewash",
    price: 3990,
    salePrice: null,
    sizes: ["28", "30", "32", "34", "36"],
    image: "/images/denim-shorts-stonewash.svg",
    badge: null,
    description:
      "A knee-length cut off the straight jean block, stonewashed and finished with a raw hem. Built for the months you don't want denim on your ankles.",
    fabric: "100% cotton denim · 11oz",
    care: "Machine wash cold. Do not bleach.",
    material: "100% Cotton Denim",
    stretch: "none",
    collection: "Core",
  },
  {
    slug: "vw-110",
    name: "Denim Shorts — Mid Blue",
    category: "shorts",
    fit: "slim",
    color: "Mid Blue",
    price: 3990,
    salePrice: 3190,
    sizes: ["28", "30", "32", "34"],
    image: "/images/denim-shorts-midblue.svg",
    badge: "Sale",
    description:
      "A slightly slimmer cut through the thigh, mid-blue wash, finished hem. The one you reach for on the hottest day of the week.",
    fabric: "98% cotton, 2% elastane · 10.5oz denim",
    care: "Wash cold, inside out.",
    material: "Cotton-Elastane Denim",
    stretch: "low",
    collection: "Sale",
  },
  {
    slug: "vw-111",
    name: "Colourblock Polo — Forest Green",
    category: "polos",
    fit: "regular",
    color: "Forest Green",
    price: 3490,
    salePrice: null,
    sizes: ["S", "M", "L", "XL"],
    image: "/images/polo-shirt-forest.svg",
    badge: "New",
    description:
      "A clean-collar polo in breathable cotton pique with a colourblocked chest panel. Holds its shape wash after wash.",
    fabric: "100% cotton pique",
    care: "Machine wash cold. Do not bleach. Iron on low.",
    material: "Cotton Pique",
    stretch: "none",
    collection: "New Arrivals",
  },
  {
    slug: "vw-112",
    name: "Oversized Tee — Charcoal",
    category: "tees",
    fit: "relaxed",
    color: "Charcoal",
    price: 2490,
    salePrice: 1990,
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: "/images/oversized-tee-charcoal.svg",
    badge: "Sale",
    description:
      "A heavyweight cotton tee with a boxy, oversized drop-shoulder cut. An everyday staple that layers clean under a jacket.",
    fabric: "100% cotton · 220gsm",
    care: "Wash cold, inside out. Tumble dry low.",
    material: "100% Cotton",
    stretch: "none",
    collection: "Sale",
  },
  {
    slug: "vw-113",
    name: "Half Sleeve Casual Shirt — Olive",
    category: "half-sleeve-shirts",
    fit: "regular",
    color: "Olive",
    price: 3290,
    salePrice: null,
    sizes: ["S", "M", "L", "XL"],
    image: "/images/half-sleeve-casual-shirt-olive.svg",
    badge: null,
    description:
      "A short-sleeve casual shirt in a soft cotton blend, cut for warm days on or off duty. Works buttoned up or open over a tee.",
    fabric: "97% cotton, 3% elastane",
    care: "Machine wash cold. Iron on low.",
    material: "Cotton-Elastane Blend",
    stretch: "low",
    collection: "Core",
  },
  {
    slug: "vw-114",
    name: "Full Sleeve Casual Shirt — Stone",
    category: "full-sleeve-shirts",
    fit: "regular",
    color: "Stone",
    price: 3690,
    salePrice: null,
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: "/images/full-sleeve-casual-shirt-stone.svg",
    badge: null,
    description:
      "A long-sleeve casual shirt in a stone cotton twill. Dress it up tucked in, or wear it open over a plain tee.",
    fabric: "100% cotton twill",
    care: "Machine wash cold. Iron on medium.",
    material: "100% Cotton Twill",
    stretch: "none",
    collection: "Core",
  },
];

async function main() {
  console.log("Creating tables (if they don't already exist)...");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await query(schema);

  const { rows: existing } = await query("SELECT COUNT(*)::int AS count FROM products");
  if (existing[0].count === 0) {
    console.log("Seeding demo products...");
    const slugToId = {};
    for (const p of DEMO_PRODUCTS) {
      // Give each size a modest starter stock count so the new stock
      // tracking/enforcement has real numbers to work with immediately.
      const stockBySize = {};
      p.sizes.forEach((size) => { stockBySize[size] = 15; });
      const totalStock = p.sizes.length * 15;
      const skuBySize = {};
      p.sizes.forEach((size) => { skuBySize[size] = `${p.slug.toUpperCase()}-${size}`; });

      const { rows } = await query(
        `INSERT INTO products
          (slug, name, category, fit, color, price, sale_price, sizes, image, badge, description, fabric, care, stock, stock_by_size,
           tags, sku, sku_by_size, style_code, size_type, complete_the_look, frequently_bought_with, material, stretch, collection)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         RETURNING id`,
        [
          p.slug, p.name, p.category, p.fit, p.color, p.price, p.salePrice,
          JSON.stringify(p.sizes), p.image, p.badge, p.description, p.fabric, p.care,
          totalStock, JSON.stringify(stockBySize),
          JSON.stringify(p.tags || []), p.slug.toUpperCase(), JSON.stringify(skuBySize),
          p.styleCode || null, p.sizeType || "standard",
          JSON.stringify(p.completeTheLook || []), JSON.stringify(p.frequentlyBoughtWith || []),
          p.material || null, p.stretch || "none", p.collection || null,
        ]
      );
      slugToId[p.slug] = rows[0].id;
    }
    console.log(`Inserted ${DEMO_PRODUCTS.length} products (15 units per size).`);

    console.log("Seeding a few sample reviews...");
    const sampleReviews = [
      { slug: "vw-101", name: "Ahmed K.", rating: 5, title: "Fits exactly as expected", body: "Ordered my usual waist and length and it fit true to size. The denim is thick without feeling stiff.", verified: true },
      { slug: "vw-101", name: "Bilal S.", rating: 4, title: "Great jeans, runs slightly long", body: "Good quality raw denim, held up well after a few washes. I'd size down on length if you're under 5'9\".", verified: true },
      { slug: "vw-107", name: "Hamza R.", rating: 5, title: "Exactly the trucker jacket I wanted", body: "Boxy fit, solid stitching, and the indigo is going to fade nicely with wear.", verified: false },
    ];
    for (const r of sampleReviews) {
      const productId = slugToId[r.slug];
      if (!productId) continue;
      await query(
        `INSERT INTO product_reviews (product_id, customer_name, rating, title, body, verified_purchase)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [productId, r.name, r.rating, r.title, r.body, r.verified]
      );
    }
  } else {
    console.log("Products table already has data — skipping product seed.");

    // For a store that was already live before per-size stock existed,
    // backfill a starter stock count so nothing is stuck showing
    // "unlimited" forever. Only touches products with no per-size stock
    // set yet — safe to re-run, never overwrites stock you've already set.
    const { rows: unstocked } = await query(
      "SELECT id, sizes FROM products WHERE stock_by_size = '{}'::jsonb"
    );
    if (unstocked.length) {
      console.log(`Backfilling starter stock for ${unstocked.length} existing product(s)...`);
      for (const p of unstocked) {
        const stockBySize = {};
        (p.sizes || []).forEach((size) => { stockBySize[size] = 15; });
        const totalStock = (p.sizes || []).length * 15;
        await query("UPDATE products SET stock_by_size = $1, stock = $2 WHERE id = $3", [
          JSON.stringify(stockBySize), totalStock, p.id,
        ]);
      }
      console.log("Backfill done — adjust exact numbers any time in the admin Products page.");
    }
  }

  const { rows: admins } = await query("SELECT COUNT(*)::int AS count FROM admin_users");
  if (admins[0].count === 0) {
    const username = process.env.ADMIN_INITIAL_USERNAME || "admin";
    const password = process.env.ADMIN_INITIAL_PASSWORD || "ChangeMe123!";
    const hash = await bcrypt.hash(password, 10);
    await query("INSERT INTO admin_users (username, password_hash) VALUES ($1,$2)", [username, hash]);
    console.log(`Created admin login → username: "${username}", password: "${password}"`);
    console.log("Log in at /admin/login.html and change this password as soon as you can.");
  } else {
    console.log("An admin user already exists — skipping admin seed.");
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

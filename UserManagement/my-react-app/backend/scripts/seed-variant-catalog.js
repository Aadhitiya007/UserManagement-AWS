const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const ProductRepository = require("../repositories/productRepository");

const SEED_VARIANT_PRODUCTS = [
  {
    name: "Apple iPhone 15 Pro Max",
    category: "Electronics",
    price: 134900,
    mrp: 159900,
    stock: 50,
    warranty: "1 Year Official Apple Warranty & AppleCare+ Eligible",
    description: "Forged in titanium with aerospace-grade strength, supercharged by the groundbreaking A17 Pro chip with 6-core GPU, customizable Action button, and 48MP Pro camera system with 5x telephoto optical zoom.",
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Storage", options: ["256GB", "512GB", "1TB"] },
      { name: "Color", options: ["Natural Titanium", "Blue Titanium", "Black Titanium"] }
    ],
    variants: [
      {
        variantId: "v_ip15_256_nat",
        name: "256GB - Natural Titanium",
        attributes: { Storage: "256GB", Color: "Natural Titanium" },
        price: 134900,
        mrp: 159900,
        stock: 18,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_256_blue",
        name: "256GB - Blue Titanium",
        attributes: { Storage: "256GB", Color: "Blue Titanium" },
        price: 134900,
        mrp: 159900,
        stock: 14,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_256_blk",
        name: "256GB - Black Titanium",
        attributes: { Storage: "256GB", Color: "Black Titanium" },
        price: 134900,
        mrp: 159900,
        stock: 18,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_512_nat",
        name: "512GB - Natural Titanium",
        attributes: { Storage: "512GB", Color: "Natural Titanium" },
        price: 154900,
        mrp: 179900,
        stock: 12,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_512_blue",
        name: "512GB - Blue Titanium",
        attributes: { Storage: "512GB", Color: "Blue Titanium" },
        price: 154900,
        mrp: 179900,
        stock: 10,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_512_blk",
        name: "512GB - Black Titanium",
        attributes: { Storage: "512GB", Color: "Black Titanium" },
        price: 154900,
        mrp: 179900,
        stock: 15,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_1tb_nat",
        name: "1TB - Natural Titanium",
        attributes: { Storage: "1TB", Color: "Natural Titanium" },
        price: 174900,
        mrp: 199900,
        stock: 8,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_1tb_blue",
        name: "1TB - Blue Titanium",
        attributes: { Storage: "1TB", Color: "Blue Titanium" },
        price: 174900,
        mrp: 199900,
        stock: 6,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_ip15_1tb_blk",
        name: "1TB - Black Titanium",
        attributes: { Storage: "1TB", Color: "Black Titanium" },
        price: 174900,
        mrp: 199900,
        stock: 9,
        image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80"
      }
    ]
  },
  {
    name: "MacBook Pro 14-inch (M3 Pro)",
    category: "Electronics",
    price: 199900,
    mrp: 219900,
    stock: 35,
    warranty: "1 Year International Apple Limited Warranty",
    description: "Liquid Retina XDR display with 1000 nits sustained brightness, ProMotion 120Hz refresh rate, 11-core CPU, 14-core GPU, and up to 18 hours of battery life.",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Memory", options: ["18GB Unified", "36GB Unified"] },
      { name: "Storage", options: ["512GB SSD", "1TB SSD"] },
      { name: "Color", options: ["Space Black", "Silver"] }
    ],
    variants: [
      {
        variantId: "v_mbp_18_512_blk",
        name: "18GB / 512GB - Space Black",
        attributes: { Memory: "18GB Unified", Storage: "512GB SSD", Color: "Space Black" },
        price: 199900,
        mrp: 219900,
        stock: 12,
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_mbp_18_512_slv",
        name: "18GB / 512GB - Silver",
        attributes: { Memory: "18GB Unified", Storage: "512GB SSD", Color: "Silver" },
        price: 199900,
        mrp: 219900,
        stock: 8,
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_mbp_36_1tb_blk",
        name: "36GB / 1TB - Space Black",
        attributes: { Memory: "36GB Unified", Storage: "1TB SSD", Color: "Space Black" },
        price: 239900,
        mrp: 259900,
        stock: 10,
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_mbp_36_1tb_slv",
        name: "36GB / 1TB - Silver",
        attributes: { Memory: "36GB Unified", Storage: "1TB SSD", Color: "Silver" },
        price: 239900,
        mrp: 259900,
        stock: 5,
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80"
      }
    ]
  },
  {
    name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    category: "Audio",
    price: 29990,
    mrp: 34990,
    stock: 45,
    warranty: "1 Year Brand Domestic Warranty",
    description: "Industry-leading active noise cancellation with 8 microphones and Auto NC Optimizer. High-Resolution Audio with 30-hour battery life and ultra-comfortable soft fit leather.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Color", options: ["Midnight Black", "Platinum Silver", "Smoky Pink"] }
    ],
    variants: [
      {
        variantId: "v_sony_xm5_blk",
        name: "Midnight Black",
        attributes: { Color: "Midnight Black" },
        price: 29990,
        mrp: 34990,
        stock: 22,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_sony_xm5_slv",
        name: "Platinum Silver",
        attributes: { Color: "Platinum Silver" },
        price: 29990,
        mrp: 34990,
        stock: 15,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
      },
      {
        variantId: "v_sony_xm5_pnk",
        name: "Smoky Pink",
        attributes: { Color: "Smoky Pink" },
        price: 31990,
        mrp: 36990,
        stock: 8,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
      }
    ]
  },
  {
    name: "Samsung Galaxy Watch 6 Classic (Rotating Bezel)",
    category: "Wearables",
    price: 36999,
    mrp: 42999,
    stock: 30,
    warranty: "1 Year Official Samsung Warranty",
    description: "Timeless stainless steel design with physical rotating bezel, Advanced Sleep Coaching, Body Composition ECG analysis, and sapphire crystal glass display.",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Dial Size", options: ["43mm", "47mm"] },
      { name: "Connectivity", options: ["Bluetooth", "LTE (eSIM)"] },
      { name: "Color", options: ["Black", "Silver"] }
    ],
    variants: [
      {
        variantId: "v_gw6_43_bt_blk",
        name: "43mm / Bluetooth - Black",
        attributes: { "Dial Size": "43mm", Connectivity: "Bluetooth", Color: "Black" },
        price: 36999,
        mrp: 42999,
        stock: 10
      },
      {
        variantId: "v_gw6_43_lte_blk",
        name: "43mm / LTE - Black",
        attributes: { "Dial Size": "43mm", Connectivity: "LTE (eSIM)", Color: "Black" },
        price: 40999,
        mrp: 46999,
        stock: 8
      },
      {
        variantId: "v_gw6_47_bt_blk",
        name: "47mm / Bluetooth - Black",
        attributes: { "Dial Size": "47mm", Connectivity: "Bluetooth", Color: "Black" },
        price: 39999,
        mrp: 45999,
        stock: 12
      },
      {
        variantId: "v_gw6_47_lte_slv",
        name: "47mm / LTE - Silver",
        attributes: { "Dial Size": "47mm", Connectivity: "LTE (eSIM)", Color: "Silver" },
        price: 43999,
        mrp: 49999,
        stock: 6
      }
    ]
  },
  {
    name: "Sony PlayStation 5 Slim Console",
    category: "Gaming",
    price: 44990,
    mrp: 54990,
    stock: 25,
    warranty: "1 Year Sony India Warranty",
    description: "Experience lightning fast loading with an ultra-high speed SSD, deeper immersion with haptic feedback, adaptive triggers, and 3D Audio, and an all-new generation of incredible PlayStation games.",
    image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Edition", options: ["Digital Edition", "Disc Edition"] },
      { name: "Bundle", options: ["Console Only", "Console + Extra Controller"] }
    ],
    variants: [
      {
        variantId: "v_ps5_dig_solo",
        name: "Digital Edition - Console Only",
        attributes: { Edition: "Digital Edition", Bundle: "Console Only" },
        price: 44990,
        mrp: 54990,
        stock: 10
      },
      {
        variantId: "v_ps5_dig_bundle",
        name: "Digital Edition - With Extra Controller",
        attributes: { Edition: "Digital Edition", Bundle: "Console + Extra Controller" },
        price: 49990,
        mrp: 60990,
        stock: 6
      },
      {
        variantId: "v_ps5_disc_solo",
        name: "Disc Edition - Console Only",
        attributes: { Edition: "Disc Edition", Bundle: "Console Only" },
        price: 54990,
        mrp: 64990,
        stock: 8
      },
      {
        variantId: "v_ps5_disc_bundle",
        name: "Disc Edition - With Extra Controller",
        attributes: { Edition: "Disc Edition", Bundle: "Console + Extra Controller" },
        price: 59990,
        mrp: 70990,
        stock: 5
      }
    ]
  },
  {
    name: "Nike Air Zoom Pegasus 40 Running Shoes",
    category: "Fashion",
    price: 11495,
    mrp: 13995,
    stock: 40,
    warranty: "6 Months Brand Warranty against Manufacturing Defects",
    description: "A springy ride for any run, the Peg's familiar, just-for-you feel returns to help you accomplish your goals. Featuring responsive Nike React technology with dual Zoom Air units.",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Size (UK)", options: ["UK 7", "UK 8", "UK 9", "UK 10", "UK 11"] },
      { name: "Color", options: ["Triple Black", "White/Pure Platinum"] }
    ],
    variants: [
      {
        variantId: "v_nike_7_blk",
        name: "UK 7 - Triple Black",
        attributes: { "Size (UK)": "UK 7", Color: "Triple Black" },
        price: 11495,
        mrp: 13995,
        stock: 8
      },
      {
        variantId: "v_nike_8_blk",
        name: "UK 8 - Triple Black",
        attributes: { "Size (UK)": "UK 8", Color: "Triple Black" },
        price: 11495,
        mrp: 13995,
        stock: 12
      },
      {
        variantId: "v_nike_9_blk",
        name: "UK 9 - Triple Black",
        attributes: { "Size (UK)": "UK 9", Color: "Triple Black" },
        price: 11495,
        mrp: 13995,
        stock: 15
      },
      {
        variantId: "v_nike_9_wht",
        name: "UK 9 - White/Pure Platinum",
        attributes: { "Size (UK)": "UK 9", Color: "White/Pure Platinum" },
        price: 11495,
        mrp: 13995,
        stock: 10
      },
      {
        variantId: "v_nike_10_blk",
        name: "UK 10 - Triple Black",
        attributes: { "Size (UK)": "UK 10", Color: "Triple Black" },
        price: 11495,
        mrp: 13995,
        stock: 8
      }
    ]
  },
  {
    name: "Heavyweight French Terry Oversized Hoodie",
    category: "Fashion",
    price: 2499,
    mrp: 3999,
    stock: 60,
    warranty: "15-Day Quality Return Guarantee",
    description: "Crafted from 480 GSM dense French Terry cotton, drop-shoulder relaxed silhouette, double-layered hood without drawstrings, and kangaroo pocket.",
    image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Size", options: ["S", "M", "L", "XL"] },
      { name: "Color", options: ["Charcoal Grey", "Sage Green", "Oatmeal"] }
    ],
    variants: [
      {
        variantId: "v_hd_s_chr",
        name: "S - Charcoal Grey",
        attributes: { Size: "S", Color: "Charcoal Grey" },
        price: 2499,
        mrp: 3999,
        stock: 15
      },
      {
        variantId: "v_hd_m_chr",
        name: "M - Charcoal Grey",
        attributes: { Size: "M", Color: "Charcoal Grey" },
        price: 2499,
        mrp: 3999,
        stock: 20
      },
      {
        variantId: "v_hd_l_chr",
        name: "L - Charcoal Grey",
        attributes: { Size: "L", Color: "Charcoal Grey" },
        price: 2499,
        mrp: 3999,
        stock: 25
      },
      {
        variantId: "v_hd_l_sage",
        name: "L - Sage Green",
        attributes: { Size: "L", Color: "Sage Green" },
        price: 2499,
        mrp: 3999,
        stock: 18
      },
      {
        variantId: "v_hd_xl_chr",
        name: "XL - Charcoal Grey",
        attributes: { Size: "XL", Color: "Charcoal Grey" },
        price: 2499,
        mrp: 3999,
        stock: 14
      }
    ]
  },
  {
    name: "Logitech MX Master 3S Wireless Performance Mouse",
    category: "Accessories",
    price: 9495,
    mrp: 10995,
    stock: 35,
    warranty: "1 Year Limited Hardware Warranty",
    description: "Quiet Click technology with 8,000 DPI any-surface tracking (including glass), MagSpeed electromagnetic scrolling at 1,000 lines per second, and ergonomic thumb rest.",
    image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80",
    variantAttributes: [
      { name: "Color", options: ["Graphite Black", "Pale Grey"] }
    ],
    variants: [
      {
        variantId: "v_mx3s_grp",
        name: "Graphite Black",
        attributes: { Color: "Graphite Black" },
        price: 9495,
        mrp: 10995,
        stock: 22
      },
      {
        variantId: "v_mx3s_gry",
        name: "Pale Grey",
        attributes: { Color: "Pale Grey" },
        price: 9495,
        mrp: 10995,
        stock: 13
      }
    ]
  }
];

async function seedCatalog(productRepo = new ProductRepository()) {
  console.log("=== Purging Legacy Catalog & Seeding Real-World Variant Products ===\n");

  // 1. Fetch all existing products
  let allExisting = [];
  try {
    let cursor = null;
    do {
      const page = await productRepo.list({ limit: 100, nextCursor: cursor });
      if (page.products && page.products.length > 0) {
        allExisting = allExisting.concat(page.products);
      }
      cursor = page.nextCursor || null;
    } while (cursor);
    console.log(`Found ${allExisting.length} existing products to purge.`);
  } catch (err) {
    console.warn("Could not list existing products, proceeding to seed:", err.message);
  }

  // 2. Delete each existing product
  let deletedCount = 0;
  for (const item of allExisting) {
    const id = item.productId || item._id || item.id;
    try {
      await productRepo.delete(id);
      deletedCount++;
    } catch (delErr) {
      console.warn(`Failed to delete product ${id}:`, delErr.message);
    }
  }
  console.log(`Successfully purged ${deletedCount} legacy products from DynamoDB.\n`);

  // 3. Seed new high quality variant products
  const created = [];
  for (const data of SEED_VARIANT_PRODUCTS) {
    try {
      const prod = await productRepo.create(data);
      console.log(`✓ Seeded: [${prod.category}] ${prod.name} (Variants: ${prod.variants?.length || 0})`);
      created.push(prod);
    } catch (err) {
      console.error(`Failed to seed ${data.name}:`, err.message);
    }
  }

  console.log(`\n=== Seeding Finished: ${created.length}/${SEED_VARIANT_PRODUCTS.length} products active ===`);
  return { deleted: deletedCount, seeded: created.length, products: created };
}

module.exports = {
  SEED_VARIANT_PRODUCTS,
  seedCatalog
};

if (require.main === module) {
  seedCatalog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed script failed:", err);
      process.exit(1);
    });
}


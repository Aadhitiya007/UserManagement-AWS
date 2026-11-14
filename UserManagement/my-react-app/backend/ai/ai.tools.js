const ProductRepository = require("../repositories/productRepository");
const { getProductWithImageUrl } = require("../controllers/productController");

let activeProductRepo = new ProductRepository();

function setProductRepository(repo) {
  activeProductRepo = repo;
}

function getProductRepository() {
  return activeProductRepo;
}

/**
 * Normalizes user queries & category aliases to valid DynamoDB categories
 */
const CATEGORY_MAP = {
  // Audio
  headphone: "Audio",
  headphones: "Audio",
  earphone: "Audio",
  earphones: "Audio",
  earbud: "Audio",
  earbuds: "Audio",
  audio: "Audio",
  speaker: "Audio",
  speakers: "Audio",
  mic: "Audio",
  soundbar: "Audio",

  // Gaming
  gaming: "Gaming",
  game: "Gaming",
  mouse: "Gaming",
  keyboard: "Gaming",
  controller: "Gaming",
  gamepad: "Gaming",

  // Cameras
  camera: "Cameras",
  cameras: "Cameras",
  dslr: "Cameras",
  lens: "Cameras",
  tripod: "Cameras",
  webcam: "Cameras",
  gopro: "Cameras",

  // Electronics
  electronics: "Electronics",
  laptop: "Electronics",
  phone: "Electronics",
  mobile: "Electronics",
  tablet: "Electronics",
  tv: "Electronics",
  monitor: "Electronics",

  // Wearables
  wearables: "Wearables",
  wearable: "Wearables",
  watch: "Wearables",
  smartwatch: "Wearables",
  fitness: "Wearables",
  band: "Wearables",

  // Accessories
  accessories: "Accessories",
  accessory: "Accessories",
  cable: "Accessories",
  charger: "Accessories",
  case: "Accessories",
  stand: "Accessories"
};

/**
 * Extracts price from natural language queries like "under 3000", "in 3000", "below 5000"
 */
function extractPriceFromQuery(text) {
  if (!text) return null;
  const match = text.match(/(?:under|below|less than|in|max|within|₹|rs\.?)\s*(\d{2,6})/i);
  if (match && match[1]) {
    return Number(match[1]);
  }
  return null;
}

/**
 * Cleans search query by removing common filler & intent words
 */
function cleanSearchQuery(text) {
  if (!text) return "";
  let clean = text.toLowerCase();
  
  // Remove currency and price phrases
  clean = clean.replace(/(?:under|below|less than|in|max|within|budget|price|cost|₹|rs\.?)\s*\d+/gi, "");

  // Remove common filler words
  const noiseWords = [
    "best", "top", "good", "cheap", "popular", "show", "me", "find",
    "search", "for", "i", "want", "looking", "can", "you", "give",
    "the", "a", "an", "some", "suggest", "recommend"
  ];

  const words = clean.split(/\s+/).filter((w) => w && !noiseWords.includes(w));
  return words.join(" ").trim();
}

/**
 * Gemini Tool / Function Declarations
 */
const functionDeclarations = [
  {
    name: "searchProducts",
    description: "Search the Shopiee catalog for products matching a user query, category, or budget. Categories: Audio, Gaming, Cameras, Electronics, Wearables, Accessories.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Search keywords e.g. 'headphone', 'keyboard', 'smartwatch'"
        },
        category: {
          type: "STRING",
          description: "Product category: 'Audio', 'Electronics', 'Gaming', 'Cameras', 'Wearables', 'Accessories'"
        },
        maxPrice: {
          type: "NUMBER",
          description: "Optional maximum price / budget filter in INR (e.g. 3000)"
        },
        inStockOnly: {
          type: "BOOLEAN",
          description: "Optional flag to show only products currently in stock"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "getProductDetails",
    description: "Retrieve comprehensive specifications, stock, price, and reviews for a specific product by its ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "The unique product ID e.g. 'p_12345'"
        }
      },
      required: ["productId"]
    }
  }
];

/**
 * Tool Execution Handlers
 */
const toolExecutors = {
  searchProducts: async (args) => {
    const rawQuery = (args?.query || "").trim();
    let maxPrice = args?.maxPrice !== undefined ? Number(args.maxPrice) : extractPriceFromQuery(rawQuery);
    const inStockOnly = Boolean(args?.inStockOnly);

    // Normalize category
    let category = args?.category ? args.category.trim() : null;
    if (category) {
      const lowerCat = category.toLowerCase();
      category = CATEGORY_MAP[lowerCat] || category;
    }

    // Clean search terms
    const cleanedQuery = cleanSearchQuery(rawQuery);

    // If query itself suggests a category (e.g., "headphone" -> Audio)
    if (!category) {
      const words = cleanedQuery.split(/\s+/);
      for (const w of words) {
        if (CATEGORY_MAP[w]) {
          category = CATEGORY_MAP[w];
          break;
        }
      }
    }

    try {
      let items = [];

      // Strategy 1: Targeted search with cleaned query and category
      if (cleanedQuery || category) {
        const res = await activeProductRepo.list({
          search: cleanedQuery || undefined,
          category: category || undefined,
          limit: 30
        });
        items = res.products || [];
      }

      // Strategy 2: If 0 items and category was inferred, fetch all products in that category
      if (items.length === 0 && category) {
        const catRes = await activeProductRepo.list({
          category,
          limit: 30
        });
        items = catRes.products || [];
      }

      // Strategy 3: If still 0 items, scan catalog and perform in-memory ranking
      if (items.length === 0) {
        const allRes = await activeProductRepo.list({ limit: 50 });
        const allItems = allRes.products || [];

        const keywords = (cleanedQuery || rawQuery).toLowerCase().split(/\s+/).filter(Boolean);
        items = allItems.filter((p) => {
          const text = `${p.name} ${p.category} ${p.description}`.toLowerCase();
          return keywords.some((kw) => text.includes(kw));
        });

        // If still 0, return all items so user gets relevant suggestions
        if (items.length === 0 && allItems.length > 0) {
          items = allItems.slice(0, 6);
        }
      }

      // Filter by maxPrice if specified
      if (maxPrice !== null && !isNaN(maxPrice) && maxPrice > 0) {
        const priceFiltered = items.filter((p) => Number(p.effectivePrice || p.price) <= maxPrice);
        if (priceFiltered.length > 0) {
          items = priceFiltered;
        }
      }

      // Filter by stock if requested
      if (inStockOnly) {
        const inStockItems = items.filter((p) => Number(p.stock) > 0);
        if (inStockItems.length > 0) {
          items = inStockItems;
        }
      }

      // Cap at top 6 products
      items = items.slice(0, 6);

      // Enrich with presigned S3 URLs and discount calculations
      const enrichedProducts = await Promise.all(
        items.map(async (prod) => {
          try {
            return await getProductWithImageUrl(prod);
          } catch {
            return prod;
          }
        })
      );

      return {
        count: enrichedProducts.length,
        products: enrichedProducts.map((p) => ({
          id: p.productId || p._id || p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          effectivePrice: p.effectivePrice || p.price,
          discountPercent: p.discountPercent || 0,
          stock: p.stock,
          rating: p.rating,
          imageUrl: p.imageUrl || p.image,
          warranty: p.warranty,
          description: (p.description || "").slice(0, 160)
        }))
      };
    } catch (error) {
      console.warn("[AI Tools] searchProducts error:", error.message);
      return { count: 0, products: [], error: error.message };
    }
  },

  getProductDetails: async (args) => {
    const { productId } = args || {};
    if (!productId) return { error: "productId is required" };

    try {
      const product = await activeProductRepo.findById(productId);
      if (!product) return { error: `Product with ID ${productId} not found.` };

      const enriched = await getProductWithImageUrl(product);
      return {
        id: enriched.productId || enriched._id,
        name: enriched.name,
        category: enriched.category,
        price: enriched.price,
        effectivePrice: enriched.effectivePrice || enriched.price,
        mrp: enriched.mrp,
        stock: enriched.stock,
        rating: enriched.rating,
        reviewsCount: enriched.reviewsCount,
        warranty: enriched.warranty,
        description: enriched.description,
        imageUrl: enriched.imageUrl || enriched.image
      };
    } catch (error) {
      console.warn("[AI Tools] getProductDetails error:", error.message);
      return { error: error.message };
    }
  }
};

module.exports = {
  functionDeclarations,
  toolExecutors,
  setProductRepository,
  getProductRepository,
  cleanSearchQuery,
  extractPriceFromQuery
};

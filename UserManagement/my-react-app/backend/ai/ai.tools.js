const ProductRepository = require("../repositories/productRepository");
const OrderRepository = require("../repositories/orderRepository");
const { getProductWithImageUrl } = require("../controllers/productController");

let activeProductRepo = new ProductRepository();
let activeOrderRepo = new OrderRepository();

function setProductRepository(repo) {
  activeProductRepo = repo;
}

function getProductRepository() {
  return activeProductRepo;
}

function setOrderRepository(repo) {
  activeOrderRepo = repo;
}

function getOrderRepository() {
  return activeOrderRepo;
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
  },
  {
    name: "getMyOrders",
    description: "Retrieve personal order history and delivery tracking status for the currently authenticated customer.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: {
          type: "NUMBER",
          description: "Maximum number of recent orders to retrieve (default 3)"
        }
      }
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
      const words = (cleanedQuery || rawQuery).toLowerCase().split(/\s+/);
      for (const w of words) {
        if (CATEGORY_MAP[w]) {
          category = CATEGORY_MAP[w];
          break;
        }
      }
    }

    try {
      // Fetch up to 100 products from repo to do smart multi-attribute scoring
      const allRes = await activeProductRepo.list({ limit: 100 });
      let allItems = allRes.products || [];

      // If repo returned 0 with limit, try with default options
      if (allItems.length === 0) {
        const fallbackRes = await activeProductRepo.list({});
        allItems = fallbackRes.products || [];
      }

      let items = [];

      if (allItems.length > 0) {
        const queryTokens = (cleanedQuery || rawQuery)
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length >= 2);

        // Score each item based on name, category, description, searchTerms, and budget
        const scored = allItems.map((prod) => {
          let relevance = 0;
          const pName = (prod.name || "").toLowerCase();
          const pCat = (prod.category || "").toLowerCase();
          const pDesc = (prod.description || "").toLowerCase();
          const pTerms = (prod.searchTerms || "").toLowerCase();
          const pPrice = Number(prod.effectivePrice || prod.price || 0);

          if (category && pCat.includes(category.toLowerCase())) {
            relevance += 30;
          }

          for (const token of queryTokens) {
            if (pName.includes(token)) relevance += 40;
            else if (pCat.includes(token)) relevance += 20;
            else if (pTerms.includes(token)) relevance += 15;
            else if (pDesc.includes(token)) relevance += 8;
          }

          // Only adjust for budget/stock if product has genuine topical relevance
          let score = relevance;
          if (score > 0) {
            if (maxPrice !== null && !isNaN(maxPrice) && maxPrice > 0) {
              if (pPrice <= maxPrice) {
                score += 25;
              } else {
                score -= 10;
              }
            }

            if (Number(prod.stock || 0) > 0) {
              score += 5;
            }
          }

          return { prod, score, pPrice };
        });

        // Pick matches with score > 0
        const matches = scored
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((s) => s.prod);

        if (matches.length > 0) {
          if (maxPrice !== null && !isNaN(maxPrice) && maxPrice > 0) {
            const withinBudget = matches.filter((p) => Number(p.effectivePrice || p.price) <= maxPrice);
            items = withinBudget.length > 0 ? withinBudget : matches;
          } else {
            items = matches;
          }
        } else if (category) {
          items = allItems.filter((p) => (p.category || "").toLowerCase() === category.toLowerCase());
        }

        // If still empty, return top products
        if (items.length === 0) {
          items = allItems.slice(0, 6);
        }
      }

      if (inStockOnly) {
        const inStockItems = items.filter((p) => Number(p.stock) > 0);
        if (inStockItems.length > 0) {
          items = inStockItems;
        }
      }

      // Cap at 6 products
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
  },

  /**
   * Strictly user-scoped order tracking: never accesses another customer's data
   */
  getMyOrders: async (args, user) => {
    const userId = user?.id || user?._id || user?.userId;
    if (!userId) {
      return {
        error: "Customer is not logged in. Tell the customer to log in to view and track their orders."
      };
    }

    try {
      const orderResult = await activeOrderRepo.findByUserId(userId, { limit: 5 });
      const orders = orderResult.orders || [];

      if (orders.length === 0) {
        return {
          count: 0,
          message: "You haven't placed any orders yet. Would you like to explore our trending products?"
        };
      }

      return {
        count: orders.length,
        orders: orders.slice(0, 3).map((o) => ({
          orderId: o.orderId || o._id,
          status: o.status,
          paymentStatus: o.paymentStatus,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          itemCount: o.products?.length || 0,
          items: (o.products || []).map((p) => `${p.name || 'Item'} (x${p.quantity || 1})`)
        }))
      };
    } catch (error) {
      console.warn("[AI Tools] getMyOrders error:", error.message);
      return { error: "Unable to retrieve order history right now." };
    }
  }
};

module.exports = {
  functionDeclarations,
  toolExecutors,
  setProductRepository,
  getProductRepository,
  setOrderRepository,
  getOrderRepository,
  cleanSearchQuery,
  extractPriceFromQuery
};

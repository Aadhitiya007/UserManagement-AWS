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
 * Synonym expansion map for common e-commerce search terms
 */
const SYNONYM_MAP = {
  tws: ["earbud", "earbuds", "wireless"],
  earpods: ["earbud", "earbuds", "earphone"],
  airpods: ["earbud", "earbuds", "wireless"],
  notebook: ["laptop"],
  ultrabook: ["laptop"],
  smartphone: ["phone", "mobile"],
  cellphone: ["phone", "mobile"],
  display: ["monitor", "tv"],
  screen: ["monitor", "tv"],
  anc: ["noise", "cancelling"],
  rgb: ["gaming", "keyboard", "mouse"]
};

/**
 * Fast bounded Levenshtein check (returns true if edit distance <= 1) for typo tolerance
 */
function isOneEditAway(a, b) {
  if (a === b) return true;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < lenA && j < lenB) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (lenA > lenB) i++;
      else if (lenB > lenA) j++;
      else {
        i++;
        j++;
      }
    }
  }
  if (i < lenA || j < lenB) edits++;
  return edits <= 1;
}

/**
 * Checks whether any word in text is within 1 edit of token (only for tokens >= 5 chars)
 */
function hasFuzzyWordMatch(text, token) {
  if (!text || !token || token.length < 5) return false;
  const stemToken = token.replace(/s$/, "");
  const words = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  return words.some((w) => {
    const stemW = w.replace(/s$/, "");
    return isOneEditAway(w, token) || isOneEditAway(stemW, stemToken);
  });
}

/**
 * Tool Execution Handlers
 */
const toolExecutors = {
  searchProducts: async (args) => {
    const rawQuery = (args?.query || "").trim();
    let maxPrice = args?.maxPrice !== undefined ? Number(args.maxPrice) : extractPriceFromQuery(rawQuery);
    const inStockOnly = Boolean(args?.inStockOnly);

    // Normalize explicit category vs inferred category
    let explicitCategory = args?.category ? args.category.trim() : null;
    if (explicitCategory) {
      const lowerCat = explicitCategory.toLowerCase();
      explicitCategory = CATEGORY_MAP[lowerCat] || explicitCategory;
    }

    // Clean search terms
    const cleanedQuery = cleanSearchQuery(rawQuery);

    // Infer category from query only as a fallback when no direct token match exists
    let inferredCategory = null;
    if (!explicitCategory) {
      const words = (cleanedQuery || rawQuery).toLowerCase().split(/\s+/);
      for (const w of words) {
        if (CATEGORY_MAP[w]) {
          inferredCategory = CATEGORY_MAP[w];
          break;
        }
      }
    }

    try {
      // Paginate through catalog (up to 500 items) so large catalogs (200+ products) are fully searchable
      let allItems = [];
      let cursor = null;
      let pageCount = 0;
      do {
        const pageRes = await activeProductRepo.list({
          limit: 100,
          ...(cursor ? { nextCursor: cursor } : {})
        });
        const batch = pageRes.products || [];
        if (batch.length === 0) break;
        allItems.push(...batch);
        cursor = pageRes.nextCursor || null;
        pageCount++;
      } while (cursor && allItems.length < 500 && pageCount < 5);

      let items = [];

      if (allItems.length > 0) {
        const queryTokens = (cleanedQuery || rawQuery)
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length >= 2);

        // Score each item based on exact match, fuzzy typo match, synonyms, category, and budget
        const scored = allItems.map((prod) => {
          let relevance = 0;
          const pName = (prod.name || "").toLowerCase();
          const pCat = (prod.category || "").toLowerCase();
          const pDesc = (prod.description || "").toLowerCase();
          const pTerms = (prod.searchTerms || "").toLowerCase();
          const pPrice = Number(prod.effectivePrice || prod.price || 0);

          if (explicitCategory && pCat.includes(explicitCategory.toLowerCase())) {
            relevance += 30;
          }

          for (const token of queryTokens) {
            if (pName.includes(token)) relevance += 40;
            else if (pCat.includes(token)) relevance += 20;
            else if (pTerms.includes(token)) relevance += 15;
            else if (pDesc.includes(token)) relevance += 8;
            else if (hasFuzzyWordMatch(pName, token)) relevance += 22;
            else if (hasFuzzyWordMatch(pDesc, token)) relevance += 6;
            else if (SYNONYM_MAP[token]) {
              const syns = SYNONYM_MAP[token];
              if (syns.some((s) => pName.includes(s))) relevance += 25;
              else if (syns.some((s) => pDesc.includes(s) || pTerms.includes(s))) relevance += 12;
            }
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
        } else if (explicitCategory || inferredCategory) {
          const targetCat = (explicitCategory || inferredCategory).toLowerCase();
          items = allItems.filter((p) => (p.category || "").toLowerCase() === targetCat);
        }

        // If still empty, do NOT fall back to arbitrary products — return empty to avoid hallucinations
        if (items.length === 0) {
          items = [];
        }
      }

      if (inStockOnly) {
        items = items.filter((p) => Number(p.stock) > 0);
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
          variants: p.variants || [],
          variantAttributes: p.variantAttributes || [],
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
        imageUrl: enriched.imageUrl || enriched.image,
        variants: enriched.variants || [],
        variantAttributes: enriched.variantAttributes || []
      };
    } catch (error) {
      console.warn("[AI Tools] getProductDetails error:", error.message);
      return { error: error.message };
    }
  },

  /**
   * Strictly user-scoped order tracking: only retrieves confirmed, paid orders for the active user
   */
  getMyOrders: async (args, user) => {
    const userId = user?.id || user?._id || user?.userId;
    if (!userId) {
      return {
        error: "Customer is not logged in. Tell the customer to log in to view and track their orders."
      };
    }

    try {
      const orderResult = await activeOrderRepo.findByUserId(userId, { limit: 15 });
      const rawOrders = orderResult.orders || [];

      // E-Commerce Filter: Exclude incomplete checkout attempts / unpaid drafts
      const confirmedOrders = rawOrders.filter((o) => {
        if (!o) return false;
        const isPaid = (o.paymentStatus || "").toLowerCase() === "paid";
        const isCod = (o.paymentMethod || "").toLowerCase() === "cashondelivery";
        const isFulfillmentActive = ["processing", "shipped", "out for delivery", "delivered"].includes(
          (o.status || "").toLowerCase()
        );
        if (o.paymentStatus === undefined && o.status === undefined) return true;
        return isPaid || isCod || isFulfillmentActive;
      });

      if (confirmedOrders.length === 0) {
        return {
          count: 0,
          orders: [],
          message: "You don't have any confirmed orders yet. Would you like to explore our trending products?"
        };
      }

      return {
        count: confirmedOrders.length,
        orders: confirmedOrders.slice(0, 3).map((o) => ({
          orderId: o.orderId || o._id,
          status: o.status || "Processing",
          paymentStatus: o.paymentStatus || "Paid",
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

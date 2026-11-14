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
 * Gemini Tool / Function Declarations
 */
const functionDeclarations = [
  {
    name: "searchProducts",
    description: "Search the Shopiee catalog for products matching a user query, category, or budget.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Search keywords e.g. 'wireless headphones', 'mechanical keyboard', 'watch'"
        },
        category: {
          type: "STRING",
          description: "Optional category filter: 'Audio', 'Electronics', 'Gaming', 'Cameras', 'Wearables', 'Accessories'"
        },
        maxPrice: {
          type: "NUMBER",
          description: "Optional maximum price / budget filter in INR"
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
 * Tool Execution Handlers (The "Hands" that interact with DynamoDB)
 */
const toolExecutors = {
  searchProducts: async (args) => {
    const { query = "", category, maxPrice, inStockOnly = false } = args || {};

    try {
      const result = await activeProductRepo.list({
        search: query.trim(),
        category: category ? category.trim() : undefined,
        limit: 20
      });

      let items = result.products || [];

      if (maxPrice !== undefined && Number(maxPrice) > 0) {
        items = items.filter((p) => Number(p.price) <= Number(maxPrice));
      }

      if (inStockOnly) {
        items = items.filter((p) => Number(p.stock) > 0);
      }

      // Limit returned items to top 6 to prevent context window bloat
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
  getProductRepository
};


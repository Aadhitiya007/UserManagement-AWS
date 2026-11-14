const assert = require("assert");
const { toolExecutors, setProductRepository } = require("../ai/ai.tools");
const { processChatMessage } = require("../ai/ai.service");
const { handleChat } = require("../ai/ai.controller");

console.log("=== Running AI Assistant Unit Tests ===");

// In-Memory Mock Product Repository for testing
class MockProductRepository {
  constructor() {
    this.products = [
      {
        productId: "p_headphone_01",
        name: "Wireless ANC Headphones",
        category: "Audio",
        price: 2499,
        stock: 15,
        rating: 4.7,
        image: "products/headphone.jpg",
        description: "Premium noise cancelling over-ear headphones with 40h battery."
      },
      {
        productId: "p_mouse_02",
        name: "Ergonomic Gaming Mouse",
        category: "Gaming",
        price: 1299,
        stock: 0,
        rating: 4.5,
        image: "products/mouse.jpg",
        description: "High DPI RGB lightweight gaming mouse."
      },
      {
        productId: "p_keyboard_03",
        name: "Mechanical Gaming Keyboard",
        category: "Gaming",
        price: 4999,
        stock: 5,
        rating: 4.8,
        image: "products/keyboard.jpg",
        description: "RGB hot-swappable mechanical keyboard."
      }
    ];
  }

  async list({ search, category } = {}) {
    let items = [...this.products];
    if (category) {
      items = items.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return { products: items, total: items.length };
  }

  async findById(productId) {
    return this.products.find((p) => p.productId === productId) || null;
  }
}

async function runTests() {
  const mockRepo = new MockProductRepository();
  setProductRepository(mockRepo);

  // 1. Tool test: searchProducts
  {
    const result = await toolExecutors.searchProducts({ query: "headphone" });
    assert.strictEqual(result.count, 1, "Should find 1 headphone");
    assert.strictEqual(result.products[0].name, "Wireless ANC Headphones");
    console.log("✓ PASS: toolExecutors.searchProducts finds matching product by query");
  }

  // 2. Tool test: maxPrice filter
  {
    const result = await toolExecutors.searchProducts({ query: "gaming", maxPrice: 2000 });
    assert.strictEqual(result.count, 1, "Should only return gaming items <= 2000");
    assert.strictEqual(result.products[0].name, "Ergonomic Gaming Mouse");
    console.log("✓ PASS: toolExecutors.searchProducts respects maxPrice filter");
  }

  // 3. Tool test: inStockOnly filter
  {
    const result = await toolExecutors.searchProducts({ query: "gaming", inStockOnly: true });
    assert.strictEqual(result.count, 1, "Should exclude out-of-stock items");
    assert.strictEqual(result.products[0].name, "Mechanical Gaming Keyboard");
    console.log("✓ PASS: toolExecutors.searchProducts respects inStockOnly filter");
  }

  // 4. Tool test: getProductDetails
  {
    const details = await toolExecutors.getProductDetails({ productId: "p_headphone_01" });
    assert.strictEqual(details.name, "Wireless ANC Headphones");
    assert.strictEqual(details.price, 2499);
    console.log("✓ PASS: toolExecutors.getProductDetails returns full product details");
  }

  // 5. Tool test: getProductDetails missing product
  {
    const details = await toolExecutors.getProductDetails({ productId: "non_existent_id" });
    assert.ok(details.error, "Should return error for missing product");
    console.log("✓ PASS: toolExecutors.getProductDetails gracefully handles 404");
  }

  // 6. AI Service Fallback Mode (offline / no API key)
  {
    const res = await processChatMessage({ message: "Looking for wireless headphones" });
    assert.ok(res.reply.length > 0, "Should generate fallback reply");
    assert.ok(Array.isArray(res.products), "Products should be an array");
    assert.strictEqual(res.products.length, 1);
    console.log("✓ PASS: processChatMessage executes graceful catalog search fallback");
  }

  // 7. Controller Input Validation
  {
    let statusCode = null;
    let jsonResponse = null;
    const req = { body: { message: "" } };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          }
        };
      }
    };

    await handleChat(req, res);
    assert.strictEqual(statusCode, 400, "Empty message should return 400");
    assert.strictEqual(jsonResponse.success, false);
    console.log("✓ PASS: handleChat validates and rejects empty message");
  }

  // 8. Controller Execution
  {
    let statusCode = null;
    let jsonResponse = null;
    const req = { body: { message: "Show me gaming products" } };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          }
        };
      }
    };

    await handleChat(req, res);
    assert.strictEqual(statusCode, 200, "Valid message should return 200");
    assert.strictEqual(jsonResponse.success, true);
    assert.ok(jsonResponse.reply);
    assert.ok(Array.isArray(jsonResponse.products));
    console.log("✓ PASS: handleChat processes message and returns structured JSON response");
  }

  // 9. Natural language query with price & filler words (The user's exact query)
  {
    const res = await processChatMessage({ message: "best headphone in 3000" });
    assert.ok(Array.isArray(res.products), "Should return array");
    assert.ok(res.products.length > 0, "Should find headphone under 3000");
    assert.strictEqual(res.products[0].name, "Wireless ANC Headphones");
    console.log("✓ PASS: processChatMessage successfully extracts intent & products for 'best headphone in 3000'");
  }

  console.log("\n=== AI Assistant Tests: All 9/9 passed ===\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});


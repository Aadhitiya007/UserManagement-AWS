require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.USE_DYNAMODB = "true";

const assert = require("assert");
const productController = require("../controllers/productController");

/**
 * In-memory Mock ProductRepository for controller unit tests.
 */
class InMemoryProductRepository {
  constructor() {
    this.products = new Map();
  }

  async findById(productId) {
    const item = this.products.get(productId);
    if (!item) return null;
    return { ...item };
  }

  async create(data) {
    const productId = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const product = {
      _id: productId,
      id: productId,
      productId,
      name: data.name,
      description: data.description || "",
      price: Number(data.price),
      category: data.category,
      stock: Number(data.stock || 0),
      image: data.image || "",
      rating: 0,
      reviewsCount: 0,
      reviews: [],
      createdAt: new Date().toISOString()
    };
    this.products.set(productId, product);
    return { ...product };
  }

  async update(productId, updateFields) {
    const existing = this.products.get(productId);
    if (!existing) {
      const err = new Error("Product not found");
      err.statusCode = 404;
      throw err;
    }
    Object.assign(existing, updateFields);
    return { ...existing };
  }

  async delete(productId) {
    if (!this.products.has(productId)) return false;
    this.products.delete(productId);
    return true;
  }

  async list(options = {}) {
    let items = Array.from(this.products.values()).map((p) => ({ ...p }));
    if (options.category) {
      items = items.filter((p) => p.category.toLowerCase() === options.category.toLowerCase());
    }
    if (options.search) {
      const term = options.search.toLowerCase();
      items = items.filter((p) =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))
      );
    }
    return { products: items, total: items.length };
  }

  async count() {
    return this.products.size;
  }

  async addReview(productId, { userId, userName, rating, comment }) {
    const product = this.products.get(productId);
    if (!product) {
      const err = new Error("Product not found");
      err.statusCode = 404;
      throw err;
    }

    const reviewId = `rev_${Date.now()}`;
    product.reviews.push({
      _id: reviewId,
      reviewId,
      userId,
      userName,
      rating: Number(rating),
      comment,
      createdAt: new Date().toISOString()
    });

    product.reviewsCount = product.reviews.length;
    const totalStars = product.reviews.reduce((sum, r) => sum + r.rating, 0);
    product.rating = Math.round((totalStars / product.reviews.length) * 10) / 10;

    return { ...product };
  }

  async getAllReviews() {
    const all = [];
    for (const p of this.products.values()) {
      for (const r of p.reviews) {
        all.push({
          _id: r._id,
          productId: p.productId,
          productName: p.name,
          productImage: p.image,
          userId: r.userId,
          userName: r.userName,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt
        });
      }
    }
    return all;
  }

  async deleteReview(productId, reviewId) {
    const product = this.products.get(productId);
    if (!product) {
      const err = new Error("Product not found");
      err.statusCode = 404;
      throw err;
    }

    const idx = product.reviews.findIndex((r) => r._id === reviewId || r.reviewId === reviewId);
    if (idx === -1) {
      const err = new Error("Review not found");
      err.statusCode = 404;
      throw err;
    }

    product.reviews.splice(idx, 1);
    product.reviewsCount = product.reviews.length;
    if (product.reviews.length > 0) {
      const totalStars = product.reviews.reduce((sum, r) => sum + r.rating, 0);
      product.rating = Math.round((totalStars / product.reviews.length) * 10) / 10;
    } else {
      product.rating = 0;
    }

    return { reviewsCount: product.reviewsCount, rating: product.rating };
  }
}

/**
 * In-memory Mock OrderRepository for review eligibility checks.
 */
class InMemoryOrderRepository {
  constructor() {
    this.verifiedPurchases = new Set(); // "userId:productId"
  }

  addVerifiedPurchase(userId, productId) {
    this.verifiedPurchases.add(`${userId}:${productId}`);
  }

  async checkReviewEligibility(userId, productId) {
    return this.verifiedPurchases.has(`${userId}:${productId}`);
  }
}

function createMockReqRes(options = {}) {
  const req = {
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers: options.headers || {},
    user: options.user || null,
    file: options.file || null
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  return { req, res };
}

async function runProductControllerTests() {
  console.log("=== Running DynamoDB Product Controller Tests ===\n");
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  ${err.message}`);
      if (err.stack) console.error(`  ${err.stack.split("\n")[1]}`);
    }
  }

  // 1. getProducts
  await test("productController.getProducts: returns array without page and paginated object with page", async () => {
    const mockRepo = new InMemoryProductRepository();
    productController.setProductRepository(mockRepo);

    await mockRepo.create({ name: "Monitor", price: 12000, category: "Electronics" });
    await mockRepo.create({ name: "Keyboard", price: 1500, category: "Electronics" });

    // Non-paginated request
    const { req: req1, res: res1 } = createMockReqRes({});
    await productController.getProducts(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.ok(Array.isArray(res1.body));
    assert.strictEqual(res1.body.length, 2);

    // Paginated request
    const { req: req2, res: res2 } = createMockReqRes({ query: { page: "1", limit: "1" } });
    await productController.getProducts(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.body.total, 2);
    assert.strictEqual(res2.body.page, 1);
    assert.ok(Array.isArray(res2.body.products));
  });

  // 2. getProductById
  await test("productController.getProductById: returns product and handles 404", async () => {
    const mockRepo = new InMemoryProductRepository();
    productController.setProductRepository(mockRepo);

    const created = await mockRepo.create({ name: "Webcam", price: 3000, category: "Accessories" });

    const { req: reqFound, res: resFound } = createMockReqRes({ params: { id: created.productId } });
    await productController.getProductById(reqFound, resFound);
    assert.strictEqual(resFound.statusCode, 200);
    assert.strictEqual(resFound.body.name, "Webcam");

    const { req: reqNotFound, res: resNotFound } = createMockReqRes({ params: { id: "p_missing" } });
    await productController.getProductById(reqNotFound, resNotFound);
    assert.strictEqual(resNotFound.statusCode, 404);
  });

  // 3. createProduct
  await test("productController.createProduct: validates inputs and creates product in DynamoDB", async () => {
    const mockRepo = new InMemoryProductRepository();
    productController.setProductRepository(mockRepo);

    // Missing required field
    const { req: reqInvalid, res: resInvalid } = createMockReqRes({ body: { name: "Incomplete" } });
    await productController.createProduct(reqInvalid, resInvalid);
    assert.strictEqual(resInvalid.statusCode, 400);

    // Valid product creation
    const { req: reqValid, res: resValid } = createMockReqRes({
      body: { name: "USB Hub", price: 799, category: "Accessories", stock: 25 }
    });
    await productController.createProduct(reqValid, resValid);
    assert.strictEqual(resValid.statusCode, 201);
    assert.strictEqual(resValid.body.message, "Product created successfully");
    assert.strictEqual(resValid.body.product.name, "USB Hub");
    assert.strictEqual(resValid.body.product.price, 799);
  });

  // 4. updateProduct & deleteProduct
  await test("productController.updateProduct & deleteProduct: updates and removes products", async () => {
    const mockRepo = new InMemoryProductRepository();
    productController.setProductRepository(mockRepo);

    const created = await mockRepo.create({ name: "Desk Lamp", price: 1200, category: "Furniture" });

    // Update
    const { req: reqUpdate, res: resUpdate } = createMockReqRes({
      params: { id: created.productId },
      body: { price: 1400, stock: 10 }
    });
    await productController.updateProduct(reqUpdate, resUpdate);
    assert.strictEqual(resUpdate.statusCode, 200);
    assert.strictEqual(resUpdate.body.product.price, 1400);
    assert.strictEqual(resUpdate.body.product.stock, 10);

    // Delete
    const { req: reqDelete, res: resDelete } = createMockReqRes({
      params: { id: created.productId }
    });
    await productController.deleteProduct(reqDelete, resDelete);
    assert.strictEqual(resDelete.statusCode, 200);
    assert.strictEqual(resDelete.body.message, "Product deleted successfully");

    // Verify deleted
    const check = await mockRepo.findById(created.productId);
    assert.strictEqual(check, null);
  });

  // 5. checkPurchaseEligibility & createProductReview
  await test("productController.reviews: enforces buyer verification before adding review", async () => {
    const mockRepo = new InMemoryProductRepository();
    const mockOrderRepo = new InMemoryOrderRepository();
    productController.setProductRepository(mockRepo);
    productController.setOrderRepository(mockOrderRepo);

    const product = await mockRepo.create({ name: "Gaming Headset", price: 4000, category: "Audio" });

    // Unverified user check
    const { req: reqCheckUnverified, res: resCheckUnverified } = createMockReqRes({
      user: { id: "u_stranger" },
      params: { id: product.productId }
    });
    await productController.checkPurchaseEligibility(reqCheckUnverified, resCheckUnverified);
    assert.strictEqual(resCheckUnverified.body.canReview, false);

    // Attempt review without purchase -> 403
    const { req: reqRevUnverified, res: resRevUnverified } = createMockReqRes({
      user: { id: "u_stranger", name: "Stranger" },
      params: { id: product.productId },
      body: { rating: 5, comment: "Looks cool" }
    });
    await productController.createProductReview(reqRevUnverified, resRevUnverified);
    assert.strictEqual(resRevUnverified.statusCode, 403);
    assert.ok(resRevUnverified.body.message.includes("verified buyers"));

    // Verify user purchase
    mockOrderRepo.addVerifiedPurchase("u_verified_buyer", product.productId);

    // Eligibility check now true
    const { req: reqCheckVerified, res: resCheckVerified } = createMockReqRes({
      user: { id: "u_verified_buyer" },
      params: { id: product.productId }
    });
    await productController.checkPurchaseEligibility(reqCheckVerified, resCheckVerified);
    assert.strictEqual(resCheckVerified.body.canReview, true);

    // Submit review successfully
    const { req: reqRevVerified, res: resRevVerified } = createMockReqRes({
      user: { id: "u_verified_buyer", name: "Verified Alice" },
      params: { id: product.productId },
      body: { rating: 5, comment: "Amazing sound quality!" }
    });
    await productController.createProductReview(reqRevVerified, resRevVerified);
    assert.strictEqual(resRevVerified.statusCode, 201);
    assert.strictEqual(resRevVerified.body.product.rating, 5);
    assert.strictEqual(resRevVerified.body.product.reviewsCount, 1);
  });

  // 6. getAllReviews & deleteProductReview
  await test("productController.reviews: lists all reviews and deletes review by admin", async () => {
    const mockRepo = new InMemoryProductRepository();
    productController.setProductRepository(mockRepo);

    const product = await mockRepo.create({ name: "Tablet", price: 20000, category: "Electronics" });
    const updated = await mockRepo.addReview(product.productId, {
      userId: "u_1",
      userName: "User 1",
      rating: 4,
      comment: "Good tablet"
    });

    const reviewId = updated.reviews[0]._id;

    // Get all reviews
    const { req: reqAll, res: resAll } = createMockReqRes({});
    await productController.getAllReviews(reqAll, resAll);
    assert.strictEqual(resAll.statusCode, 200);
    assert.strictEqual(resAll.body.length, 1);
    assert.strictEqual(resAll.body[0].comment, "Good tablet");

    // Delete review
    const { req: reqDel, res: resDel } = createMockReqRes({
      params: { productId: product.productId, reviewId }
    });
    await productController.deleteProductReview(reqDel, resDel);
    assert.strictEqual(resDel.statusCode, 200);
    assert.strictEqual(resDel.body.reviewsCount, 0);
  });

  console.log(`\n=== Product Controller Test Results: ${passed}/${total} passed ===`);
  process.exit(passed === total ? 0 : 1);
}

runProductControllerTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});


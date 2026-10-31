require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.USE_DYNAMODB = "true";

const assert = require("assert");
const orderController = require("../controllers/orderController");
const paymentController = require("../controllers/paymentController");

class InMemoryProductRepo {
  constructor() {
    this.products = new Map();
  }

  addProduct(product) {
    this.products.set(product.productId, { ...product });
  }

  async findById(id) {
    return this.products.get(id) || null;
  }

  async findByIds(ids) {
    return ids.map((id) => this.products.get(id)).filter(Boolean);
  }

  async count() {
    return this.products.size;
  }
}

class InMemoryOrderRepo {
  constructor() {
    this.orders = new Map();
  }

  async findById(orderId) {
    return this.orders.get(orderId) || null;
  }

  async createOrderWithStockDeduction({ userId, userName, userEmail, rawProducts, productRepo }) {
    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      throw new Error("Cart is empty. Products array is required.");
    }

    const consolidated = new Map();
    for (const item of rawProducts) {
      const id = String(item.productId);
      const qty = Number(item.quantity);
      if (consolidated.has(id)) {
        consolidated.get(id).quantity += qty;
      } else {
        consolidated.set(id, { productId: id, quantity: qty });
      }
    }

    const ids = Array.from(consolidated.keys());
    const products = await productRepo.findByIds(ids);

    let total = 0;
    const validated = [];
    for (const p of products) {
      const item = consolidated.get(p.productId);
      if (p.stock < item.quantity) {
        const err = new Error(`Insufficient stock for "${p.name}".`);
        err.statusCode = 400;
        throw err;
      }
      p.stock -= item.quantity;
      total += p.price * item.quantity;
      validated.push({
        productId: p.productId,
        name: p.name,
        price: p.price,
        quantity: item.quantity,
        image: p.image || ""
      });
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const order = {
      _id: orderId,
      id: orderId,
      orderId,
      userId,
      userName,
      userEmail,
      products: validated,
      purchasedProductIds: ids,
      totalAmount: total,
      status: "Pending",
      paymentStatus: "Pending",
      paymentMethod: "Card",
      paymentDetails: {},
      paymentAttempts: [],
      createdAt: new Date().toISOString()
    };

    this.orders.set(orderId, order);
    return { ...order };
  }

  async findByUserId(userId) {
    const list = Array.from(this.orders.values()).filter((o) => o.userId === userId);
    return { orders: list };
  }

  async listAllOrders(options = {}) {
    let list = Array.from(this.orders.values());
    if (options.status) {
      list = list.filter((o) => o.status === options.status);
    }
    return { orders: list };
  }

  async updateStatusWithStockRestoration(orderId, newStatus) {
    const order = this.orders.get(orderId);
    if (!order) {
      const err = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.status === newStatus) return order;

    if (newStatus !== "Cancelled" && order.paymentStatus !== "Paid") {
      const err = new Error("Cannot advance status because payment is still Pending.");
      err.statusCode = 400;
      throw err;
    }

    order.status = newStatus;
    return { ...order };
  }

  async updatePaymentStatus(orderId, { paymentStatus, paymentMethod, paymentDetails, failureReason, shouldAdvanceStatus }) {
    const order = this.orders.get(orderId);
    if (!order) {
      const err = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.status === "Cancelled") {
      const err = new Error("Cannot process payment for a cancelled order.");
      err.statusCode = 400;
      throw err;
    }

    order.paymentStatus = paymentStatus;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (paymentDetails) order.paymentDetails = paymentDetails;
    if (shouldAdvanceStatus && paymentStatus === "Paid" && order.status === "Pending") {
      order.status = "Processing";
    }

    return { ...order };
  }

  async cancelPendingPayment(orderId, userId, productRepo) {
    const order = this.orders.get(orderId);
    if (!order) return true;

    if (userId && order.userId !== userId) {
      const err = new Error("Access denied. Not your order.");
      err.statusCode = 403;
      throw err;
    }

    if (order.paymentStatus === "Paid") {
      const err = new Error("Cannot cancel an order that has already been paid.");
      err.statusCode = 400;
      throw err;
    }

    for (const item of order.products) {
      const p = await productRepo.findById(item.productId);
      if (p) p.stock += item.quantity;
    }

    this.orders.delete(orderId);
    return true;
  }

  async getStats() {
    const all = Array.from(this.orders.values());
    const totalOrders = all.length;
    const totalRevenue = all
      .filter((o) => o.paymentStatus === "Paid")
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    return { totalOrders, totalRevenue };
  }
}

class InMemoryUserRepo {
  async count() {
    return 10;
  }
}

function createMockReqRes(options = {}) {
  const req = {
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers: options.headers || {},
    user: options.user || null,
    app: {
      get: () => null // Mock io
    }
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

async function runOrderControllerTests() {
  console.log("=== Running DynamoDB Order & Payment Controller Tests ===\n");
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

  // 1. Checkout & stock deduction
  await test("orderController.createOrder: deducts stock atomically and creates order", async () => {
    const mockProductRepo = new InMemoryProductRepo();
    const mockOrderRepo = new InMemoryOrderRepo();
    orderController.setProductRepository(mockProductRepo);
    orderController.setOrderRepository(mockOrderRepo);

    mockProductRepo.addProduct({
      productId: "p_laptop",
      name: "Ultrabook",
      price: 60000,
      stock: 5
    });

    const { req, res } = createMockReqRes({
      user: { id: "u_buyer", name: "Bob", email: "bob@buyer.com" },
      body: {
        products: [{ productId: "p_laptop", quantity: 2 }]
      }
    });

    await orderController.createOrder(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.message, "Order placed successfully");
    assert.strictEqual(res.body.order.totalAmount, 120000);

    const productAfter = await mockProductRepo.findById("p_laptop");
    assert.strictEqual(productAfter.stock, 3); // 5 - 2 = 3
  });

  await test("orderController.createOrder: rejects when requested quantity exceeds stock", async () => {
    const mockProductRepo = new InMemoryProductRepo();
    const mockOrderRepo = new InMemoryOrderRepo();
    orderController.setProductRepository(mockProductRepo);
    orderController.setOrderRepository(mockOrderRepo);

    mockProductRepo.addProduct({
      productId: "p_rare",
      name: "Rare Book",
      price: 500,
      stock: 1
    });

    const { req, res } = createMockReqRes({
      user: { id: "u_buyer" },
      body: {
        products: [{ productId: "p_rare", quantity: 2 }]
      }
    });

    await orderController.createOrder(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.message.includes("Insufficient stock"));
  });

  // 2. User orders & admin list
  await test("orderController.getUserOrders & getAllOrders: returns orders correctly", async () => {
    const mockOrderRepo = new InMemoryOrderRepo();
    orderController.setOrderRepository(mockOrderRepo);

    mockOrderRepo.orders.set("ord_1", { _id: "ord_1", userId: "u_user1", totalAmount: 100 });
    mockOrderRepo.orders.set("ord_2", { _id: "ord_2", userId: "u_user2", totalAmount: 200 });

    const { req: reqUser, res: resUser } = createMockReqRes({ user: { id: "u_user1" } });
    await orderController.getUserOrders(reqUser, resUser);
    assert.strictEqual(resUser.statusCode, 200);
    assert.strictEqual(resUser.body.length, 1);
    assert.strictEqual(resUser.body[0]._id, "ord_1");

    const { req: reqAdmin, res: resAdmin } = createMockReqRes({ user: { id: "u_admin", role: "admin" } });
    await orderController.getAllOrders(reqAdmin, resAdmin);
    assert.strictEqual(resAdmin.statusCode, 200);
    assert.strictEqual(resAdmin.body.length, 2);
  });

  // 3. Status updates & admin stats
  await test("orderController.updateOrderStatus & getAdminStats: updates status and calculates revenue", async () => {
    const mockOrderRepo = new InMemoryOrderRepo();
    const mockProductRepo = new InMemoryProductRepo();
    const mockUserRepo = new InMemoryUserRepo();
    orderController.setOrderRepository(mockOrderRepo);
    orderController.setProductRepository(mockProductRepo);
    orderController.setUserRepository(mockUserRepo);

    mockOrderRepo.orders.set("ord_paid", {
      _id: "ord_paid",
      userId: "u_1",
      status: "Pending",
      paymentStatus: "Paid",
      totalAmount: 5000
    });

    // Advance to Processing
    const { req: reqStatus, res: resStatus } = createMockReqRes({
      params: { id: "ord_paid" },
      body: { status: "Processing" }
    });
    await orderController.updateOrderStatus(reqStatus, resStatus);
    assert.strictEqual(resStatus.statusCode, 200);
    assert.strictEqual(resStatus.body.order.status, "Processing");

    // Stats
    const { req: reqStats, res: resStats } = createMockReqRes({});
    await orderController.getAdminStats(reqStats, resStats);
    assert.strictEqual(resStats.statusCode, 200);
    assert.strictEqual(resStats.body.totalOrders, 1);
    assert.strictEqual(resStats.body.totalRevenue, 5000);
  });

  // 4. Payment Controller: Status, Simulation & Retry
  await test("paymentController.simulatePayment: advances paid order to Processing", async () => {
    const mockOrderRepo = new InMemoryOrderRepo();
    paymentController.setOrderRepository(mockOrderRepo);

    mockOrderRepo.orders.set("ord_pay_me", {
      _id: "ord_pay_me",
      userId: "u_buyer",
      status: "Pending",
      paymentStatus: "Pending",
      totalAmount: 1000
    });

    const { req, res } = createMockReqRes({
      user: { id: "u_buyer" },
      body: { orderId: "ord_pay_me", shouldSucceed: true, paymentMethod: "UPI" }
    });

    await paymentController.simulatePayment(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.order.paymentStatus, "Paid");
    assert.strictEqual(res.body.order.status, "Processing");
  });

  // 5. Payment Controller: Cancel unpaid order and restore stock
  await test("paymentController.cancelPendingPayment: restores stock for unpaid order", async () => {
    const mockOrderRepo = new InMemoryOrderRepo();
    const mockProductRepo = new InMemoryProductRepo();
    paymentController.setOrderRepository(mockOrderRepo);
    paymentController.setProductRepository(mockProductRepo);

    mockProductRepo.addProduct({ productId: "p_stock_item", name: "T-Shirt", stock: 10 });
    mockOrderRepo.orders.set("ord_unpaid", {
      _id: "ord_unpaid",
      userId: "u_buyer",
      paymentStatus: "Pending",
      products: [{ productId: "p_stock_item", quantity: 3 }]
    });

    const { req, res } = createMockReqRes({
      user: { id: "u_buyer" },
      body: { orderId: "ord_unpaid" }
    });

    await paymentController.cancelPendingPayment(req, res);
    assert.strictEqual(res.statusCode, 200);

    const productAfter = await mockProductRepo.findById("p_stock_item");
    assert.strictEqual(productAfter.stock, 13); // 10 + 3 restored
  });

  console.log(`\n=== Order & Payment Controller Test Results: ${passed}/${total} passed ===`);
  process.exit(passed === total ? 0 : 1);
}

runOrderControllerTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});


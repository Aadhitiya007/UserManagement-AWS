require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-123456";
process.env.USE_DYNAMODB = "true";
process.env.NODE_ENV = "test";
process.env.RAZORPAY_KEY_ID = "rzp_test_testkey123";
process.env.RAZORPAY_KEY_SECRET = "rzp_secret_secret456";

const assert = require("assert");
const crypto = require("crypto");
const paymentController = require("../controllers/paymentController");

class MockOrderRepo {
  constructor() {
    this.orders = new Map();
  }

  async findById(orderId) {
    return this.orders.get(orderId) || null;
  }

  async updatePaymentStatus(orderId, updateData) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("Order not found");
    const updated = {
      ...order,
      status: updateData.status || order.status,
      paymentStatus: updateData.paymentStatus,
      paymentMethod: updateData.paymentMethod,
      paymentDetails: updateData.paymentDetails,
      updatedAt: new Date().toISOString()
    };
    this.orders.set(orderId, updated);
    return updated;
  }
}

async function runRazorpayTests() {
  console.log("=== Running Razorpay Payments & Tax Invoice Unit Tests ===");

  const mockRepo = new MockOrderRepo();
  paymentController.setOrderRepository(mockRepo);

  const testOrder = {
    _id: "ord_rzp_test_101",
    id: "ord_rzp_test_101",
    userId: "usr_alice",
    userEmail: "alice@example.com",
    totalAmount: 1499,
    status: "Pending",
    paymentStatus: "Pending",
    products: [
      { productId: "p1", name: "Premium Wireless Earbuds", price: 1499, quantity: 1 }
    ],
    pricing: { subtotal: 1499, deliveryFee: 0, finalTotal: 1499 }
  };
  mockRepo.orders.set("ord_rzp_test_101", testOrder);

  // 1. Create Razorpay order
  let resStatus = 200;
  let resData = null;
  const mockRes = {
    status(code) { resStatus = code; return this; },
    json(data) { resData = data; return this; }
  };

  await paymentController.createRazorpayOrder({
    body: { orderId: "ord_rzp_test_101" },
    user: { id: "usr_alice", email: "alice@example.com", name: "Alice" }
  }, mockRes);

  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resData.success, true);
  assert.strictEqual(resData.amount, 149900);
  assert.strictEqual(resData.currency, "INR");
  const createdRazorpayOrderId = resData.razorpayOrderId;
  assert.ok(createdRazorpayOrderId);
  console.log("✓ PASS: paymentController.createRazorpayOrder: creates order with paise amount and INR currency");

  // 2. Signature verification with invalid signature
  await paymentController.verifyRazorpayPayment({
    body: {
      orderId: "ord_rzp_test_101",
      razorpay_order_id: createdRazorpayOrderId,
      razorpay_payment_id: "pay_test_12345",
      razorpay_signature: "invalid_tampered_signature"
    },
    user: { id: "usr_alice" },
    app: { get: () => null }
  }, mockRes);

  assert.strictEqual(resStatus, 400);
  assert.ok(resData.message.includes("Invalid payment signature"));
  console.log("✓ PASS: paymentController.verifyRazorpayPayment: blocks invalid or tampered payment signature");

  // 3. Signature verification with valid signature
  const validPaymentId = "pay_valid_998877";
  const validSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${createdRazorpayOrderId}|${validPaymentId}`)
    .digest("hex");

  await paymentController.verifyRazorpayPayment({
    body: {
      orderId: "ord_rzp_test_101",
      razorpay_order_id: createdRazorpayOrderId,
      razorpay_payment_id: validPaymentId,
      razorpay_signature: validSignature
    },
    user: { id: "usr_alice", email: "alice@example.com" },
    app: { get: () => null }
  }, mockRes);

  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resData.success, true);

  const updatedOrder = await mockRepo.findById("ord_rzp_test_101");
  assert.strictEqual(updatedOrder.paymentStatus, "Paid");
  assert.strictEqual(updatedOrder.status, "Processing");
  assert.strictEqual(updatedOrder.paymentMethod, "Razorpay");
  assert.strictEqual(updatedOrder.paymentDetails.transactionId, validPaymentId);
  console.log("✓ PASS: paymentController.verifyRazorpayPayment: updates order to Paid and dispatches Tax Invoice");

  console.log("\n=== Razorpay Payment Test Results: All 3/3 passed ===\n");
}

runRazorpayTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});

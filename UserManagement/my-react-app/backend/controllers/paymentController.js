const crypto = require("crypto");
const OrderRepository = require("../repositories/orderRepository");
const ProductRepository = require("../repositories/productRepository");

let activeOrderRepo = new OrderRepository();
let activeProductRepo = new ProductRepository();

exports.setOrderRepository = (repo) => {
  activeOrderRepo = repo;
};
exports.getOrderRepository = () => activeOrderRepo;

exports.setProductRepository = (repo) => {
  activeProductRepo = repo;
};
exports.getProductRepository = () => activeProductRepo;

/**
 * 1. Get Payment & Fulfillment Status for an Order
 * GET /api/payment/:orderId
 */
exports.getOrderPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await activeOrderRepo.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    return res.json({
      orderId: order._id,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus || "Pending",
      paymentMethod: order.paymentMethod || "Card",
      paymentDetails: order.paymentDetails || {},
      paymentAttempts: order.paymentAttempts || [],
      products: order.products,
      createdAt: order.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Simulate Payment Outcome (Development / Testing Only)
 * POST /api/payment/simulate
 */
exports.simulatePayment = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_PAYMENT_SIMULATION !== "true") {
      return res.status(403).json({
        message: "Payment simulation is disabled in production environments."
      });
    }

    const { orderId, shouldSucceed, paymentMethod } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Valid Order ID is required." });
    }

    const order = await activeOrderRepo.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({
        message: "Cannot process payment for a cancelled order."
      });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(200).json({
        success: true,
        message: "Order is already paid",
        order
      });
    }

    const attemptId = `ATTEMPT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const selectedMethod = paymentMethod || "Card";

    if (shouldSucceed) {
      const updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Paid",
        paymentMethod: selectedMethod,
        paymentDetails: {
          transactionId: attemptId,
          paidAt: new Date().toISOString()
        },
        paymentAttempt: {
          attemptId,
          method: selectedMethod,
          status: "Success",
          createdAt: new Date().toISOString()
        },
        shouldAdvanceStatus: true
      });

      const io = req.app.get("io");
      if (io) {
        const payload = {
          orderId: updated._id,
          status: updated.status,
          paymentStatus: updated.paymentStatus
        };
        io.to(`order_${updated._id}`)
          .to(`user_${updated.userId}`)
          .to("admins")
          .emit("orderStatusUpdated", payload);
      }

      return res.status(200).json({
        success: true,
        message: "Payment processed successfully!",
        order: updated
      });
    } else {
      const failureReason = "Payment authorization declined by cardholder bank (Simulation)";

      const updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Failed",
        paymentMethod: selectedMethod,
        paymentDetails: {
          failureReason
        },
        paymentAttempt: {
          attemptId,
          method: selectedMethod,
          status: "Failed",
          failureReason,
          createdAt: new Date().toISOString()
        },
        shouldAdvanceStatus: false
      });

      return res.status(400).json({
        success: false,
        message: "Payment failed. Please retry with an alternate payment method.",
        failureReason,
        order: updated
      });
    }
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 3. Cancel Pending Payment & Cleanly Release Stock
 * POST /api/payment/cancel-pending
 */
exports.cancelPendingPayment = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Valid Order ID is required." });
  }

  try {
    const order = await activeOrderRepo.findById(orderId);
    if (!order) {
      return res.json({
        success: true,
        message: "Pending order cancelled, inventory restored, and order removed successfully."
      });
    }

    await activeOrderRepo.cancelPendingPayment(orderId, req.user.id, activeProductRepo);

    const io = req.app.get("io");
    if (io) {
      const payload = { orderId, cancelled: true };
      io.to(`order_${orderId}`)
        .to(`user_${order.userId}`)
        .to("admins")
        .emit("orderStatusUpdated", payload);
    }

    return res.json({
      success: true,
      message: "Pending order cancelled, inventory restored, and order removed successfully."
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 4. Initiate Payment Order (Integration with Payment Gateway)
 * POST /api/payment/create-intent
 */
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId, provider = "mock" } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Valid Order ID is required." });
    }

    const order = await activeOrderRepo.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Order is already paid." });
    }

    const clientSecret = `pi_secret_${crypto.randomBytes(16).toString("hex")}`;
    const gatewayOrderId = `order_${crypto.randomBytes(12).toString("hex")}`;

    return res.json({
      success: true,
      orderId: order._id,
      amount: order.totalAmount,
      currency: "INR",
      provider,
      clientSecret,
      gatewayOrderId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 5. Handle Webhook from Payment Provider
 * POST /api/payment/webhook
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-payment-signature"] || req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "default_webhook_secret";

    if (!signature) {
      return res.status(400).json({ message: "Missing webhook signature header." });
    }

    const payloadString = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payloadString)
      .digest("hex");

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(401).json({ message: "Invalid webhook signature." });
    }

    const { event, orderId, transactionId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Invalid orderId in webhook payload." });
    }

    const order = await activeOrderRepo.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(200).json({ received: true, message: "Order is already paid." });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot apply payment to a cancelled order." });
    }

    if (event === "payment.succeeded") {
      const updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Paid",
        paymentMethod: "Webhook",
        paymentDetails: {
          transactionId: transactionId || `TXN_${Date.now()}`,
          paidAt: new Date().toISOString()
        },
        shouldAdvanceStatus: true
      });

      const io = req.app.get("io");
      if (io) {
        const payload = {
          orderId: updated._id,
          status: updated.status,
          paymentStatus: updated.paymentStatus
        };
        io.to(`order_${updated._id}`)
          .to(`user_${updated.userId}`)
          .to("admins")
          .emit("orderStatusUpdated", payload);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[PaymentWebhook] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Route aliases
exports.retryPayment = exports.initiatePayment;
exports.createPaymentIntent = exports.initiatePayment;

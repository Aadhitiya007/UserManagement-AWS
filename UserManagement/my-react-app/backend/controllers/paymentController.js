const crypto = require("crypto");
const OrderRepository = require("../repositories/orderRepository");
const ProductRepository = require("../repositories/productRepository");
const razorpayService = require("../services/razorpayService");
const { generateInvoiceHtml } = require("../utils/invoiceGenerator");
const sendEmail = require("../utils/sendEmail");
const { logAuditEvent } = require("../utils/logger");
const websocketService = require("../services/websocketService");

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
      paymentMethod: order.paymentMethod || "UPI",
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

    const { orderId, paymentMethod } = req.body;
    const shouldSucceed = req.body.shouldSucceed !== false;

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
    const selectedMethod = paymentMethod || "UPI";

    if (shouldSucceed) {
      const updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Paid",
        status: "Processing",
        paymentMethod: selectedMethod,
        paymentDetails: {
          transactionId: attemptId,
          paidAt: new Date().toISOString(),
          simulated: true
        },
        shouldAdvanceStatus: true
      });

      // Dispatch Tax Invoice Email
      try {
        const invoiceHtml = generateInvoiceHtml(updated, { isEmail: true });
        if (updated.userEmail) {
          await sendEmail({
            to: updated.userEmail,
            subject: `Official Tax Invoice - #INV-${(updated.orderId || updated._id).slice(-8).toUpperCase()}`,
            html: invoiceHtml
          });
        }
      } catch (emailErr) {
        console.warn("[Simulate] Invoice email dispatch warning:", emailErr.message);
      }

      return res.json({
        success: true,
        message: "Payment simulated successfully",
        order: updated
      });
    } else {
      const updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Failed",
        paymentMethod: selectedMethod,
        paymentDetails: {
          lastFailedAttemptId: attemptId,
          failedAt: new Date().toISOString(),
          errorReason: "Payment simulation declined"
        }
      });

      return res.status(400).json({
        success: false,
        message: "Simulated payment failed as requested.",
        order: updated
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Cancel an Unpaid Pending Order and Restore Reserved Stock
 * POST /api/payment/cancel
 */
exports.cancelPendingPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
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

    await activeOrderRepo.cancelPendingPayment(orderId, req.user.id, activeProductRepo);

    return res.json({
      success: true,
      message: "Unpaid order cancelled and reserved stock restored."
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 4. Initiate Payment Order
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
 * 5. Create Razorpay Order
 * POST /api/payment/razorpay/create-order
 */
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
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
      return res.status(400).json({ message: "Cannot checkout a cancelled order." });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Order is already paid." });
    }

    const rzpOrder = await razorpayService.createOrder({
      order,
      customerEmail: req.user.email || order.userEmail,
      customerPhone: req.user.phone || (order.shippingAddress && order.shippingAddress.phone)
    });

    return res.status(200).json({
      success: true,
      orderId: order._id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: rzpOrder.keyId,
      customer: {
        name: req.user.name || "Customer",
        email: req.user.email || order.userEmail,
        phone: req.user.phone || (order.shippingAddress && order.shippingAddress.phone) || ""
      }
    });
  } catch (error) {
    console.error("[Razorpay Create Order Error]:", error);
    res.status(500).json({ message: error.message || "Failed to create Razorpay order." });
  }
};

/**
 * 6. Cryptographically Verify Razorpay Payment and Dispatch Tax Invoice
 * POST /api/payment/razorpay/verify
 */
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing required Razorpay payment credentials." });
    }

    const order = await activeOrderRepo.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    const isValid = razorpayService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({ message: "Invalid payment signature. Verification failed." });
    }

    let updated = order;
    if (order.paymentStatus !== "Paid") {
      updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Paid",
        status: "Processing",
        paymentMethod: "Razorpay",
        paymentDetails: {
          provider: "razorpay",
          transactionId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          paidAt: new Date().toISOString()
        }
      });

      try {
        const invoiceHtml = generateInvoiceHtml(updated, { isEmail: true });
        const userEmail = updated.userEmail || (req.user && req.user.email);
        if (userEmail) {
          await sendEmail({
            to: userEmail,
            subject: `Official Tax Invoice - #INV-${(updated.orderId || updated._id).slice(-8).toUpperCase()}`,
            html: invoiceHtml
          });
        }
      } catch (emailErr) {
        console.warn("[Razorpay] Invoice email dispatch warning:", emailErr.message);
      }

      const io = req.app.get("io");
      const statusPayload = {
        orderId: updated._id,
        status: updated.status,
        paymentStatus: updated.paymentStatus
      };
      try {
        await Promise.allSettled([
          websocketService.broadcastToAdmins("orderStatusUpdated", statusPayload, io),
          websocketService.broadcastToUser(updated.userId, "orderStatusUpdated", statusPayload, io)
        ]);
      } catch (wsErr) {
        console.warn("[PaymentController] WebSocket broadcast error:", wsErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment successfully verified and invoice generated.",
      orderId: updated._id || updated.id
    });
  } catch (error) {
    console.error("[Razorpay Verify Error]:", error);
    res.status(500).json({ message: error.message || "Failed to verify Razorpay payment." });
  }
};

/**
 * 7. Handle HMAC / Provider Webhooks
 * POST /api/payment/webhook
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const hmacSig = req.headers["x-payment-signature"] || req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "default_webhook_secret";

    if (hmacSig) {
      const payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const computed = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      if (computed !== hmacSig) {
        return res.status(401).json({ message: "Invalid webhook HMAC signature." });
      }
    }

    const { orderId, paymentStatus, transactionId, event } = req.body;
    const targetOrderId = orderId || (req.body.payload && req.body.payload.payment?.entity?.notes?.orderId);

    if (targetOrderId && (paymentStatus === "Paid" || event === "payment.captured")) {
      const updated = await activeOrderRepo.updatePaymentStatus(targetOrderId, {
        paymentStatus: "Paid",
        status: "Processing",
        paymentMethod: "Razorpay",
        paymentDetails: {
          transactionId: transactionId || (req.body.payload?.payment?.entity?.id),
          webhookConfirmed: true,
          confirmedAt: new Date().toISOString()
        }
      });

      try {
        const invoiceHtml = generateInvoiceHtml(updated, { isEmail: true });
        if (updated.userEmail) {
          await sendEmail({
            to: updated.userEmail,
            subject: `Official Tax Invoice - #INV-${(updated.orderId || updated._id).slice(-8).toUpperCase()}`,
            html: invoiceHtml
          });
        }
      } catch (emailErr) {
        console.warn("[Webhook] Invoice email dispatch warning:", emailErr.message);
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

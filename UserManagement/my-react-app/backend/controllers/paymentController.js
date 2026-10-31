const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const OrderRepository = require("../repositories/orderRepository");
const ProductRepository = require("../repositories/productRepository");

let activeOrderRepo = new OrderRepository();
let activeProductRepo = new ProductRepository();

const shouldUseDynamo = () => {
  if (process.env.USE_DYNAMODB === "false") return false;
  if (process.env.USE_DYNAMODB === "true" || process.env.DB_CLIENT === "dynamodb") return true;
  return true;
};

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

    if (shouldUseDynamo()) {
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
    }

    // Fallback to legacy MongoDB
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    res.json({
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

    if (shouldUseDynamo()) {
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
          message: "Payment simulated successfully",
          attemptId,
          order: updated
        });
      }

      const failureReason = "Simulated issuer decline (Test simulation failure)";
      const updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Failed",
        paymentMethod: selectedMethod,
        failureReason,
        paymentDetails: {
          transactionId: attemptId,
          failureReason
        }
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

      return res.status(400).json({
        success: false,
        message: "Payment failed as requested in simulation",
        attemptId,
        order: updated
      });
    }

    // Fallback to legacy MongoDB
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Valid Order ID is required." });
    }

    const order = await Order.findById(orderId);
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
      order.paymentStatus = "Paid";
      if (order.status === "Pending") {
        order.status = "Processing";
      }
      order.paymentMethod = selectedMethod;
      order.paymentDetails = {
        transactionId: attemptId,
        paidAt: new Date()
      };

      order.paymentAttempts.push({
        attemptId,
        method: selectedMethod,
        status: "Success",
        createdAt: new Date()
      });

      await order.save();

      const io = req.app.get("io");
      if (io) {
        const payload = {
          orderId: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        };
        io.to(`order_${order._id}`)
          .to(`user_${order.userId}`)
          .to("admins")
          .emit("orderStatusUpdated", payload);
      }

      return res.status(200).json({
        success: true,
        message: "Payment simulated successfully",
        attemptId,
        order
      });
    }

    const failureReason = "Simulated issuer decline (Test simulation failure)";
    order.paymentStatus = "Failed";
    order.paymentMethod = selectedMethod;
    order.paymentDetails = {
      transactionId: attemptId,
      failureReason
    };

    order.paymentAttempts.push({
      attemptId,
      method: selectedMethod,
      status: "Failed",
      failureReason,
      createdAt: new Date()
    });

    await order.save();

    const io = req.app.get("io");
    if (io) {
      const payload = {
        orderId: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      };
      io.to(`order_${order._id}`)
        .to(`user_${order.userId}`)
        .to("admins")
        .emit("orderStatusUpdated", payload);
    }

    return res.status(400).json({
      success: false,
      message: "Payment failed as requested in simulation",
      attemptId,
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Production Payment Webhook Handler
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"] || req.headers["stripe-signature"];
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(500).json({ message: "Webhook secret is not configured on server." });
    }

    if (!signature) {
      return res.status(400).json({ message: "Missing webhook signature header." });
    }

    const payloadString = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
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

    if (shouldUseDynamo()) {
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

        return res.status(200).json({ received: true, status: "Paid" });
      }

      if (event === "payment.failed") {
        await activeOrderRepo.updatePaymentStatus(orderId, {
          paymentStatus: "Failed",
          paymentMethod: "Webhook",
          failureReason: "Payment failed at gateway",
          paymentDetails: {
            transactionId: transactionId || `FAIL_${Date.now()}`,
            failureReason: "Payment failed at gateway"
          }
        });

        return res.status(200).json({ received: true, status: "Failed" });
      }

      return res.status(200).json({ received: true, message: "Unhandled event type." });
    }

    // Fallback to legacy MongoDB
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid orderId in webhook payload." });
    }

    const order = await Order.findById(orderId);
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
      order.paymentStatus = "Paid";
      if (order.status === "Pending") {
        order.status = "Processing";
      }
      order.paymentDetails = {
        transactionId: transactionId || `TXN_${Date.now()}`,
        paidAt: new Date()
      };
      order.paymentAttempts.push({
        attemptId: transactionId || `TXN_${Date.now()}`,
        method: "Webhook",
        status: "Success",
        createdAt: new Date()
      });

      await order.save();

      const io = req.app.get("io");
      if (io) {
        const payload = {
          orderId: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        };
        io.to(`order_${order._id}`)
          .to(`user_${order.userId}`)
          .to("admins")
          .emit("orderStatusUpdated", payload);
      }

      return res.status(200).json({ received: true, status: "Paid" });
    }

    if (event === "payment.failed") {
      order.paymentStatus = "Failed";
      order.paymentDetails = {
        transactionId: transactionId || `FAIL_${Date.now()}`,
        failureReason: "Payment failed at gateway"
      };
      order.paymentAttempts.push({
        attemptId: transactionId || `FAIL_${Date.now()}`,
        method: "Webhook",
        status: "Failed",
        failureReason: "Payment failed at gateway",
        createdAt: new Date()
      });

      await order.save();

      return res.status(200).json({ received: true, status: "Failed" });
    }

    return res.status(200).json({ received: true, message: "Unhandled event type." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Retry an Unpaid or Failed Payment
 */
exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Valid Order ID is required" });
    }

    if (shouldUseDynamo()) {
      const order = await activeOrderRepo.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Not your order." });
      }

      if (order.status === "Cancelled") {
        return res.status(400).json({ message: "Cannot retry payment for a cancelled order." });
      }

      if (order.paymentStatus === "Paid") {
        return res.status(400).json({ message: "Cannot retry an order that is already paid." });
      }

      const updated = await activeOrderRepo.updatePaymentStatus(orderId, {
        paymentStatus: "Pending",
        paymentMethod: order.paymentMethod || "Card"
      });

      return res.json({
        success: true,
        message: "Order ready for payment retry",
        order: updated
      });
    }

    // Fallback to legacy MongoDB
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Valid Order ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot retry payment for a cancelled order." });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Cannot retry an order that is already paid." });
    }

    order.paymentStatus = "Pending";
    await order.save();

    res.json({
      success: true,
      message: "Order ready for payment retry",
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 5. Cancel an unpaid checkout session and restore stock
 */
exports.cancelPendingPayment = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Valid Order ID is required." });
  }

  if (shouldUseDynamo()) {
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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ message: error.message });
    }
  }

  // Fallback to legacy MongoDB
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ message: "Valid Order ID is required." });
  }

  const session = await mongoose.startSession();

  try {
    let deletedOrder = null;

    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        return;
      }

      if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
        const err = new Error("Access denied. Not your order.");
        err.statusCode = 403;
        throw err;
      }

      if (order.paymentStatus === "Paid") {
        const err = new Error("Cannot cancel an order that has already been paid.");
        err.statusCode = 400;
        throw err;
      }

      const removed = await Order.findOneAndDelete(
        { _id: orderId, paymentStatus: { $ne: "Paid" } },
        { session }
      );

      if (!removed) {
        return;
      }

      if (Array.isArray(removed.products)) {
        for (const item of removed.products) {
          if (item.productId && item.quantity > 0) {
            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: item.quantity } },
              { session }
            );
          }
        }
      }

      deletedOrder = removed;
    });

    if (deletedOrder) {
      const io = req.app.get("io");
      if (io) {
        const payload = { orderId: deletedOrder._id, cancelled: true };
        io.to(`order_${deletedOrder._id}`)
          .to(`user_${deletedOrder.userId}`)
          .to("admins")
          .emit("orderStatusUpdated", payload);
      }
    }

    return res.json({
      success: true,
      message: "Pending order cancelled, inventory restored, and order removed successfully."
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};

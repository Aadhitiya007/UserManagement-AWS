const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const OrderRepository = require("../repositories/orderRepository");
const ProductRepository = require("../repositories/productRepository");
const UserRepository = require("../repositories/userRepository");

let activeOrderRepo = new OrderRepository();
let activeProductRepo = new ProductRepository();
let activeUserRepo = new UserRepository();

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

exports.setUserRepository = (repo) => {
  activeUserRepo = repo;
};
exports.getUserRepository = () => activeUserRepo;

// Valid status lifecycle transitions
const ALLOWED_TRANSITIONS = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: []
};

/**
 * 1. Place a new Order
 */
exports.createOrder = async (req, res) => {
  const { products } = req.body;

  // 1. Validate inputs
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: "Cart is empty. Products array is required." });
  }

  if (shouldUseDynamo()) {
    try {
      const createdOrder = await activeOrderRepo.createOrderWithStockDeduction({
        userId: req.user.id,
        userName: req.user.name || "Customer",
        userEmail: req.user.email,
        rawProducts: products,
        productRepo: activeProductRepo
      });

      // Notify connected admin rooms of new order placement
      const io = req.app.get("io");
      if (io && createdOrder) {
        const payload = {
          orderId: createdOrder._id,
          userId: createdOrder.userId,
          status: createdOrder.status,
          paymentStatus: createdOrder.paymentStatus,
          totalAmount: createdOrder.totalAmount
        };
        io.to("admins").to(`user_${createdOrder.userId}`).emit("orderCreated", payload);
      }

      return res.status(201).json({
        message: "Order placed successfully",
        order: createdOrder
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        message: error.message || "Failed to process order."
      });
    }
  }

  // Fallback to legacy MongoDB
  const consolidatedMap = new Map();
  for (const item of products) {
    if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
      return res.status(400).json({ message: "Invalid product ID in order items." });
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: "Product quantity must be a positive integer." });
    }

    const idStr = item.productId.toString();
    if (consolidatedMap.has(idStr)) {
      consolidatedMap.get(idStr).quantity += qty;
    } else {
      consolidatedMap.set(idStr, {
        productId: new mongoose.Types.ObjectId(idStr),
        quantity: qty,
        image: item.image || ""
      });
    }
  }

  const session = await mongoose.startSession();
  let createdOrder = null;

  try {
    await session.withTransaction(async () => {
      let calculatedTotal = 0;
      const validatedProducts = [];

      for (const item of consolidatedMap.values()) {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, returnDocument: "after" }
        );

        if (!updatedProduct) {
          const existingProduct = await Product.findById(item.productId).session(session);
          if (!existingProduct) {
            const err = new Error(`Product with ID ${item.productId} not found.`);
            err.statusCode = 404;
            throw err;
          }
          const err = new Error(
            `Insufficient stock for "${existingProduct.name}". Only ${existingProduct.stock} available.`
          );
          err.statusCode = 400;
          throw err;
        }

        calculatedTotal += updatedProduct.price * item.quantity;
        validatedProducts.push({
          productId: updatedProduct._id,
          name: updatedProduct.name,
          price: updatedProduct.price,
          quantity: item.quantity,
          image: item.image || updatedProduct.image || ""
        });
      }

      const orders = await Order.create(
        [
          {
            userId: req.user.id,
            userName: req.user.name || "Customer",
            userEmail: req.user.email,
            products: validatedProducts,
            totalAmount: calculatedTotal,
            status: "Pending",
            paymentStatus: "Pending"
          }
        ],
        { session }
      );

      createdOrder = orders[0];
    });

    const io = req.app.get("io");
    if (io && createdOrder) {
      const payload = {
        orderId: createdOrder._id,
        userId: createdOrder.userId,
        status: createdOrder.status,
        paymentStatus: createdOrder.paymentStatus,
        totalAmount: createdOrder.totalAmount
      };
      io.to("admins").to(`user_${createdOrder.userId}`).emit("orderCreated", payload);
    }

    return res.status(201).json({
      message: "Order placed successfully",
      order: createdOrder
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to process order."
    });
  } finally {
    await session.endSession();
  }
};

/**
 * 2. Get Orders for the authenticated user
 */
exports.getUserOrders = async (req, res) => {
  try {
    if (shouldUseDynamo()) {
      const result = await activeOrderRepo.findByUserId(req.user.id);
      return res.json(result.orders);
    }

    // Fallback to legacy MongoDB
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Get All Orders (Admin only)
 */
exports.getAllOrders = async (req, res) => {
  try {
    if (shouldUseDynamo()) {
      const result = await activeOrderRepo.listAllOrders({ status: req.query.status });
      return res.json(result.orders);
    }

    // Fallback to legacy MongoDB
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Update Order Status with Strict Lifecycle Validation & Atomic Cancellation
 */
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  if (shouldUseDynamo()) {
    try {
      const updatedOrder = await activeOrderRepo.updateStatusWithStockRestoration(id, status);

      const io = req.app.get("io");
      if (io && updatedOrder) {
        const payload = {
          orderId: updatedOrder._id,
          status: updatedOrder.status,
          paymentStatus: updatedOrder.paymentStatus
        };
        io.to(`order_${updatedOrder._id}`)
          .to(`user_${updatedOrder.userId}`)
          .to("admins")
          .emit("orderStatusUpdated", payload);
      }

      return res.json({
        message: "Order status updated successfully",
        order: updatedOrder
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        message: error.message || "Failed to update order status."
      });
    }
  }

  // Fallback to legacy MongoDB
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid order ID format." });
  }

  const session = await mongoose.startSession();

  try {
    let updatedOrder = null;

    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);
      if (!order) {
        const err = new Error("Order not found");
        err.statusCode = 404;
        throw err;
      }

      if (order.status === status) {
        if (status === "Cancelled") {
          const err = new Error("Order is already cancelled.");
          err.statusCode = 400;
          throw err;
        }
        updatedOrder = order;
        return;
      }

      const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
      if (!allowedNext.includes(status)) {
        const err = new Error(
          `Invalid status transition from "${order.status}" to "${status}".`
        );
        err.statusCode = 400;
        throw err;
      }

      if (status !== "Cancelled" && order.paymentStatus !== "Paid") {
        const err = new Error(
          "Cannot advance status because payment is still Pending. Customer must complete payment first."
        );
        err.statusCode = 400;
        throw err;
      }

      if (status === "Cancelled") {
        const lockedOrder = await Order.findOneAndUpdate(
          { _id: id, status: { $in: ["Pending", "Processing", "Shipped"] } },
          { $set: { status: "Cancelled" } },
          { session, returnDocument: "after" }
        );

        if (!lockedOrder) {
          const err = new Error("Order cannot be cancelled in its current state.");
          err.statusCode = 400;
          throw err;
        }

        for (const item of lockedOrder.products) {
          if (item.productId && item.quantity > 0) {
            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: item.quantity } },
              { session }
            );
          }
        }

        updatedOrder = lockedOrder;
      } else {
        order.status = status;
        await order.save({ session });
        updatedOrder = order;
      }
    });

    const io = req.app.get("io");
    if (io && updatedOrder) {
      const payload = {
        orderId: updatedOrder._id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus
      };
      io.to(`order_${updatedOrder._id}`)
        .to(`user_${updatedOrder.userId}`)
        .to("admins")
        .emit("orderStatusUpdated", payload);
    }

    return res.json({
      message: "Order status updated successfully",
      order: updatedOrder
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to update order status."
    });
  } finally {
    await session.endSession();
  }
};

/**
 * 5. Admin Dashboard Statistics
 */
exports.getAdminStats = async (req, res) => {
  try {
    if (shouldUseDynamo()) {
      const [totalUsers, totalProducts, stats] = await Promise.all([
        activeUserRepo.count(),
        activeProductRepo.count(),
        activeOrderRepo.getStats()
      ]);

      return res.json({
        totalUsers,
        totalProducts,
        totalOrders: stats.totalOrders,
        totalRevenue: stats.totalRevenue
      });
    }

    // Fallback to legacy MongoDB
    const [totalUsers, totalProducts, totalOrders, paidOrders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.find({ paymentStatus: "Paid" }).select("totalAmount")
    ]);

    const totalRevenue = paidOrders.reduce((sum, ord) => sum + (Number(ord.totalAmount) || 0), 0);

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const OrderRepository = require("../repositories/orderRepository");
const ProductRepository = require("../repositories/productRepository");
const UserRepository = require("../repositories/userRepository");
const CouponRepository = require("../repositories/couponRepository");
const { logAuditEvent } = require("../utils/logger");
const { generateInvoiceHtml } = require("../utils/invoiceGenerator");
const websocketService = require("../services/websocketService");

let activeOrderRepo = new OrderRepository();
let activeProductRepo = new ProductRepository();
let activeUserRepo = new UserRepository();
let activeCouponRepo = new CouponRepository();

exports.setCouponRepository = (repo) => { activeCouponRepo = repo; };
exports.getCouponRepository = () => activeCouponRepo;

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

/**
 * 1. Place a new Order with DynamoDB Atomic Stock Decrement
 * POST /api/orders
 */
exports.createOrder = async (req, res) => {
  const { products, paymentMethod, couponCode } = req.body;

  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: "Order must contain at least one product." });
  }

  try {
    const createFn = typeof activeOrderRepo.createOrderWithStockDeduction === "function"
      ? activeOrderRepo.createOrderWithStockDeduction.bind(activeOrderRepo)
      : activeOrderRepo.createOrder.bind(activeOrderRepo);

    const createdOrder = await createFn({
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      rawProducts: products,
      products,
      productRepo: activeProductRepo,
      couponRepo: activeCouponRepo,
      paymentMethod: paymentMethod || "Card",
      couponCode: couponCode || null
    });

    const orderPayload = {
      orderId: createdOrder._id,
      userId: createdOrder.userId,
      userName: createdOrder.userName,
      totalAmount: createdOrder.totalAmount,
      status: createdOrder.status,
      paymentStatus: createdOrder.paymentStatus,
      createdAt: createdOrder.createdAt
    };

    const io = req.app.get("io");
    websocketService.broadcastToAdmins("newOrder", orderPayload, io);
    websocketService.broadcastToUser(createdOrder.userId, "newOrder", orderPayload, io);

    logAuditEvent({
      category: "ORDER",
      action: "ORDER_CREATED",
      status: "SUCCESS",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ip: req.ip },
      target: { type: "ORDER", id: createdOrder._id, name: `Order ${createdOrder._id}` },
      details: { totalAmount: createdOrder.totalAmount, couponCode: createdOrder.couponCode, itemCount: products.length }
    });

    return res.status(201).json({
      message: "Order placed successfully",
      order: createdOrder
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to process order."
    });
  }
};

/**
 * 2. Get Logged-in Customer Orders
 * GET /api/orders/my-orders
 */
exports.getUserOrders = async (req, res) => {
  try {
    const result = await activeOrderRepo.findByUserId(req.user.id);
    return res.json(result.orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Get All Orders (Admin only)
 * GET /api/orders
 */
exports.getAllOrders = async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 100) : 50;
    const result = await activeOrderRepo.listAllOrders({
      status: req.query.status,
      limit,
      nextCursor: req.query.nextCursor || req.query.cursor
    });
    if (req.query.paginate === "true" || req.query.cursor || req.query.nextCursor) {
      return res.json(result);
    }
    return res.json(result.orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Update Order Status with Strict Lifecycle Validation & Atomic Cancellation
 * PUT /api/orders/:id/status
 */
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  try {
    const updatedOrder = await activeOrderRepo.updateStatusWithStockRestoration(id, status);

    const io = req.app.get("io");
    if (updatedOrder) {
      const payload = {
        orderId: updatedOrder._id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus
      };
      websocketService.broadcastToAdmins("orderStatusUpdated", payload, io);
      websocketService.broadcastToUser(updatedOrder.userId, "orderStatusUpdated", payload, io);
    }

    return res.json({
      message: "Order status updated successfully",
      order: updatedOrder
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to update order status."
    });
  }
};

/**
 * 5. Admin Dashboard Statistics
 * GET /api/orders/stats
 */
exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers = typeof activeUserRepo.count === "function" ? await activeUserRepo.count() : 0;
    const totalProducts = typeof activeProductRepo.count === "function" ? await activeProductRepo.count() : 0;
    const stats = typeof activeOrderRepo.getStats === "function" ? await activeOrderRepo.getStats() : { totalOrders: 0, totalRevenue: 0 };

    let outOfStockCount = 0;
    try {
      if (typeof activeProductRepo.list === "function") {
        const prodResult = await activeProductRepo.list({ limit: 100 });
        const prods = Array.isArray(prodResult) ? prodResult : (prodResult?.products || []);
        outOfStockCount = prods.filter((p) => Number(p.stock) <= 0).length;
      }
    } catch {
      outOfStockCount = 0;
    }

    let activeCoupons = 0;
    try {
      if (typeof activeCouponRepo.listAll === "function") {
        const couponsList = await activeCouponRepo.listAll();
        if (Array.isArray(couponsList)) {
          activeCoupons = couponsList.filter((c) => c.isActive && new Date(c.expirationDate) > new Date()).length;
        }
      }
    } catch {
      activeCoupons = 0;
    }

    let paidOrders = stats.paidOrders !== undefined ? Number(stats.paidOrders) : null;
    let pendingOrders = stats.pendingOrders !== undefined ? Number(stats.pendingOrders) : null;

    if (paidOrders === null || pendingOrders === null) {
      if (typeof activeOrderRepo.listAllOrders === "function") {
        try {
          const listRes = await activeOrderRepo.listAllOrders({ limit: 100 });
          const orderItems = Array.isArray(listRes) ? listRes : (listRes?.orders || []);
          paidOrders = orderItems.filter((o) => o.paymentStatus === "Paid").length;
          pendingOrders = orderItems.filter((o) => o.status === "Pending" || o.paymentStatus === "Pending").length;
        } catch {
          paidOrders = 0;
          pendingOrders = 0;
        }
      } else {
        paidOrders = 0;
        pendingOrders = 0;
      }
    }

    return res.status(200).json({
      totalUsers: totalUsers || 0,
      totalProducts: totalProducts || 0,
      totalOrders: stats.totalOrders || 0,
      totalRevenue: stats.totalRevenue || 0,
      pendingOrders: pendingOrders || 0,
      paidOrders: paidOrders || 0,
      outOfStockCount,
      activeCoupons
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 6. Get Order Tax Invoice
 * GET /api/orders/:id/invoice
 */
exports.getOrderInvoice = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await activeOrderRepo.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized to access this order invoice" });
    }

    const html = generateInvoiceHtml(order, { isEmail: false });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to generate invoice." });
  }
};

const OrderRepository = require("../repositories/orderRepository");
const ProductRepository = require("../repositories/productRepository");
const UserRepository = require("../repositories/userRepository");
const CouponRepository = require("../repositories/couponRepository");
const { logAuditEvent } = require("../utils/logger");

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

    const io = req.app.get("io");
    if (io) {
      const orderPayload = {
        orderId: createdOrder._id,
        userId: createdOrder.userId,
        userName: createdOrder.userName,
        totalAmount: createdOrder.totalAmount,
        status: createdOrder.status,
        paymentStatus: createdOrder.paymentStatus,
        createdAt: createdOrder.createdAt
      };
      io.to("admins").emit("newOrder", orderPayload);
      io.to(`user_${createdOrder.userId}`).emit("newOrder", orderPayload);
    }

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
    const result = await activeOrderRepo.listAllOrders({ status: req.query.status });
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

    const items = order.products || [];
    const invoiceNumber = `INV-${order.orderId.slice(-8).toUpperCase()}`;
    const invoiceDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    const subtotal = order.originalSubtotal || order.totalAmount || 0;
    const prodDiscount = order.productDiscountTotal || 0;
    const couponDisc = order.couponDiscount || 0;
    const delivery = order.deliveryFee || 0;
    const total = order.totalAmount || 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #f8fafc; }
    .invoice-card { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .company-title { font-size: 24px; font-weight: 800; color: #2563eb; margin: 0; }
    .invoice-title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0; text-align: right; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
    .meta-box h4 { margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
    th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .totals { width: 320px; margin-left: auto; font-size: 14px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .totals-grand { display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; font-weight: 800; color: #2563eb; border-top: 2px solid #0f172a; margin-top: 8px; }
    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { box-shadow: none; border: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <a href="javascript:history.back()" style="color: #2563eb; text-decoration: none; font-size: 14px;">← Back to Store</a>
      <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">🖨️ Print / Save as PDF</button>
    </div>

    <div class="header">
      <div>
        <h1 class="company-title">SHOPIEE</h1>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Official Tax Invoice & Delivery Receipt</p>
      </div>
      <div>
        <div class="invoice-title">TAX INVOICE</div>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 13px; text-align: right;">${invoiceNumber}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Billed & Shipped To:</h4>
        <strong>${order.userName || "Valued Customer"}</strong><br>
        Email: ${order.userEmail || "customer@example.com"}<br>
        Customer ID: ${order.userId}
      </div>
      <div class="meta-box" style="text-align: right;">
        <h4>Order Information:</h4>
        <strong>Order Date:</strong> ${invoiceDate}<br>
        <strong>Order Status:</strong> ${order.status}<br>
        <strong>Payment Status:</strong> ${order.paymentStatus} (${order.paymentMethod || "Card"})
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item Description</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${it.name}</strong></td>
            <td style="text-align: right;">₹${it.price}</td>
            <td style="text-align: center;">${it.quantity}</td>
            <td style="text-align: right;">₹${it.price * it.quantity}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Items Subtotal:</span>
        <span>₹${subtotal}</span>
      </div>
      ${prodDiscount > 0 ? `
      <div class="totals-row" style="color: #16a34a;">
        <span>Product Savings:</span>
        <span>- ₹${prodDiscount}</span>
      </div>` : ""}
      ${couponDisc > 0 ? `
      <div class="totals-row" style="color: #16a34a;">
        <span>Coupon Discount (${order.couponCode || 'PROMO'}):</span>
        <span>- ₹${couponDisc}</span>
      </div>` : ""}
      <div class="totals-row">
        <span>Estimated Delivery:</span>
        <span>${delivery === 0 ? "FREE" : "₹" + delivery}</span>
      </div>
      <div class="totals-grand">
        <span>Total Paid:</span>
        <span>₹${total}</span>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for shopping with Shopiee! This is an authentic computer-generated tax invoice.</p>
      <p>Order ID: ${order.orderId} | Powered by AWS Lambda & DynamoDB</p>
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to generate invoice." });
  }
};

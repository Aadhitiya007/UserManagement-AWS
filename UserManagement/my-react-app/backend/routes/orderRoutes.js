const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireStaff } = require("../middleware/roleMiddleware");
const {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  getAdminStats,
  getOrderInvoice,
  updateOrderAddress,
  reclaimExpiredOrders
} = require("../controllers/orderController");

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many checkout requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/reclaim-expired", reclaimExpiredOrders);
router.post("/", orderLimiter, verifyToken, createOrder);
router.get("/my-orders", verifyToken, getUserOrders);
router.get("/", verifyToken, requireStaff, getAllOrders);
router.get("/stats", verifyToken, requireStaff, getAdminStats);
router.put("/:id/address", verifyToken, updateOrderAddress);
router.put("/:id/status", verifyToken, requireStaff, updateOrderStatus);
router.get("/:id/invoice", verifyToken, getOrderInvoice);

module.exports = router;

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");
const {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  getAdminStats
} = require("../controllers/orderController");

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many checkout requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/", orderLimiter, verifyToken, createOrder);
router.get("/my-orders", verifyToken, getUserOrders);
router.get("/", verifyToken, requireAdmin, getAllOrders);
router.get("/stats", verifyToken, requireAdmin, getAdminStats);
router.put("/:id/status", verifyToken, requireAdmin, updateOrderStatus);

module.exports = router;

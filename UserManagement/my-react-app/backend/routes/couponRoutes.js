const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");
const {
  validateCoupon,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon
} = require("../controllers/couponController");

// Customer coupon validation endpoint (requires authenticated user)
router.post("/validate", verifyToken, validateCoupon);

// Admin-only management endpoints
router.get("/", verifyToken, requireAdmin, getAllCoupons);
router.post("/", verifyToken, requireAdmin, createCoupon);
router.put("/:id", verifyToken, requireAdmin, updateCoupon);
router.delete("/:id", verifyToken, requireAdmin, deleteCoupon);

module.exports = router;


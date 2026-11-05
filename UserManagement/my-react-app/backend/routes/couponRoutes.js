const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireStaff } = require("../middleware/roleMiddleware");
const {
  validateCoupon,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon
} = require("../controllers/couponController");

// Customer coupon validation endpoint (requires authenticated user)
router.post("/validate", verifyToken, validateCoupon);

// Staff management endpoints (Admin + Manager)
router.get("/", verifyToken, requireStaff, getAllCoupons);
router.post("/", verifyToken, requireStaff, createCoupon);
router.put("/:id", verifyToken, requireStaff, updateCoupon);
router.delete("/:id", verifyToken, requireStaff, deleteCoupon);

module.exports = router;


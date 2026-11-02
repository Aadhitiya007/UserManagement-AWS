const CouponRepository = require("../repositories/couponRepository");

let activeCouponRepo = new CouponRepository();

exports.setCouponRepository = (repo) => {
  activeCouponRepo = repo;
};
exports.getCouponRepository = () => activeCouponRepo;

/**
 * 1. Validate a Coupon at Checkout
 * POST /api/coupons/validate
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ valid: false, message: "Valid coupon code is required." });
    }

    const numSubtotal = Number(subtotal);
    if (isNaN(numSubtotal) || numSubtotal <= 0) {
      return res.status(400).json({ valid: false, message: "Valid cart subtotal is required." });
    }

    const userId = req.user?.id || null;
    const result = await activeCouponRepo.validateCoupon(code, numSubtotal, userId);

    if (!result.valid) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("[CouponController] Validation Error:", error.message);
    return res.status(500).json({ valid: false, message: error.message || "Failed to validate coupon." });
  }
};

/**
 * 2. Get All Coupons (Admin Only)
 * GET /api/coupons
 */
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await activeCouponRepo.listAll();
    return res.status(200).json(coupons);
  } catch (error) {
    console.error("[CouponController] List Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to fetch coupons." });
  }
};

/**
 * 3. Create Coupon (Admin Only)
 * POST /api/coupons
 */
exports.createCoupon = async (req, res) => {
  try {
    const coupon = await activeCouponRepo.create(req.body);
    return res.status(201).json({ message: "Coupon created successfully", coupon });
  } catch (error) {
    console.error("[CouponController] Create Error:", error.message);
    return res.status(error.status || 400).json({ message: error.message });
  }
};

/**
 * 4. Update Coupon (Admin Only)
 * PUT /api/coupons/:id
 */
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await activeCouponRepo.update(id, req.body);
    return res.status(200).json({ message: "Coupon updated successfully", coupon: updated });
  } catch (error) {
    console.error("[CouponController] Update Error:", error.message);
    return res.status(error.status || 400).json({ message: error.message });
  }
};

/**
 * 5. Delete Coupon (Admin Only)
 * DELETE /api/coupons/:id
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await activeCouponRepo.delete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    return res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("[CouponController] Delete Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to delete coupon." });
  }
};


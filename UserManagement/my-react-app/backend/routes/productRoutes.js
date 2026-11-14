const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireStaff } = require("../middleware/roleMiddleware");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  checkPurchaseEligibility,
  createProductReview,
  getAllReviews,
  deleteProductReview,
  seedCatalogController
} = require("../controllers/productController");

router.post("/seed-catalog", verifyToken, requireStaff, seedCatalogController);
router.get("/reviews/all", verifyToken, requireStaff, getAllReviews);
router.delete("/:productId/reviews/:reviewId", verifyToken, requireStaff, deleteProductReview);

router.get("/", getProducts);
router.get("/:id", getProductById);
router.get("/:id/can-review", verifyToken, checkPurchaseEligibility);
router.post("/:id/reviews", verifyToken, createProductReview);
router.post("/", verifyToken, requireStaff, upload.single("image"), createProduct);
router.put("/:id", verifyToken, requireStaff, upload.single("image"), updateProduct);
router.delete("/:id", verifyToken, requireStaff, deleteProduct);

module.exports = router;

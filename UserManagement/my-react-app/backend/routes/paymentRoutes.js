const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { verifyToken } = require("../middleware/authMiddleware");
const paymentController = require("../controllers/paymentController");

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many payment requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

// 1. Get payment status for verification
router.get("/:orderId", verifyToken, paymentController.getOrderPaymentStatus);


// 3. Production payment webhook (Stripe signature & HMAC verified inside controller)
router.post("/webhook", paymentController.handlePaymentWebhook);

// 3. Simulate payment outcome (Dev / Testing)
router.post("/simulate", paymentLimiter, verifyToken, paymentController.simulatePayment);

// 4. Retry payment on an existing unpaid order
router.post("/retry", paymentLimiter, verifyToken, paymentController.retryPayment);

// 5. Cancel an unpaid checkout session and restore stock
router.post("/cancel", paymentLimiter, verifyToken, paymentController.cancelPendingPayment);

// 6. Razorpay Create Order & Payment Verification
router.post("/razorpay/create-order", paymentLimiter, verifyToken, paymentController.createRazorpayOrder);
router.post("/razorpay/verify", paymentLimiter, verifyToken, paymentController.verifyRazorpayPayment);

module.exports = router;

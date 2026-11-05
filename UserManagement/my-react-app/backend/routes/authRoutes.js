const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { register, login, staffLogin, logout, forgotPassword, resetPassword, verifyEmail, resendVerification, generateTemporaryPassword } = require("../controllers/authController");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per 15 min window
  message: { message: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many password reset requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many password reset attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/staff-login", authLimiter, staffLogin);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.put("/reset-password/:token", resetPasswordLimiter, resetPassword);


router.get("/verify-email", verifyEmail);
router.post("/verify-email", resetPasswordLimiter, verifyEmail);
router.post("/resend-verification", forgotPasswordLimiter, resendVerification);
router.post("/generate-temp-password", forgotPasswordLimiter, generateTemporaryPassword);

module.exports = router;

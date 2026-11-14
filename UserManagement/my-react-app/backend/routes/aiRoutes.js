const express = require("express");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const { handleChat } = require("../ai/ai.controller");
const { parseCookies } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Rate Limiter for AI endpoints: 30 queries per minute per IP
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many requests to the AI shopping assistant. Please wait a minute before asking again."
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Optional Authentication Middleware
 * If a token is provided, decodes the user profile so the AI knows who they are.
 * If not provided, allows guest conversation to continue smoothly.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers?.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.token) token = cookies.token;
  }

  if (token && process.env.JWT_SECRET) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

// POST /api/ai/chat
router.post("/chat", aiLimiter, optionalAuth, handleChat);

module.exports = router;


const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/userRepository");
const sendEmail = require("../utils/sendEmail");

let activeUserRepo = new UserRepository();

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is missing.");
  }
  return process.env.JWT_SECRET;
};

exports.setUserRepository = (repo) => {
  activeUserRepo = repo;
};

exports.getUserRepository = () => activeUserRepo;

/**
 * 1. Customer / Admin Registration
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, age, country, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const user = await activeUserRepo.create({
        name,
        email,
        password: hashedPassword,
        role: "user",
        age,
        country,
        phone
      });

      const token = jwt.sign(
        { id: user.id || user._id, email: user.email, role: user.role, name: user.name },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      if (err.statusCode === 400 || err.status === 400 || err.name === "ConditionalCheckFailedException") {
        return res.status(400).json({ message: err.message || "User already exists with this email" });
      }
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: error.message || "Registration failed." });
  }
};

/**
 * 2. Customer / Admin Login
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await activeUserRepo.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id || user._id, email: user.email, role: user.role, name: user.name },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * 3. Secure Password Reset Request (Enumeration-Safe)
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  const genericResponse = {
    message: "If an account exists with this email, a password reset link has been sent."
  };

  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Valid email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    const result = await activeUserRepo.createPasswordResetToken(cleanEmail, hashedToken, expiresAt);
    if (result && result.user) {
      const frontendBaseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
      const resetUrl = `${frontendBaseUrl}/reset-password/${rawToken}`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; borderRadius: 8px;">
          <h2 style="color: #1e293b;">Shopiee Password Reset</h2>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `;

      try {
        await sendEmail({
          to: cleanEmail,
          subject: "Shopiee - Password Reset Request",
          html: htmlContent
        });
      } catch (emailErr) {
        console.warn("[Auth] Email delivery failure:", emailErr.message);
      }
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("[Auth] ForgotPassword Error:", error.message);
    return res.status(200).json(genericResponse);
  }
};

/**
 * 4. Atomically Consume Reset Token and Set New Password
 * PUT /api/auth/reset-password/:token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid or missing reset token." });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const newPasswordHash = await bcrypt.hash(password, 10);

    await activeUserRepo.consumePasswordResetToken(hashedToken, newPasswordHash);

    return res.status(200).json({
      success: true,
      message: "Password has been successfully reset. Please log in with your new password."
    });
  } catch (error) {
    console.error("[Auth] ResetPassword Error:", error.message);
    return res.status(error.status || 400).json({ message: error.message || "Failed to reset password." });
  }
};

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/userRepository");
const sendEmail = require("../utils/sendEmail");
const { logAuditEvent } = require("../utils/logger");

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

      // Generate email verification token & dispatch
      try {
        const rawVerifyToken = crypto.randomBytes(32).toString("hex");
        const hashedVerifyToken = crypto.createHash("sha256").update(rawVerifyToken).digest("hex");
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
        if (typeof activeUserRepo.createEmailVerificationToken === "function") {
          await activeUserRepo.createEmailVerificationToken(user.email, hashedVerifyToken, expiresAt);
        }
        const frontendBaseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
        const verifyUrl = `${frontendBaseUrl}/verify-email?token=${rawVerifyToken}`;

        await sendEmail({
          to: user.email,
          subject: "Verify Your Email - Shopiee",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e293b; margin-top: 0;">Welcome to Shopiee, ${user.name}!</h2>
              <p style="color: #475569; font-size: 15px; line-height: 1.5;">Thank you for registering. Please confirm your email address to activate your full account features:</p>
              <div style="margin: 28px 0;">
                <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="color: #94a3b8; font-size: 13px;">Or copy and paste this URL into your browser:<br/><span style="color: #2563eb;">${verifyUrl}</span></p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">This link expires in 24 hours.</p>
            </div>
          `
        });
      } catch (emailErr) {
        console.warn("[Auth] Email verification dispatch skipped/failed:", emailErr.message);
      }

      logAuditEvent({
        category: "AUTH",
        action: "USER_REGISTER",
        status: "SUCCESS",
        actor: {
          userId: user.id || user._id,
          email: user.email,
          role: user.role,
          ip: req.ip || req.connection?.remoteAddress
        },
        target: { type: "User", id: user.id || user._id, name: user.name },
        details: { message: "New customer registered", email: user.email }
      });

      return res.status(201).json({
        message: "User registered successfully",
        verificationSent: true,
        token,
        user: {
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified === true
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
      logAuditEvent({
        category: "AUTH",
        action: "USER_LOGIN_FAILED",
        status: "WARNING",
        actor: { email, role: "visitor", ip: req.ip || req.connection?.remoteAddress },
        target: { type: "User", name: email },
        details: { reason: "User not found" }
      });
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logAuditEvent({
        category: "AUTH",
        action: "USER_LOGIN_FAILED",
        status: "WARNING",
        actor: { userId: user.id || user._id, email: user.email, role: user.role, ip: req.ip || req.connection?.remoteAddress },
        target: { type: "User", id: user.id || user._id, name: user.name },
        details: { reason: "Incorrect password" }
      });
      return res.status(400).json({ message: "Invalid email or password" });
    }

    logAuditEvent({
      category: "AUTH",
      action: "USER_LOGIN",
      status: "SUCCESS",
      actor: {
        userId: user.id || user._id,
        email: user.email,
        role: user.role,
        ip: req.ip || req.connection?.remoteAddress
      },
      target: { type: "User", id: user.id || user._id, name: user.name },
      details: { message: "User successfully logged in" }
    });

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
        role: user.role,
        isEmailVerified: user.isEmailVerified === true
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * 2B. Staff & Manager Portal Login (Admin & Manager Only)
 * POST /api/auth/staff-login
 */
exports.staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Staff email and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await activeUserRepo.findByEmail(cleanEmail);

    if (!user) {
      logAuditEvent({
        category: "AUTH",
        action: "STAFF_LOGIN_FAILED",
        status: "WARNING",
        actor: { email: cleanEmail, role: "visitor", ip: req.ip || req.connection?.remoteAddress },
        target: { type: "StaffPortal" },
        details: { reason: "Account not found" }
      });
      return res.status(401).json({ message: "Invalid staff credentials." });
    }

    // STRICT ROLE GATE: Reject regular customer accounts
    if (user.role !== "admin" && user.role !== "manager") {
      logAuditEvent({
        category: "AUTH",
        action: "STAFF_LOGIN_BLOCKED",
        status: "WARNING",
        actor: { userId: user.id || user._id, email: user.email, role: user.role, ip: req.ip || req.connection?.remoteAddress },
        target: { type: "StaffPortal" },
        details: { reason: "Customer attempted staff portal access" }
      });
      return res.status(403).json({
        message: "Access Denied: This portal is reserved exclusively for Managers and Administrators. Customers must sign in via the storefront."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logAuditEvent({
        category: "AUTH",
        action: "STAFF_LOGIN_FAILED",
        status: "WARNING",
        actor: { userId: user.id || user._id, email: user.email, role: user.role, ip: req.ip || req.connection?.remoteAddress },
        target: { type: "StaffPortal" },
        details: { reason: "Incorrect password" }
      });
      return res.status(401).json({ message: "Invalid staff credentials." });
    }

    logAuditEvent({
      category: "AUTH",
      action: "STAFF_LOGIN",
      status: "SUCCESS",
      actor: {
        userId: user.id || user._id,
        email: user.email,
        role: user.role,
        ip: req.ip || req.connection?.remoteAddress
      },
      target: { type: "StaffPortal", id: user.id || user._id, name: user.name },
      details: { message: `Staff member logged in with role: ${user.role}` }
    });

    const token = jwt.sign(
      { id: user.id || user._id, email: user.email, role: user.role, name: user.name },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Staff authentication successful.",
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        portal: "staff"
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Staff login failed." });
  }
};

/**
 * Customer / Admin Logout
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let actor = {
      userId: "anonymous",
      email: req.body?.email || "anonymous",
      role: "visitor",
      ip: req.ip || req.connection?.remoteAddress
    };

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], getJwtSecret());
        actor = {
          userId: decoded.id || "anonymous",
          email: decoded.email || "anonymous",
          role: decoded.role || "user",
          ip: req.ip || req.connection?.remoteAddress
        };
      } catch (_) {
        // Token expired or invalid, still log logout
      }
    }

    logAuditEvent({
      category: "AUTH",
      action: "USER_LOGOUT",
      status: "SUCCESS",
      actor,
      target: { type: "User", id: actor.userId, name: actor.email },
      details: { message: "User logged out" }
    });

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Logout failed." });
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

      logAuditEvent({
        category: "AUTH",
        action: "PASSWORD_RESET_REQUESTED",
        status: "INFO",
        actor: { email: cleanEmail, role: "user", ip: req.ip || req.connection?.remoteAddress },
        target: { type: "User", name: cleanEmail },
        details: { message: "Password reset link sent to user email" }
      });
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

    logAuditEvent({
      category: "AUTH",
      action: "PASSWORD_RESET_COMPLETED",
      status: "SUCCESS",
      actor: { role: "user", ip: req.ip || req.connection?.remoteAddress },
      target: { type: "User" },
      details: { message: "Password reset completed successfully via token" }
    });

    return res.status(200).json({
      success: true,
      message: "Password has been successfully reset. Please log in with your new password."
    });
  } catch (error) {
    console.error("[Auth] ResetPassword Error:", error.message);
    return res.status(error.status || 400).json({ message: error.message || "Failed to reset password." });
  }
};

/**
 * 5. Verify User Email via Token
 * GET/POST /api/auth/verify-email
 */
exports.verifyEmail = async (req, res) => {
  try {
    const token = req.query.token || (req.body && req.body.token);
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Valid verification token is required." });
    }

    const hashedToken = crypto.createHash("sha256").update(token.trim()).digest("hex");
    const result = await activeUserRepo.consumeEmailVerificationToken(hashedToken);

    if (req.method === "GET" && req.headers.accept && req.headers.accept.includes("text/html")) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Email Verified - Shopiee</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 450px; }
              .icon { font-size: 48px; margin-bottom: 16px; }
              h1 { color: #16a34a; margin: 0 0 12px; font-size: 24px; }
              p { color: #64748b; font-size: 15px; margin-bottom: 24px; }
              .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✅</div>
              <h1>Email Verified Successfully!</h1>
              <p>Your email <strong>${result.email || ""}</strong> has been confirmed. You can now log in and access your orders, wishlist, and exclusive discounts.</p>
              <a href="/login" class="btn">Proceed to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now access all features.",
      userId: result.userId
    });
  } catch (error) {
    console.error("[Auth] VerifyEmail Error:", error.message);
    return res.status(error.status || 400).json({ message: error.message || "Failed to verify email." });
  }
};

/**
 * 6. Resend Email Verification Token
 * POST /api/auth/resend-verification
 */
exports.resendVerification = async (req, res) => {
  try {
    const email = (req.body && req.body.email) || (req.user && req.user.email);
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Valid email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await activeUserRepo.findByEmail(cleanEmail);
    if (!user) {
      return res.status(200).json({ message: "If an unverified account exists, a new verification link has been sent." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "This email account is already verified." });
    }

    const rawVerifyToken = crypto.randomBytes(32).toString("hex");
    const hashedVerifyToken = crypto.createHash("sha256").update(rawVerifyToken).digest("hex");
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await activeUserRepo.createEmailVerificationToken(cleanEmail, hashedVerifyToken, expiresAt);
    const frontendBaseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
    const verifyUrl = `${frontendBaseUrl}/verify-email?token=${rawVerifyToken}`;

    await sendEmail({
      to: cleanEmail,
      subject: "Verify Your Email - Shopiee",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Shopiee Email Verification</h2>
          <p style="color: #475569; font-size: 15px;">Click the button below to verify your email address:</p>
          <div style="margin: 28px 0;">
            <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">Or copy and paste this URL into your browser:<br/><span style="color: #2563eb;">${verifyUrl}</span></p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">This link expires in 24 hours.</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: "A new verification link has been sent to your email."
    });
  } catch (error) {
    console.error("[Auth] ResendVerification Error:", error.message);
    return res.status(500).json({ message: "Failed to resend verification link." });
  }
};

/**
 * 7. Generate Temporary Password
 * POST /api/auth/generate-temp-password
 */
exports.generateTemporaryPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Valid email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await activeUserRepo.findByEmail(cleanEmail);
    if (!user) {
      return res.status(200).json({ message: "If an account exists, credentials have been dispatched." });
    }

    const randomPart = crypto.randomBytes(6).toString("hex");
    const tempPassword = `Temp#${randomPart}!`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    if (typeof activeUserRepo.updateUserPassword === "function") {
      await activeUserRepo.updateUserPassword(user.id || user._id, hashedPassword);
    }

    await sendEmail({
      to: cleanEmail,
      subject: "Your Temporary Password - Shopiee",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">Shopiee Temporary Password</h2>
          <p style="color: #475569; font-size: 15px;">A temporary password has been generated for your account:</p>
          <div style="margin: 20px 0; background: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center;">
            <code style="font-size: 20px; font-weight: bold; color: #1e293b; letter-spacing: 2px;">${tempPassword}</code>
          </div>
          <p style="color: #ef4444; font-size: 14px; font-weight: 600;">For your security, please log in and change your password immediately.</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: "Temporary password generated and sent to email successfully."
    });
  } catch (error) {
    console.error("[Auth] GenerateTempPassword Error:", error.message);
    return res.status(500).json({ message: error.message || "Failed to generate temporary password." });
  }
};

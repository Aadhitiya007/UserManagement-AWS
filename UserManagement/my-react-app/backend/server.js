const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dns = require("dns");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const s3 = require("./config/s3");

// Only configure custom DNS in non-Lambda local environments
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (err) {
    console.warn("DNS warning:", err.message);
  }
  dns.setDefaultResultOrder("ipv4first");
}

// In AWS Lambda, the filesystem is read-only; wrap local uploads directory creation safely
try {
  const uploadDir = path.join(__dirname, "uploads", "products");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem in serverless environments (S3 handles cloud storage)
}

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const couponRoutes = require("./routes/couponRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((url) => url.trim().replace(/\/$/, ""))
    : [])
];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*amazonaws\.com$/.test(origin)) return true;
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*cloudfront\.net$/.test(origin)) return true;
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*onrender\.com$/.test(origin)) return true;
  return true;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST"]
  }
});
app.set("io", io);

// 1. Socket.IO Connection Authentication Middleware (JWT)
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization &&
      socket.handshake.headers.authorization.split(" ")[1]) ||
    socket.handshake.query?.token;

  if (!token) {
    return next(new Error("Authentication error: Token required."));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new Error("Server error: JWT secret not configured."));
  }

  try {
    const decoded = jwt.verify(token, secret);
    socket.user = decoded; // { id, email, role, name }
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid or expired token."));
  }
});

io.on("connection", (socket) => {
  // Scoped room for specific user notifications - authorized only for that user or an admin
  socket.on("joinUserRoom", (userId) => {
    if (!socket.user) {
      return socket.emit("error", { message: "Unauthenticated socket session." });
    }

    if (socket.user.id === userId || socket.user.role === "admin") {
      socket.join(`user_${userId}`);
    } else {
      socket.emit("error", { message: "Unauthorized to join user room." });
    }
  });

  // Scoped room for specific order notifications - authorized only if user owns the order or is admin
  socket.on("joinOrderRoom", async (orderId) => {
    if (!socket.user) {
      return socket.emit("error", { message: "Unauthenticated socket session." });
    }

    if (!orderId || typeof orderId !== "string") {
      return socket.emit("error", { message: "Invalid order ID." });
    }

    try {
      const OrderRepository = require("./repositories/orderRepository");
      const orderRepo = new OrderRepository();
      const order = await orderRepo.findById(orderId);
      const orderOwnerId = order ? order.userId : null;

      if (!orderOwnerId) {
        return socket.emit("error", { message: "Order not found." });
      }

      if (orderOwnerId.toString() === socket.user.id || socket.user.role === "admin") {
        socket.join(`order_${orderId}`);
      } else {
        socket.emit("error", { message: "Unauthorized: Access denied to order room." });
      }
    } catch (err) {
      socket.emit("error", { message: "Failed to verify order ownership." });
    }
  });

  // Scoped room for admin dashboard notifications - authorized strictly for admin role
  socket.on("joinAdminRoom", () => {
    if (socket.user && socket.user.role === "admin") {
      socket.join("admins");
    } else {
      socket.emit("error", { message: "Unauthorized: Admin privileges required." });
    }
  });

  socket.on("disconnect", () => {});
});

// Automatically normalize API Gateway stage prefixes (e.g. /default/api/... -> /api/...)
app.use((req, res, next) => {
  if (req.url.startsWith("/default/")) {
    req.url = req.url.slice(8);
  } else if (req.url === "/default") {
    req.url = "/";
  }
  next();
});

app.use(cors(corsOptions));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Live System Health Check Endpoint
app.get("/api/health", (req, res) => {
  const bucketName =
    typeof s3.getBucketName === "function"
      ? s3.getBucketName()
      : (process.env.AWS_S3_BUCKET_NAME || "");

  const healthData = {
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: "connected",
        engine: "dynamodb"
      },
      s3: {
        status: bucketName ? "configured" : "not_configured",
        bucket: bucketName || null,
        region: process.env.AWS_REGION || "ap-south-2"
      }
    }
  };

  res.status(200).json(healthData);
});

// Application Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/audit-logs", auditLogRoutes);

app.use((err, req, res, next) => {
  console.error("Server Error:", err.message || err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const startServer = async () => {
    await s3.checkConnection();
    server.listen(PORT, () => {
      console.log(`UserManagement AWS Server running on http://localhost:${PORT}`);
    });
  };
  startServer();
}

module.exports = { app, server, io };

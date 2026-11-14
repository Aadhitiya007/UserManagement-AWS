import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AIChatDrawer from "./components/AIChat/AIChatDrawer";

// Immediate eager-loaded storefront landing page for instant First Contentful Paint
import Products from "./pages/Products";

// Route-Level Code Splitting (lazy loading) for all secondary and admin pages
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Cart = lazy(() => import("./pages/cart"));
const Orders = lazy(() => import("./pages/Orders"));
const Payment = lazy(() => import("./pages/Payment"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Isolated Admin Portal chunks (customers never download admin bundle)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AddProduct = lazy(() => import("./pages/admin/AddProduct"));
const EditProduct = lazy(() => import("./pages/admin/EditProduct"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminDiscounts = lazy(() => import("./pages/admin/AdminDiscounts"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));

import { io } from "socket.io-client";
import { API_URL } from "./config/api";
import { isTokenExpired, handleForceLogout } from "./utils/auth";

function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        gap: "14px",
        color: "var(--color-text-secondary)"
      }}
    >
      <div
        style={{
          width: "38px",
          height: "38px",
          border: "3px solid var(--color-border)",
          borderTopColor: "var(--color-primary)",
          borderRadius: "50%",
          animation: "pageSpin 0.75s linear infinite"
        }}
      />
      <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>Loading...</span>
      <style>{`@keyframes pageSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  useEffect(() => {
    // On AWS Serverless (API Gateway HTTP API), WebSocket/Socket.IO is not hosted on REST endpoints.
    // Skipping socket connection prevents CORS/404 polling errors.
    if (API_URL && API_URL.includes("execute-api")) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    // Check on startup if stored token is already expired
    if (isTokenExpired(token)) {
      handleForceLogout(true);
      return;
    }

    const socket = io(API_URL, {
      auth: { token }
    });

    socket.on("connect", () => {
      console.log("Connected to WebSocket:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket");
    });

    socket.on("connect_error", (err) => {
      if (
        err.message &&
        (err.message.includes("Invalid or expired token") ||
          err.message.includes("Authentication error"))
      ) {
        console.warn("WebSocket authentication error. Logging out.");
        handleForceLogout(true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <WishlistProvider>
          <CartProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public Storefront Routes */}
            <Route path="/" element={<Navigate to="/products" replace />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* User Protected Routes */}
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment/:orderId"
              element={
                <ProtectedRoute>
                  <Payment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment/success"
              element={
                <ProtectedRoute>
                  <PaymentSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment/failure"
              element={<Navigate to="/cart" replace />}
            />

            {/* Staff & Admin Protected Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <AdminProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products/add"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products/edit/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <EditProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <AdminOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reviews"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <AdminReviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/discounts"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager"]}>
                  <AdminDiscounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminAuditLogs />
                </ProtectedRoute>
              }
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/products" replace />} />
            </Routes>
          </Suspense>
          <AIChatDrawer />
        </CartProvider>
      </WishlistProvider>
    </ThemeProvider>
  </BrowserRouter>
  );
}

export default App;

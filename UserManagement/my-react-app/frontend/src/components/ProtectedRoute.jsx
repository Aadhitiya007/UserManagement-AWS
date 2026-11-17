import { Navigate } from "react-router-dom";
import { isTokenExpired, handleForceLogout } from "../utils/auth";

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const isStaffRoute = Boolean(
    allowedRoles && (allowedRoles.includes("admin") || allowedRoles.includes("manager"))
  );

  if (!token || isTokenExpired(token)) {
    if (token) {
      handleForceLogout(false);
    }
    // If attempting to access an admin or manager portal route without auth, redirect to the Staff Portal
    if (isStaffRoute) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login?expired=1" replace />;
  }

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    // If staff member accidentally hits a customer-only protected route, redirect to staff console
    if (user && (user.role === "admin" || user.role === "manager")) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/products" replace />;
  }

  return children;
}

export default ProtectedRoute;

/**
 * Role-Based Access Control (RBAC) Middleware
 */

// Super Admin Only (User Management, Audit Logs, Security Configurations)
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Super Admin role required." });
  }
  next();
};

// Staff / Store Management (Super Admin + Store Manager)
const requireStaff = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "manager")) {
    return res.status(403).json({ message: "Access denied. Manager or Admin privileges required." });
  }
  next();
};

// Allow Super Admin or the User themself to update their own profile
const requireSelfOrAdmin = (req, res, next) => {
  const currentUserId = req.user?.id || req.user?._id;
  const targetId = req.params.id;

  if (!req.user || (req.user.role !== "admin" && currentUserId !== targetId)) {
    return res.status(403).json({ message: "Access denied. You can only update your own profile." });
  }

  // Prevent non-admin users from escalating their own role
  if (req.user.role !== "admin" && req.body && req.body.role) {
    delete req.body.role;
  }

  next();
};

module.exports = { requireAdmin, requireStaff, requireSelfOrAdmin };

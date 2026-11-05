import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  Tag,
  Star,
  Users,
  ScrollText,
  ShieldCheck,
  Store
} from "lucide-react";

function AdminSidebar() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = user.role === "admin";

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "800", color: "var(--color-text-primary)" }}>
            {isSuperAdmin ? "Super Admin" : "Store Manager"}
          </h3>
          <ShieldCheck size={18} color={isSuperAdmin ? "var(--color-primary)" : "#0D9488"} />
        </div>
        <span
          className="sidebar-role-badge"
          style={{
            backgroundColor: isSuperAdmin ? "var(--color-primary-light)" : "rgba(13, 148, 136, 0.14)",
            color: isSuperAdmin ? "var(--color-primary)" : "#0D9488"
          }}
        >
          {isSuperAdmin ? "Full Access Control" : "Store Operations"}
        </span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/admin/products" className={({ isActive }) => (isActive ? "active" : "")}>
          <Boxes size={18} />
          <span>Products & Stock</span>
        </NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? "active" : "")}>
          <ShoppingBag size={18} />
          <span>Customer Orders</span>
        </NavLink>
        <NavLink to="/admin/discounts" className={({ isActive }) => (isActive ? "active" : "")}>
          <Tag size={18} />
          <span>Discounts & Coupons</span>
        </NavLink>
        <NavLink to="/admin/reviews" className={({ isActive }) => (isActive ? "active" : "")}>
          <Star size={18} />
          <span>Customer Reviews</span>
        </NavLink>

        {isSuperAdmin && (
          <>
            <div className="sidebar-section-divider">
              Governance & Security
            </div>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
              <Users size={18} />
              <span>User Accounts</span>
            </NavLink>
            <NavLink to="/admin/audit-logs" className={({ isActive }) => (isActive ? "active" : "")}>
              <ScrollText size={18} />
              <span>Security Audit Logs</span>
            </NavLink>
          </>
        )}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--color-border)" }}>
        <NavLink
          to="/products"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.85rem",
            fontWeight: "600",
            color: "var(--color-text-secondary)",
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-surface-subtle)"
          }}
        >
          <Store size={16} />
          <span>View Public Storefront</span>
        </NavLink>
      </div>
    </aside>
  );
}

export default AdminSidebar;

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    paidOrders: 0,
    outOfStockCount: 0,
    activeCoupons: 0
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    onSale: 0
  });
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAllDashboardData();
  }, []);

  async function fetchAllDashboardData() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setLoading(true);
      setError("");

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all required data in parallel
      const [statsRes, ordersRes, productsRes, auditRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/orders/stats`, { headers }),
        fetch(`${API_URL}/api/orders`, { headers }),
        fetch(`${API_URL}/api/products`, { headers }),
        fetch(`${API_URL}/api/audit-logs?limit=5`, { headers })
      ]);

      // 1. Process Recent Orders & Compute Exact Status Counts
      let accuratePaidOrders = 0;
      let accuratePendingOrders = 0;

      if (ordersRes.status === "fulfilled" && ordersRes.value.ok) {
        const data = await ordersRes.value.json();
        const ordersList = Array.isArray(data) ? data : data.orders || [];
        setRecentOrders(ordersList.slice(0, 5));

        // Exact counts from orders list:
        accuratePaidOrders = ordersList.filter((o) => o.paymentStatus === "Paid").length;
        accuratePendingOrders = ordersList.filter((o) => o.status === "Pending" || o.paymentStatus === "Pending").length;
      }

      // 2. Process Stats
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats({
          totalUsers: data.totalUsers || 0,
          totalProducts: data.totalProducts || 0,
          totalOrders: data.totalOrders || 0,
          totalRevenue: data.totalRevenue || 0,
          pendingOrders: data.pendingOrders !== undefined ? data.pendingOrders : accuratePendingOrders,
          paidOrders: data.paidOrders !== undefined ? data.paidOrders : accuratePaidOrders,
          outOfStockCount: data.outOfStockCount !== undefined ? data.outOfStockCount : 0,
          activeCoupons: data.activeCoupons !== undefined ? data.activeCoupons : 0
        });
      }

      // 3. Process Inventory Breakdown
      if (productsRes.status === "fulfilled" && productsRes.value.ok) {
        const data = await productsRes.value.json();
        const prods = Array.isArray(data) ? data : data.products || [];

        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let onSale = 0;

        prods.forEach((p) => {
          const stock = Number(p.stock || 0);
          if (stock <= 0) {
            outOfStock++;
          } else if (stock <= 5) {
            lowStock++;
            inStock++;
          } else {
            inStock++;
          }

          if (p.discount && p.discount.isActive) {
            onSale++;
          }
        });

        setInventoryStats({ inStock, lowStock, outOfStock, onSale });
      }

      // 4. Process Recent Audit Logs
      if (auditRes.status === "fulfilled" && auditRes.value.ok) {
        const data = await auditRes.value.json();
        setRecentAuditLogs(Array.isArray(data.logs) ? data.logs.slice(0, 6) : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getPaymentBadge(paymentStatus) {
    const isPaid = paymentStatus === "Paid";
    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "0.72rem",
          fontWeight: "700",
          letterSpacing: "0.03em",
          background: isPaid ? "#dcfce7" : "#fef3c7",
          color: isPaid ? "#15803d" : "#b45309"
        }}
      >
        {isPaid ? "PAID" : "PENDING"}
      </span>
    );
  }

  function getOrderStatusBadge(status) {
    const map = {
      Delivered: { bg: "#ecfdf5", color: "#065f46" },
      Processing: { bg: "#eff6ff", color: "#1e40af" },
      Shipped: { bg: "#f0fdf4", color: "#166534" },
      Cancelled: { bg: "#fef2f2", color: "#991b1b" }
    };
    const c = map[status] || { bg: "#f8fafc", color: "#475569" };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "0.72rem",
          fontWeight: "700",
          letterSpacing: "0.03em",
          background: c.bg,
          color: c.color,
          textTransform: "uppercase"
        }}
      >
        {status || "PENDING"}
      </span>
    );
  }

  function getAuditStatusBadge(status) {
    if (status === "SUCCESS") {
      return (
        <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 7px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "700" }}>
          SUCCESS
        </span>
      );
    }
    if (status === "WARNING") {
      return (
        <span style={{ background: "#fef3c7", color: "#b45309", padding: "2px 7px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "700" }}>
          WARNING
        </span>
      );
    }
    return (
      <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 7px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "700" }}>
        FAILURE
      </span>
    );
  }

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content" style={{ padding: "28px 36px", background: "#f8fafc", minHeight: "100vh" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: "800", color: "#0f172a", margin: "0 0 4px" }}>
                Store Operations & Analytics
              </h1>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                Real-time overview of revenue, inventory health, order fulfillment and system events
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={fetchAllDashboardData}
                className="btn btn-outline btn-sm"
                style={{ background: "#fff", borderColor: "#cbd5e1", fontSize: "0.82rem", fontWeight: "500", padding: "6px 14px" }}
              >
                🔄 Refresh Data
              </button>
              <Link
                to="/admin/products/add"
                className="btn btn-primary btn-sm"
                style={{ fontSize: "0.82rem", fontWeight: "600", padding: "6px 14px", background: "#2563eb" }}
              >
                + Add Product
              </Link>
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {/* 8 Metric KPI Cards (2 Rows of 4 Cards) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
            {/* Card 1: TOTAL REVENUE */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  TOTAL REVENUE
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#2563eb", margin: "4px 0" }}>
                  ₹{Number(stats.totalRevenue).toLocaleString()}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: "500" }}>
                  ● Verified Paid Orders
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                💰
              </div>
            </div>

            {/* Card 2: TOTAL ORDERS */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  TOTAL ORDERS
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#0f172a", margin: "4px 0" }}>
                  {stats.totalOrders}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Lifetime Items
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                📦
              </div>
            </div>

            {/* Card 3: TOTAL CUSTOMERS */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  TOTAL CUSTOMERS
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#0f172a", margin: "4px 0" }}>
                  {stats.totalUsers}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Registered Accounts
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                👥
              </div>
            </div>

            {/* Card 4: TOTAL PRODUCTS */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  TOTAL PRODUCTS
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#0f172a", margin: "4px 0" }}>
                  {stats.totalProducts}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Catalog Items
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#ecfeff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                🏷️
              </div>
            </div>

            {/* Card 5: PENDING ORDERS */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  PENDING ORDERS
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#f59e0b", margin: "4px 0" }}>
                  {stats.pendingOrders}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Awaiting Fulfillment
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                ⏳
              </div>
            </div>

            {/* Card 6: PAID ORDERS */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  PAID ORDERS
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#10b981", margin: "4px 0" }}>
                  {stats.paidOrders}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Completed Payments
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                ✅
              </div>
            </div>

            {/* Card 7: OUT OF STOCK */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  OUT OF STOCK
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: stats.outOfStockCount > 0 ? "#ef4444" : "#0f172a", margin: "4px 0" }}>
                  {stats.outOfStockCount}
                </div>
                <div style={{ fontSize: "0.72rem", color: stats.outOfStockCount > 0 ? "#ef4444" : "#64748b" }}>
                  {stats.outOfStockCount > 0 ? "Requires Restock" : "Requires Restock"}
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                ⚠️
              </div>
            </div>

            {/* Card 8: ACTIVE DISCOUNTS */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  ACTIVE DISCOUNTS
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: "800", color: "#a855f7", margin: "4px 0" }}>
                  {stats.activeCoupons}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Coupons & Sales Live
                </div>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                🎟️
              </div>
            </div>
          </div>

          {/* Middle Section: Recent Orders (Left) & Inventory / Promotions (Right) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "20px", marginBottom: "24px" }}>
            {/* Left: Recent Customer Orders Table Card */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  📦 Recent Customer Orders
                </h3>
                <Link to="/admin/orders" className="btn btn-outline btn-sm" style={{ fontSize: "0.78rem", padding: "4px 10px" }}>
                  View All Orders →
                </Link>
              </div>

              <div className="table-responsive">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <th style={{ padding: "12px 16px" }}>ORDER ID</th>
                      <th style={{ padding: "12px 16px" }}>CUSTOMER</th>
                      <th style={{ padding: "12px 16px" }}>AMOUNT</th>
                      <th style={{ padding: "12px 16px" }}>PAYMENT</th>
                      <th style={{ padding: "12px 16px" }}>STATUS</th>
                      <th style={{ padding: "12px 16px" }}>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                          No customer orders placed yet.
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((ord) => {
                        const orderShortId = (ord._id || ord.orderId || "").slice(-6).toUpperCase();
                        const orderDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : "-";

                        return (
                          <tr key={ord._id || ord.orderId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 16px", fontWeight: "600", fontFamily: "monospace", color: "#334155" }}>
                              #{orderShortId}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#0f172a" }}>
                              {ord.userName || ord.userEmail || "Customer"}
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: "700", color: "#0f172a" }}>
                              ₹{Number(ord.totalAmount || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {getPaymentBadge(ord.paymentStatus)}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {getOrderStatusBadge(ord.status)}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "0.8rem" }}>
                              {orderDate}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Stacked Inventory Status & Promotional Campaigns Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Card 1: Inventory Status */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    📦 Inventory Status
                  </h3>
                  <Link to="/admin/products" className="btn btn-outline btn-sm" style={{ fontSize: "0.75rem", padding: "3px 8px" }}>
                    Manage Stock
                  </Link>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  {/* Row 1 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.85rem", color: "#0f172a" }}>In-Stock Catalog Items</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Healthy inventory levels</div>
                    </div>
                    <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: "700", padding: "3px 10px", borderRadius: "6px", fontSize: "0.85rem" }}>
                      {inventoryStats.inStock}
                    </span>
                  </div>

                  {/* Row 2 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.85rem", color: "#0f172a" }}>Low Stock Warnings</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>≤ 5 units remaining</div>
                    </div>
                    <span style={{ background: "#fef3c7", color: "#b45309", fontWeight: "700", padding: "3px 10px", borderRadius: "6px", fontSize: "0.85rem" }}>
                      {inventoryStats.lowStock}
                    </span>
                  </div>

                  {/* Row 3 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.85rem", color: "#0f172a" }}>Critical Out-of-Stock</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Storefront items hidden</div>
                    </div>
                    <span style={{ background: "#fee2e2", color: "#b91c1c", fontWeight: "700", padding: "3px 10px", borderRadius: "6px", fontSize: "0.85rem" }}>
                      {inventoryStats.outOfStock}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Promotional Campaigns */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    🏷️ Promotional Campaigns
                  </h3>
                  <Link to="/admin/discounts" className="btn btn-outline btn-sm" style={{ fontSize: "0.75rem", padding: "3px 8px" }}>
                    Manage Discounts
                  </Link>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem" }}>
                    <span style={{ color: "#64748b" }}>Active Coupon Codes</span>
                    <span style={{ fontWeight: "700", color: "#0f172a" }}>{stats.activeCoupons}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem" }}>
                    <span style={{ color: "#64748b" }}>Products on Sale</span>
                    <span style={{ fontWeight: "700", color: "#0f172a" }}>{inventoryStats.onSale}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", fontSize: "0.85rem" }}>
                    <span style={{ color: "#64748b" }}>Last 30 Days Revenue</span>
                    <span style={{ fontWeight: "800", color: "#2563eb" }}>₹{Number(stats.totalRevenue).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Card: Recent System Activity & Audit Trail */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                📜 Recent System Activity & Audit Trail
              </h3>
              <Link to="/admin/audit-logs" className="btn btn-outline btn-sm" style={{ fontSize: "0.78rem", padding: "4px 10px" }}>
                View Full Audit Log →
              </Link>
            </div>

            <div className="table-responsive">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <th style={{ padding: "12px 16px" }}>ACTION</th>
                    <th style={{ padding: "12px 16px" }}>CATEGORY</th>
                    <th style={{ padding: "12px 16px" }}>ACTOR</th>
                    <th style={{ padding: "12px 16px" }}>TARGET</th>
                    <th style={{ padding: "12px 16px" }}>STATUS</th>
                    <th style={{ padding: "12px 16px" }}>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: "26px", textAlign: "center", color: "#94a3b8" }}>
                        No audit records captured yet.
                      </td>
                    </tr>
                  ) : (
                    recentAuditLogs.map((log) => {
                      const logTime = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                      return (
                        <tr key={log.logId || log._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", fontWeight: "600", color: "#0f172a" }}>
                            {log.action}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "600" }}>
                              {log.category}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "0.8rem" }}>
                            {log.actor?.email || "system"}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "0.8rem" }}>
                            {log.target?.id || log.target?.type || "Order"}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {getAuditStatusBadge(log.status)}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "0.8rem" }}>
                            {logTime}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default AdminDashboard;

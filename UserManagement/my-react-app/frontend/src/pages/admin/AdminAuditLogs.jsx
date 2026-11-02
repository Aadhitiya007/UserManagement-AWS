import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { API_URL } from "../../config/api";

function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [categoryFilter, statusFilter]);

  async function fetchLogs() {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");

      let query = `${API_URL}/api/audit-logs?limit=50`;
      if (categoryFilter !== "ALL") query += `&category=${categoryFilter}`;
      if (statusFilter !== "ALL") query += `&status=${statusFilter}`;

      const res = await fetch(query, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load audit logs");

      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const actionMatch = log.action && log.action.toLowerCase().includes(term);
    const emailMatch = log.actor?.email && log.actor.email.toLowerCase().includes(term);
    const targetMatch = log.target?.id && log.target.id.toLowerCase().includes(term);
    return actionMatch || emailMatch || targetMatch;
  });

  function getStatusBadge(status) {
    if (status === "SUCCESS") {
      return <span className="badge badge-success">SUCCESS</span>;
    } else if (status === "WARNING") {
      return <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>WARNING</span>;
    } else {
      return <span className="badge badge-danger">FAILURE</span>;
    }
  }

  function getCategoryBadge(category) {
    const colors = {
      AUTH: { bg: "#e0e7ff", text: "#3730a3" },
      ORDER: { bg: "#ecfdf5", text: "#065f46" },
      PAYMENT: { bg: "#fef3c7", text: "#92400e" },
      PRODUCT: { bg: "#f3e8ff", text: "#6b21a8" },
      COUPON: { bg: "#fce7f3", text: "#9d174d" },
      EMAIL: { bg: "#e0f2fe", text: "#075985" }
    };
    const c = colors[category] || { bg: "#f1f5f9", text: "#475569" };
    return (
      <span
        style={{
          background: c.bg,
          color: c.text,
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "0.75rem",
          fontWeight: "600",
          letterSpacing: "0.03em"
        }}
      >
        {category}
      </span>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ padding: "30px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <Link to="/admin/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: "8px" }}>
              ← Admin Dashboard
            </Link>
            <h1 style={{ fontSize: "1.8rem", margin: "6px 0", color: "#0f172a" }}>
              📜 System Audit Trail (90-Day Retention)
            </h1>
            <p style={{ color: "#64748b", margin: 0 }}>
              Live, immutable audit trail for security events, orders, payments, coupons, and inventory triggers.
            </p>
          </div>

          <button onClick={fetchLogs} className="btn btn-outline btn-sm">
            🔄 Refresh Trail
          </button>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="admin-card" style={{ marginBottom: "24px", padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#64748b", marginBottom: "6px" }}>
                Filter by Category
              </label>
              <select
                className="form-control"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                <option value="ORDER">Orders</option>
                <option value="PAYMENT">Payments</option>
                <option value="AUTH">Authentication</option>
                <option value="PRODUCT">Inventory & Products</option>
                <option value="COUPON">Coupons</option>
                <option value="EMAIL">Email Dispatch</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#64748b", marginBottom: "6px" }}>
                Filter by Status
              </label>
              <select
                className="form-control"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="WARNING">Warnings</option>
                <option value="FAILURE">Failures</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#64748b", marginBottom: "6px" }}>
                Search Action or Actor
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Search by action, email, or order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b" }}>
              Audit Events ({filteredLogs.length})
            </h3>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading audit records...</div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              No audit logs matched your query.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px" }}>Timestamp</th>
                    <th style={{ padding: "12px 16px" }}>Category</th>
                    <th style={{ padding: "12px 16px" }}>Action</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Actor</th>
                    <th style={{ padding: "12px 16px" }}>Target</th>
                    <th style={{ padding: "12px 16px" }}>Context Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    return (
                      <tr key={log.logId || log._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {getCategoryBadge(log.category)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>{log.action}</strong>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {getStatusBadge(log.status)}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "0.85rem" }}>
                          <div style={{ color: "#0f172a", fontWeight: "500" }}>{log.actor?.email || "anonymous"}</div>
                          <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Role: {log.actor?.role || "user"}</div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "#475569" }}>
                          {log.target?.type ? `${log.target.type}: ${log.target.id || log.target.name}` : "-"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "0.8rem", color: "#64748b", maxWidth: "260px" }}>
                          <code>{typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details)}</code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default AdminAuditLogs;


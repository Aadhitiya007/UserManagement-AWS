import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import { TableRowSkeleton } from "../../components/ui/LoadingSkeleton";
import { API_URL } from "../../config/api";
import {
  ScrollText,
  Search,
  Filter,
  Shield,
  Eye,
  RotateCcw
} from "lucide-react";

function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

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

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <PageHeader
            title="Security Audit Logs"
            subtitle="Immutable audit log trail across authentication, orders, inventory, and role changes."
            badge={<Badge variant="info">AWS DynamoDB Protected</Badge>}
          />

          {error && (
            <div
              style={{
                padding: "14px",
                backgroundColor: "var(--color-error-light)",
                color: "var(--color-error)",
                borderRadius: "var(--radius-md)",
                marginBottom: "20px"
              }}
            >
              {error}
            </div>
          )}

          {/* Filter Bar */}
          <div
            className="card"
            style={{
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              gap: "14px",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: 1, minWidth: "280px" }}>
              <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-muted)"
                  }}
                />
                <input
                  type="text"
                  placeholder="Search logs by action, actor email, or target ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: "38px" }}
                />
              </div>

              <div style={{ minWidth: "150px" }}>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="form-control"
                >
                  <option value="ALL">All Categories</option>
                  <option value="AUTH">AUTH</option>
                  <option value="ORDER">ORDER</option>
                  <option value="PAYMENT">PAYMENT</option>
                  <option value="PRODUCT">PRODUCT</option>
                  <option value="COUPON">COUPON</option>
                  <option value="EMAIL">EMAIL</option>
                </select>
              </div>

              <div style={{ minWidth: "140px" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-control"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="WARNING">WARNING</option>
                  <option value="FAILURE">FAILURE</option>
                </select>
              </div>
            </div>

            {(searchTerm || categoryFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Category</th>
                    <th>Action</th>
                    <th>Actor Identity</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                </tbody>
              </table>
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit events found"
              description="No audit logs matched your search or category filters."
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "20%" }}>Timestamp</th>
                    <th style={{ width: "12%" }}>Category</th>
                    <th style={{ width: "26%" }}>Action Performed</th>
                    <th style={{ width: "22%" }}>Actor Identity</th>
                    <th style={{ width: "12%" }}>Status</th>
                    <th style={{ textAlign: "right" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr key={log._id || log.id || idx}>
                      <td style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <Badge variant="neutral">{log.category}</Badge>
                      </td>
                      <td>
                        <strong style={{ fontFamily: "monospace", fontSize: "0.88rem", color: "var(--color-text-primary)" }}>
                          {log.action}
                        </strong>
                      </td>
                      <td>
                        <div>
                          <span style={{ fontSize: "0.85rem", color: "var(--color-text-primary)", display: "block" }}>
                            {log.actor?.email || log.actor?.userId || "System Daemon"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            Role: {log.actor?.role || "system"} • IP: {log.actor?.ip || "hidden"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge
                          variant={
                            log.status === "SUCCESS"
                              ? "success"
                              : log.status === "WARNING"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="btn btn-secondary btn-sm"
                            title="Inspect Payload"
                          >
                            <Eye size={13} />
                            <span>Payload</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* INSPECT LOG MODAL */}
          <Modal
            isOpen={Boolean(selectedLog)}
            onClose={() => setSelectedLog(null)}
            title="🔍 Audit Log Event Payload"
            maxWidth="640px"
          >
            {selectedLog && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.85rem" }}>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>Action:</span>
                    <div><strong>{selectedLog.action}</strong></div>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>Category:</span>
                    <div><strong>{selectedLog.category}</strong></div>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>Actor:</span>
                    <div>{selectedLog.actor?.email || selectedLog.actor?.role || "System"}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-muted)" }}>Timestamp:</span>
                    <div>{new Date(selectedLog.timestamp).toISOString()}</div>
                  </div>
                </div>

                <div>
                  <label className="form-label">Full Event JSON Payload</label>
                  <pre
                    style={{
                      backgroundColor: "var(--color-surface-subtle)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "14px",
                      fontSize: "0.8rem",
                      color: "var(--color-text-primary)",
                      overflowX: "auto",
                      maxHeight: "260px"
                    }}
                  >
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="btn btn-secondary"
                  style={{ marginTop: "8px" }}
                >
                  Close
                </button>
              </div>
            )}
          </Modal>
        </main>
      </div>
    </>
  );
}

export default AdminAuditLogs;

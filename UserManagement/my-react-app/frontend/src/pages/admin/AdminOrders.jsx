import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

const ITEMS_PER_PAGE = 20;

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchOrders();

    const token = localStorage.getItem("token");
    if (!token || (API_URL && API_URL.includes("execute-api"))) return;

    const socket = io(API_URL, {
      auth: { token }
    });
    socket.emit("joinAdminRoom");

    socket.on("orderStatusUpdated", (data) => {
      if (data.cancelled) {
        setOrders((prevOrders) => prevOrders.filter((ord) => ord._id !== data.orderId));
        return;
      }

      setOrders((prevOrders) =>
        prevOrders.map((ord) =>
          ord._id === data.orderId
            ? { ...ord, status: data.status, paymentStatus: data.paymentStatus || ord.paymentStatus }
            : ord
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function fetchOrders() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId, newStatus) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status");

      setOrders(orders.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o)));
    } catch (err) {
      alert(err.message);
    }
  }

  // Filter & Search Logic
  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      order._id.toLowerCase().includes(term) ||
      (order.userName && order.userName.toLowerCase().includes(term)) ||
      (order.userEmail && order.userEmail.toLowerCase().includes(term)) ||
      order.products.some((p) => p.name.toLowerCase().includes(term));

    const currentPaymentStatus = order.paymentStatus || "Pending";
    const matchesPayment =
      paymentFilter === "ALL" ||
      (paymentFilter === "Paid" && currentPaymentStatus === "Paid") ||
      (paymentFilter === "Failed" && currentPaymentStatus === "Failed") ||
      (paymentFilter === "Pending" && (currentPaymentStatus === "Pending" || currentPaymentStatus === "Unpaid"));

    const matchesStatus =
      statusFilter === "ALL" || order.status === statusFilter;

    return matchesSearch && matchesPayment && matchesStatus;
  });

  // Pagination (20 items per page)
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleFilterChange(setter, val) {
    setter(val);
    setCurrentPage(1);
  }

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
            <h2>Customer Orders Management</h2>
            <span style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: "500" }}>
              Showing {filteredOrders.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
            </span>
          </div>

          {error && (
            <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div style={{
            background: "white",
            padding: "16px 20px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "20px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center"
          }}>
            {/* Search Input */}
            <div style={{ flex: "1 1 280px" }}>
              <input
                type="text"
                placeholder="🔍 Search by Customer, Email, Order ID, or Item..."
                value={searchTerm}
                onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
                className="form-control"
                style={{ padding: "8px 12px", fontSize: "0.9rem" }}
              />
            </div>

            {/* Payment Filter */}
            <div style={{ minWidth: "150px" }}>
              <select
                value={paymentFilter}
                onChange={(e) => handleFilterChange(setPaymentFilter, e.target.value)}
                className="form-control"
                style={{ padding: "8px 12px", fontSize: "0.9rem" }}
              >
                <option value="ALL">💳 All Payments</option>
                <option value="Paid">🟢 Paid Only</option>
                <option value="Pending">🟡 Pending Only</option>
                <option value="Failed">🔴 Failed Only</option>
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: "150px" }}>
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                className="form-control"
                style={{ padding: "8px 12px", fontSize: "0.9rem" }}
              >
                <option value="ALL">📦 All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(searchTerm || paymentFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setPaymentFilter("ALL");
                  setStatusFilter("ALL");
                  setCurrentPage(1);
                }}
                className="btn btn-outline btn-sm"
                style={{ padding: "8px 14px", height: "38px" }}
              >
                ✕ Clear
              </button>
            )}
          </div>

          {loading ? (
            <p>Loading customer orders...</p>
          ) : filteredOrders.length === 0 ? (
            <div style={{ background: "white", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <p style={{ color: "#64748b" }}>No orders match your search or filter criteria.</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order) => (
                      <tr key={order._id}>
                        <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>#{order._id.substring(0, 8)}...</td>
                        <td>
                          <strong>{order.userName}</strong>
                          <br />
                          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{order.userEmail}</span>
                        </td>
                        <td>
                          {order.products.map((item, idx) => (
                            <div key={idx} style={{ fontSize: "0.85rem" }}>
                              {item.name} × {item.quantity}
                            </div>
                          ))}
                        </td>
                        <td style={{ fontWeight: "600", color: "#2563eb" }}>₹{order.totalAmount}</td>
                        <td>
                          <span
                            className={
                              order.paymentStatus === "Paid"
                                ? "badge badge-success"
                                : order.paymentStatus === "Failed"
                                ? "badge badge-danger"
                                : "badge badge-warning"
                            }
                          >
                            {order.paymentStatus === "Paid" ? "Paid" : order.paymentStatus === "Failed" ? "Failed" : "Pending"}
                          </span>
                        </td>
                        <td>
                          <select
                            value={order.status}
                            disabled={order.paymentStatus !== "Paid"}
                            onChange={(e) => handleStatusChange(order._id, e.target.value)}
                            className="form-control"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.85rem",
                              width: "auto",
                              cursor: order.paymentStatus === "Paid" ? "pointer" : "not-allowed",
                              opacity: order.paymentStatus === "Paid" ? 1 : 0.6
                            }}
                            title={order.paymentStatus !== "Paid" ? "Status cannot be updated until payment is received." : ""}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="btn btn-outline btn-sm"
                    style={{ padding: "6px 14px" }}
                  >
                    ← Previous
                  </button>

                  <span style={{ fontSize: "0.9rem", color: "#475569" }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="btn btn-outline btn-sm"
                    style={{ padding: "6px 14px" }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default AdminOrders;

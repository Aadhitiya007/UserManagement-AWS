import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import { TableRowSkeleton } from "../../components/ui/LoadingSkeleton";
import { API_URL } from "../../config/api";
import {
  ShoppingBag,
  Search,
  RotateCcw
} from "lucide-react";

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
    if (!token) return;

    // Serverless (AWS Lambda / API Gateway) fallback:
    // In serverless microVM environments where Socket.io connections are isolated across
    // Lambda instances, gracefully fall back to quiet background interval polling.
    if (API_URL && API_URL.includes("execute-api")) {
      const pollInterval = setInterval(() => {
        fetchOrdersQuietly();
      }, 20000);
      return () => clearInterval(pollInterval);
    }

    // Stateful Node/Docker/EC2 environments: use persistent Socket.io connection
    const socket = io(API_URL, {
      auth: { token }
    });
    socket.emit("joinAdminRoom");

    socket.on("orderStatusUpdated", (data) => {
      if (data.cancelled) {
        setOrders((prevOrders) =>
          prevOrders.filter((ord) => (ord._id || ord.id) !== data.orderId)
        );
        return;
      }

      setOrders((prevOrders) =>
        prevOrders.map((ord) =>
          (ord._id || ord.id) === data.orderId
            ? { ...ord, status: data.status, paymentStatus: data.paymentStatus || ord.paymentStatus }
            : ord
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function fetchOrdersQuietly() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : data.orders || []);
      }
    } catch {
      // Quiet background polling ignores network blips without disrupting UI
    }
  }

  async function fetchOrders() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");
      setOrders(Array.isArray(data) ? data : data.orders || []);
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

      setOrders(
        orders.map((o) => ((o._id || o.id) === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      alert(err.message);
    }
  }

  // Filter & Search Logic
  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase().trim();
    const orderId = String(order._id || order.id || "").toLowerCase();
    const userName = String(order.userName || "").toLowerCase();
    const userEmail = String(order.userEmail || "").toLowerCase();
    const productNames = (order.products || []).map((p) => String(p.name).toLowerCase()).join(" ");

    const matchesSearch =
      !term ||
      orderId.includes(term) ||
      userName.includes(term) ||
      userEmail.includes(term) ||
      productNames.includes(term);

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
          <PageHeader
            title="Customer Orders"
            subtitle="Live order processing, payment verification, and shipment workflow."
            badge={<Badge variant="info">{orders.length} Total Orders</Badge>}
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

          {/* Search & Filter Toolbar */}
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
                  placeholder="Search by customer, email, order ID, or item..."
                  value={searchTerm}
                  onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: "38px" }}
                />
              </div>

              <div style={{ minWidth: "150px" }}>
                <select
                  value={paymentFilter}
                  onChange={(e) => handleFilterChange(setPaymentFilter, e.target.value)}
                  className="form-control"
                >
                  <option value="ALL">💳 All Payments</option>
                  <option value="Paid">🟢 Paid Only</option>
                  <option value="Pending">🟡 Pending Only</option>
                  <option value="Failed">🔴 Failed Only</option>
                </select>
              </div>

              <div style={{ minWidth: "150px" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                  className="form-control"
                >
                  <option value="ALL">📦 All Fulfillment</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {(searchTerm || paymentFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setPaymentFilter("ALL");
                  setStatusFilter("ALL");
                  setCurrentPage(1);
                }}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={14} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Fulfillment Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowSkeleton cols={7} />
                  <TableRowSkeleton cols={7} />
                  <TableRowSkeleton cols={7} />
                  <TableRowSkeleton cols={7} />
                </tbody>
              </table>
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No customer orders found"
              description="No orders match your current filter or search criteria."
            />
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer Details</th>
                      <th>Items Purchased</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Fulfillment</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order) => {
                      const id = order._id || order.id || "";
                      const isPaid = order.paymentStatus === "Paid";

                      return (
                        <tr key={id}>
                          <td>
                            <span style={{ fontFamily: "monospace", fontWeight: "700", color: "var(--color-primary)" }}>
                              #{id.substring(0, 8)}
                            </span>
                          </td>
                          <td>
                            <div>
                              <strong style={{ color: "var(--color-text-primary)", display: "block" }}>
                                {order.userName || "Customer"}
                              </strong>
                              <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                                {order.userEmail}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              {(order.products || []).map((item, idx) => (
                                <span key={idx} style={{ fontSize: "0.85rem", color: "var(--color-text-primary)" }}>
                                  {item.name} <strong style={{ color: "var(--color-text-muted)" }}>× {item.quantity}</strong>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <strong style={{ fontSize: "1rem", color: "var(--color-text-primary)" }}>
                              ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                            </strong>
                          </td>
                          <td>
                            <Badge variant={isPaid ? "success" : order.paymentStatus === "Failed" ? "danger" : "warning"}>
                              {order.paymentStatus || "Pending"}
                            </Badge>
                          </td>
                          <td>
                            <select
                              value={order.status}
                              disabled={!isPaid}
                              onChange={(e) => handleStatusChange(id, e.target.value)}
                              className="form-control"
                              style={{
                                padding: "4px 10px",
                                height: "34px",
                                fontSize: "0.85rem",
                                fontWeight: "600",
                                width: "auto",
                                cursor: isPaid ? "pointer" : "not-allowed",
                                opacity: isPaid ? 1 : 0.6
                              }}
                              title={!isPaid ? "Status cannot be updated until payment is received." : "Update order status"}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Processing">Processing</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "24px"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    ← Previous
                  </button>

                  <span style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)" }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary btn-sm"
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

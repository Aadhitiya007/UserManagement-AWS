import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

const ITEMS_PER_PAGE = 20;

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchMyOrders();

    const token = localStorage.getItem("token");
    if (!token || (API_URL && API_URL.includes("execute-api"))) return;

    const socket = io(API_URL, {
      auth: { token }
    });

    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || storedUser._id;
    if (userId) {
      socket.emit("joinUserRoom", userId);
    }

    socket.on("orderStatusUpdated", (data) => {
      console.log("Order status updated:", data);

      if (data.cancelled) {
        setOrders((currentOrders) =>
          currentOrders.filter((order) => order._id !== data.orderId)
        );
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order._id === data.orderId
            ? { ...order, status: data.status, paymentStatus: data.paymentStatus || order.paymentStatus }
            : order
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function fetchMyOrders() {
    const token = localStorage.getItem("token");
    if (!token || (API_URL && API_URL.includes("execute-api"))) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/orders/my-orders`, {
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

  function getStatusBadge(status) {
    switch (status) {
      case "Delivered": return "badge badge-success";
      case "Shipped": return "badge badge-info";
      case "Processing": return "badge badge-warning";
      case "Cancelled": return "badge badge-danger";
      default: return "badge badge-info";
    }
  }

  // Search filter by Order ID or Product Name
  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      order._id.toLowerCase().includes(term) ||
      order.products.some((p) => p.name.toLowerCase().includes(term))
    );
  });

  // Pagination (20 items per page)
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <h2>My Orders</h2>
          {orders.length > 0 && (
            <div style={{ width: "300px" }}>
              <input
                type="text"
                placeholder="🔍 Search my orders by ID or item..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-control"
                style={{ padding: "8px 12px", fontSize: "0.9rem" }}
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length === 0 ? (
          <div style={{ background: "white", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#6b7280" }}>You have not placed any orders yet.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ background: "white", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#6b7280" }}>No orders found matching "{searchTerm}".</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {paginatedOrders.map((order) => (
                <div key={order._id} style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Order ID: #{order._id}</span>
                      <br />
                      <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                        Placed on: {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className={getStatusBadge(order.status)}>{order.status}</span>
                      {" "}
                      <span 
                        style={{
                          marginLeft: "8px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                          background: order.paymentStatus === "Paid" 
                            ? "#dcfce7" 
                            : order.paymentStatus === "Failed" 
                            ? "#fee2e2" 
                            : "#fef3c7",
                          color: order.paymentStatus === "Paid" 
                            ? "#166534" 
                            : order.paymentStatus === "Failed" 
                            ? "#991b1b" 
                            : "#92400e"
                        }}
                      >
                        {order.paymentStatus === "Paid" 
                          ? "Paid" 
                          : order.paymentStatus === "Failed" 
                          ? "Payment Failed" 
                          : "Payment Pending"}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: "15px" }}>
                    {order.products.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "0.95rem" }}>
                        <span>{item.name} × {item.quantity}</span>
                        <span style={{ fontWeight: "500" }}>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: "right", borderTop: "1px solid #f1f5f9", paddingTop: "10px", fontWeight: "bold", fontSize: "1.1rem" }}>
                    {order.couponCode && (
                      <div style={{ fontSize: "0.85rem", color: "#16a34a", marginBottom: "4px" }}>
                        🏷️ Promo ({order.couponCode}): -₹{order.couponDiscount}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <a
                        href={`${API_URL}/api/orders/${order._id || order.id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                      >
                        📄 Tax Invoice
                      </a>
                      <span>Total: <span style={{ color: "#2563eb" }}>₹{order.totalAmount}</span></span>
                    </div>
                  </div>
                </div>
              ))}
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
      </div>
    </>
  );
}

export default Orders;

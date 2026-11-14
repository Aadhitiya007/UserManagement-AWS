import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Package, 
  Search, 
  FileText, 
  AlertCircle, 
  ShoppingBag, 
  Calendar, 
  Tag
} from "lucide-react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";
import { useRealtime } from "../utils/useRealtime";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";

const ITEMS_PER_PAGE = 20;

function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMyOrders = useCallback(async (isQuiet = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      if (!isQuiet) setLoading(false);
      return;
    }

    try {
      if (!isQuiet) {
        setLoading(true);
        setError("");
      }
      const res = await fetch(`${API_URL}/api/orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");
      const rawOrders = Array.isArray(data) ? data : (data.orders || []);
      // Real E-Commerce Filter: Only display confirmed, paid orders
      const confirmedOrders = rawOrders.filter((order) => {
        if (!order) return false;
        const isPaid = (order.paymentStatus || "").toLowerCase() === "paid";
        const isCod = (order.paymentMethod || "").toLowerCase() === "cashondelivery";
        const isFulfillmentActive = ["processing", "shipped", "delivered"].includes(
          (order.status || "").toLowerCase()
        );
        return isPaid || isCod || isFulfillmentActive;
      });
      setOrders(confirmedOrders);
    } catch (err) {
      if (!isQuiet) setError(err.message);
    } finally {
      if (!isQuiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (storedUser.role === "admin" || storedUser.role === "manager") {
      navigate("/admin/orders", { replace: true });
      return;
    }

    fetchMyOrders();
  }, [fetchMyOrders, navigate]);

  useRealtime(
    {
      orderStatusUpdated: (data) => {
        if (data.cancelled) {
          setOrders((currentOrders) =>
            currentOrders.filter((order) => (order._id || order.id) !== data.orderId)
          );
          return;
        }

        setOrders((currentOrders) =>
          currentOrders.map((order) =>
            (order._id || order.id) === data.orderId
              ? { ...order, status: data.status, paymentStatus: data.paymentStatus || order.paymentStatus }
              : order
          )
        );
      }
    },
    () => fetchMyOrders(true)
  );

  function renderStatusBadge(status) {
    switch (status) {
      case "Delivered":
        return <Badge variant="success">Delivered</Badge>;
      case "Shipped":
        return <Badge variant="primary">Shipped</Badge>;
      case "Processing":
        return <Badge variant="warning">Processing</Badge>;
      case "Cancelled":
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status || "Pending"}</Badge>;
    }
  }

  function renderPaymentBadge(paymentStatus) {
    if (paymentStatus === "Paid") {
      return <Badge variant="success">Paid</Badge>;
    }
    if (paymentStatus === "Failed") {
      return <Badge variant="danger">Payment Failed</Badge>;
    }
    return <Badge variant="warning">Payment Pending</Badge>;
  }

  // Filter orders
  const filteredOrders = (Array.isArray(orders) ? orders : []).filter((order) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const idStr = String(order._id || order.id || "").toLowerCase();
    const hasProduct = Array.isArray(order.products) && order.products.some((p) => (p.name || "").toLowerCase().includes(term));
    return idStr.includes(term) || hasProduct;
  });

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "1000px", margin: "40px auto", padding: "0 20px" }}>
        
        {/* Header with Title and Search */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              My Orders
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
              Track shipments, review past purchases, and download official tax invoices.
            </p>
          </div>

          {orders.length > 0 && (
            <div style={{ position: "relative", minWidth: "280px" }}>
              <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input
                type="text"
                placeholder="Search orders or items..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-control"
                style={{ paddingLeft: "40px", height: "42px", borderRadius: "10px" }}
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(220, 38, 38, 0.1)", color: "var(--error)", borderRadius: "10px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: "32px" }}>
            <LoadingSkeleton lines={5} />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="You haven't placed any orders yet. Discover our latest collections and start shopping!"
            actionLabel="Explore Products"
            onAction={() => navigate("/products")}
          />
        ) : filteredOrders.length === 0 ? (
          <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
            <Search size={32} style={{ color: "var(--text-secondary)", marginBottom: "12px" }} />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
              No orders found
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              No orders matched your search for "{searchTerm}".
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {paginatedOrders.map((order) => {
              const orderId = order._id || order.id;
              const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric"
              }) : "Recent";

              return (
                <div key={orderId} className="card" style={{ padding: "24px", borderRadius: "16px" }}>
                  {/* Top Bar: Order ID, Date, Badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "16px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Order ID:</span>
                        <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                          #{orderId}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        <Calendar size={13} /> Placed on {formattedDate}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {renderStatusBadge(order.status)}
                      {renderPaymentBadge(order.paymentStatus)}
                    </div>
                  </div>

                  {/* Items List */}
                  <div style={{ marginBottom: "20px" }}>
                    {Array.isArray(order.products) && order.products.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: idx < order.products.length - 1 ? "1px dashed var(--border)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                            <ShoppingBag size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                              {item.name}
                            </div>
                            {item.variant && (
                              <div style={{ fontSize: "0.78rem", color: "var(--primary)", fontWeight: 600, marginTop: "2px" }}>
                                {item.variant.name || (item.variant.attributes ? Object.entries(item.variant.attributes).map(([k, v]) => `${k}: ${v}`).join(" • ") : "")}
                              </div>
                            )}
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                              Qty: {item.quantity} × ₹{item.price}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                          ₹{item.price * item.quantity}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer: Tax Invoice link & Total Amount */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <a
                        href={`${API_URL}/api/orders/${orderId}/invoice?token=${encodeURIComponent(localStorage.getItem("token") || "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.82rem", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FileText size={14} /> Tax Invoice (PDF)
                      </a>

                      {order.couponCode && (
                        <span style={{ fontSize: "0.82rem", color: "var(--success)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Tag size={13} /> {order.couponCode} applied (-₹{order.couponDiscount})
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginRight: "8px" }}>Total Paid:</span>
                      <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)" }}>
                        ₹{order.totalAmount}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                >
                  Previous
                </button>

                <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                  Page <strong style={{ color: "var(--text-primary)" }}>{currentPage}</strong> of <strong style={{ color: "var(--text-primary)" }}>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}

export default Orders;
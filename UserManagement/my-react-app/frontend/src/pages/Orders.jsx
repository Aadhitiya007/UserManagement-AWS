import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Package, 
  Search, 
  FileText, 
  AlertCircle, 
  ShoppingBag, 
  Calendar, 
  Tag,
  Check,
  Share2,
  MapPin,
  Truck,
  Info,
  Edit3,
  X,
  ExternalLink
} from "lucide-react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";
import { useRealtime } from "../utils/useRealtime";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";

const ITEMS_PER_PAGE = 20;

const TRACKING_STAGES = [
  { key: "Ordered", label: "Ordered" },
  { key: "Shipped", label: "Shipped" },
  { key: "Out for delivery", label: "Out for delivery" },
  { key: "Delivered", label: "Delivered" }
];

const PRESET_INSTRUCTIONS = [
  "Leave at front door",
  "Leave with security guard / concierge",
  "Leave with neighbor",
  "Call before delivery",
  "Do not ring doorbell / quiet delivery"
];

function getStageIndex(status) {
  const norm = (status || "").toLowerCase();
  if (norm === "cancelled") return -1;
  if (norm === "delivered") return 3;
  if (norm === "out for delivery") return 2;
  if (norm === "shipped") return 1;
  return 0; // "pending" or "processing"
}

function getEtaDetails(order) {
  const status = (order.status || "").toLowerCase();
  const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();

  if (status === "cancelled") {
    return {
      title: "Order Cancelled",
      sub: "A refund has been credited to your original payment method.",
      isToday: false,
      color: "var(--error)"
    };
  }

  if (status === "delivered") {
    const deliveryDateStr = order.updatedAt 
      ? new Date(order.updatedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : "Recently";
    return {
      title: `Delivered ${deliveryDateStr}`,
      sub: "Package was handed directly to resident",
      isToday: false,
      color: "#008296"
    };
  }

  if (status === "out for delivery") {
    return {
      title: "Now arriving today",
      sub: "3:45 PM – 5:45 PM",
      isToday: true,
      color: "#008296"
    };
  }

  if (status === "shipped") {
    const etaDate = new Date(createdDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const etaStr = etaDate.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
    return {
      title: `Arriving by ${etaStr}`,
      sub: "By 9:00 PM",
      isToday: false,
      color: "#0f1111"
    };
  }

  // Processing / Pending
  const etaDate = new Date(createdDate.getTime() + 4 * 24 * 60 * 60 * 1000);
  const etaStr = etaDate.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
  return {
    title: `Arriving by ${etaStr}`,
    sub: "Preparing your package for carrier pickup",
    isToday: false,
    color: "#0f1111"
  };
}

function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightOrderId = searchParams.get("track");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Delivery instructions modal state
  const [activeInstructionOrder, setActiveInstructionOrder] = useState(null);
  const [instructionText, setInstructionText] = useState("");
  const [savingInstruction, setSavingInstruction] = useState(false);
  const [instructionFeedback, setInstructionFeedback] = useState("");

  // Toast notification state
  const [toastMessage, setToastMessage] = useState("");

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  }, []);

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
      
      // Filter: Show confirmed, paid, or active fulfillment orders
      const confirmedOrders = rawOrders.filter((order) => {
        if (!order) return false;
        const isPaid = (order.paymentStatus || "").toLowerCase() === "paid";
        const isCod = (order.paymentMethod || "").toLowerCase() === "cashondelivery";
        const isFulfillmentActive = [
          "processing", 
          "shipped", 
          "out for delivery", 
          "delivered"
        ].includes((order.status || "").toLowerCase());
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
              ? { 
                  ...order, 
                  status: data.status, 
                  paymentStatus: data.paymentStatus || order.paymentStatus,
                  courierName: data.courierName || order.courierName,
                  trackingNumber: data.trackingNumber || order.trackingNumber
                }
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
      case "Out for delivery":
        return <Badge variant="primary" style={{ background: "#008296", color: "#fff" }}>Out for delivery</Badge>;
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

  // Handle Share Tracking
  const handleShareTracking = async (order) => {
    const orderId = order._id || order.id;
    const trackingUrl = `${window.location.origin}/orders?track=${orderId}`;
    const shareText = `Track my Shopiee package #${orderId}: Status is "${order.status}". ETA: ${getEtaDetails(order).title}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Shopiee Order #${orderId}`,
          text: shareText,
          url: trackingUrl
        });
        return;
      } catch (shareErr) {
        if (shareErr.name !== "AbortError") {
          console.warn("Share fallback:", shareErr);
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(trackingUrl);
      showToast("Tracking link copied to clipboard!");
    } catch {
      showToast(`Tracking Link: ${trackingUrl}`);
    }
  };

  // Open Delivery Instructions Modal
  const handleOpenInstructions = (order) => {
    setActiveInstructionOrder(order);
    setInstructionText(order.deliveryInstructions || "");
    setInstructionFeedback("");
  };

  // Save Delivery Instructions
  const handleSaveInstructions = async () => {
    if (!activeInstructionOrder) return;
    const orderId = activeInstructionOrder._id || activeInstructionOrder.id;
    const token = localStorage.getItem("token");

    setSavingInstruction(true);
    setInstructionFeedback("");

    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/delivery-instructions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ deliveryInstructions: instructionText })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update instructions");

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          (o._id || o.id) === orderId ? { ...o, deliveryInstructions: instructionText } : o
        )
      );

      showToast("Delivery instructions updated successfully!");
      setActiveInstructionOrder(null);
    } catch (err) {
      setInstructionFeedback(err.message);
    } finally {
      setSavingInstruction(false);
    }
  };

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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "#0f1111",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "8px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          fontSize: "0.9rem",
          fontWeight: 600,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          animation: "fadeIn 0.2s ease-out"
        }}>
          <Check size={16} color="#00a87e" strokeWidth={3} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div style={{ maxWidth: "1000px", margin: "36px auto", padding: "0 20px" }}>
        
        {/* Header with Title and Search */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              My Orders
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
              Live Amazon-style package tracking, delivery ETA, courier updates, and tax invoices.
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
            <LoadingSkeleton lines={6} />
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
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {paginatedOrders.map((order) => {
              const orderId = order._id || order.id;
              const isHighlighted = highlightOrderId === orderId;
              const currentStageIdx = getStageIndex(order.status);
              const eta = getEtaDetails(order);
              const courier = order.courierName || "Chelsea";
              const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric"
              }) : "Recent";

              return (
                <div 
                  key={orderId} 
                  id={`order-${orderId}`}
                  className="card" 
                  style={{ 
                    padding: "24px", 
                    borderRadius: "16px",
                    border: isHighlighted ? "2px solid #008296" : "1px solid var(--border)",
                    boxShadow: isHighlighted ? "0 4px 20px rgba(0, 130, 150, 0.15)" : "var(--shadow-sm)",
                    background: "var(--card-bg)"
                  }}
                >
                  {/* Top Bar: Order ID, Date, Badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "14px", marginBottom: "18px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Order ID:</span>
                        <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.92rem", color: "var(--text-primary)" }}>
                          #{orderId}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <Calendar size={13} /> Placed on {formattedDate}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {renderStatusBadge(order.status)}
                      {renderPaymentBadge(order.paymentStatus)}
                    </div>
                  </div>

                  {/* Amazon Package Tracking Header Section */}
                  <div style={{ background: "rgba(0, 130, 150, 0.04)", borderRadius: "14px", padding: "18px 20px", marginBottom: "20px", border: "1px solid rgba(0, 130, 150, 0.12)" }}>
                    {/* ETA Title and Window */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
                      <div>
                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: eta.color, letterSpacing: "-0.01em" }}>
                          {eta.title}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                          <span>{eta.sub}</span>
                          <Info size={15} style={{ color: "var(--text-secondary)", cursor: "pointer" }} title="Estimated delivery window calculated based on routing schedule." />
                        </div>
                      </div>

                      {order.shippingAddress?.location?.lat && (
                        <a
                          href={`https://www.google.com/maps?q=${order.shippingAddress.location.lat},${order.shippingAddress.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: "#008296",
                            background: "#ffffff",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            border: "1px solid #d5d9d9",
                            textDecoration: "none"
                          }}
                        >
                          <MapPin size={13} /> View Pinned Location <ExternalLink size={11} />
                        </a>
                      )}
                    </div>

                    {/* Courier and Status Persona Line */}
                    {order.status !== "Cancelled" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "14px 0 18px", padding: "10px 14px", background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                        <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#008296", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", flexShrink: 0 }}>
                          <Truck size={19} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "#0f1111" }}>
                            {order.status === "Out for delivery" ? "Out for delivery" : (order.status || "Ordered")}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "1px" }}>
                            {order.status === "Out for delivery" 
                              ? `${courier} will deliver your package today.`
                              : order.status === "Shipped"
                              ? `In transit with ${order.courierName || "Express Delivery"} • Tracking #${order.trackingNumber || ("AWB" + orderId.slice(-8).toUpperCase())}`
                              : order.status === "Delivered"
                              ? "Delivered directly to customer."
                              : "Order confirmed and being prepared at fulfillment center."}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4-Stage Visual Amazon Stepper */}
                    {order.status !== "Cancelled" ? (
                      <div style={{ marginTop: "16px", padding: "8px 4px" }}>
                        {/* Stepper Progress Bar */}
                        <div style={{ display: "flex", alignItems: "center", position: "relative", marginBottom: "8px" }}>
                          {TRACKING_STAGES.map((stage, idx) => {
                            const isCompleted = currentStageIdx >= idx;
                            const isLast = idx === TRACKING_STAGES.length - 1;
                            const isLineActive = currentStageIdx > idx;

                            return (
                              <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
                                {/* Stage Node Circle */}
                                <div style={{
                                  width: "24px",
                                  height: "24px",
                                  borderRadius: "50%",
                                  background: isCompleted ? "#008296" : "#e2e8f0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#ffffff",
                                  zIndex: 2,
                                  boxShadow: isCompleted ? "0 0 0 3px rgba(0, 130, 150, 0.2)" : "none",
                                  transition: "all 0.3s ease"
                                }}>
                                  {isCompleted ? (
                                    <Check size={14} strokeWidth={3} />
                                  ) : (
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#94a3b8" }} />
                                  )}
                                </div>

                                {/* Connecting Line */}
                                {!isLast && (
                                  <div style={{
                                    flex: 1,
                                    height: "4px",
                                    background: isLineActive ? "#008296" : "#e2e8f0",
                                    margin: "0 -2px",
                                    zIndex: 1,
                                    transition: "background 0.3s ease"
                                  }} />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Stage Labels Below Stepper */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                          {TRACKING_STAGES.map((stage, idx) => {
                            const isCurrent = currentStageIdx === idx;
                            const isCompleted = currentStageIdx >= idx;

                            return (
                              <div 
                                key={stage.key} 
                                style={{ 
                                  textAlign: idx === 0 ? "left" : idx === TRACKING_STAGES.length - 1 ? "right" : "center",
                                  fontWeight: isCurrent ? 800 : isCompleted ? 600 : 500,
                                  color: isCurrent ? "#0f1111" : isCompleted ? "#008296" : "var(--text-secondary)",
                                  flex: 1
                                }}
                              >
                                {stage.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", background: "rgba(220, 38, 38, 0.08)", borderRadius: "8px", color: "var(--error)", fontSize: "0.88rem", fontWeight: 600 }}>
                        This order has been cancelled and cannot be tracked.
                      </div>
                    )}

                    {/* Delivery Instructions & Share Tracking Pill Buttons */}
                    <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenInstructions(order)}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #d5d9d9",
                          borderRadius: "20px",
                          padding: "8px 16px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color: "#0f1111",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 5px rgba(213, 217, 217, 0.5)",
                          transition: "background 0.15s ease"
                        }}
                      >
                        <Edit3 size={14} color="#008296" />
                        {order.deliveryInstructions ? "Update delivery instructions" : "Add delivery instructions"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareTracking(order)}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #d5d9d9",
                          borderRadius: "20px",
                          padding: "8px 16px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color: "#0f1111",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 5px rgba(213, 217, 217, 0.5)",
                          transition: "background 0.15s ease"
                        }}
                      >
                        <Share2 size={14} color="#008296" />
                        Share tracking
                      </button>

                      {order.deliveryInstructions && (
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontStyle: "italic", marginLeft: "4px" }}>
                          Note: "{order.deliveryInstructions.length > 40 ? order.deliveryInstructions.slice(0, 40) + "..." : order.deliveryInstructions}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                      Items in this package ({order.products?.length || 0})
                    </div>
                    {Array.isArray(order.products) && order.products.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: idx < order.products.length - 1 ? "1px dashed var(--border)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)" }} 
                            />
                          ) : (
                            <div style={{ width: "48px", height: "48px", borderRadius: "8px", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                              <ShoppingBag size={20} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                              {item.name}
                            </div>
                            {item.variant && (
                              <div style={{ fontSize: "0.78rem", color: "var(--primary)", fontWeight: 600, marginTop: "2px" }}>
                                {item.variant.name || (item.variant.attributes ? Object.entries(item.variant.attributes).map(([k, v]) => `${k}: ${v}`).join(" • ") : "")}
                              </div>
                            )}
                            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                              Qty: {item.quantity} × ₹{item.price}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>
                          ₹{item.price * item.quantity}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Address Preview */}
                  {order.shippingAddress && (
                    <div style={{ padding: "10px 14px", background: "var(--background)", borderRadius: "10px", marginBottom: "16px", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                      <strong style={{ color: "var(--text-primary)" }}>Shipping to: </strong>
                      {order.shippingAddress.name ? `${order.shippingAddress.name} — ` : ""}
                      {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pinCode}
                    </div>
                  )}

                  {/* Footer: Tax Invoice link & Total Amount (EXCLUDING BUY AGAIN as requested) */}
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

      {/* Delivery Instructions Modal */}
      {activeInstructionOrder && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--card-bg)",
            borderRadius: "16px",
            maxWidth: "500px",
            width: "100%",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            position: "relative"
          }}>
            <button
              type="button"
              onClick={() => setActiveInstructionOrder(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)"
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
              Update Delivery Instructions
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "18px" }}>
              Help your driver deliver your package safely to Order #{activeInstructionOrder._id || activeInstructionOrder.id}.
            </p>

            {/* Quick Presets */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                Select a quick instruction:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PRESET_INSTRUCTIONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInstructionText(preset)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "16px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      background: instructionText === preset ? "#008296" : "var(--background)",
                      color: instructionText === preset ? "#ffffff" : "var(--text-primary)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Text Area */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                Additional notes, gate codes, or landmarks:
              </label>
              <textarea
                rows={3}
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
                placeholder="e.g. Call upon arriving at gate, gate code #4412, leave on front porch"
                className="form-control"
                style={{ width: "100%", borderRadius: "10px", padding: "10px 12px", fontSize: "0.88rem", resize: "vertical" }}
                maxLength={500}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", float: "right", marginTop: "4px" }}>
                {instructionText.length}/500
              </span>
            </div>

            {instructionFeedback && (
              <div style={{ padding: "8px 12px", background: "rgba(220, 38, 38, 0.1)", color: "var(--error)", borderRadius: "8px", fontSize: "0.82rem", marginBottom: "14px" }}>
                {instructionFeedback}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setActiveInstructionOrder(null)}
                className="btn btn-secondary"
                style={{ padding: "8px 16px", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInstructions}
                disabled={savingInstruction}
                style={{
                  background: "#008296",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: savingInstruction ? "not-allowed" : "pointer"
                }}
              >
                {savingInstruction ? "Saving..." : "Save Instructions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Orders;

import { Clock, CheckCircle2, Package, ArrowRight, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function OrderCardMini({ order, onSelect }) {
  const navigate = useNavigate();
  if (!order) return null;

  const orderId = order.orderId || order._id || "Unknown";
  const status = order.status || "Pending";
  const total = Number(order.totalAmount || 0);
  const items = Array.isArray(order.items) ? order.items : [];
  
  // Format Date
  let dateStr = "";
  if (order.createdAt) {
    try {
      dateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      dateStr = "";
    }
  }

  // Status configuration
  const getStatusBadge = () => {
    const s = status.toLowerCase();
    if (s.includes("delivered")) {
      return {
        bg: "rgba(16, 185, 129, 0.12)",
        color: "#10b981",
        border: "rgba(16, 185, 129, 0.3)",
        label: "Delivered (Paid)",
        icon: <CheckCircle2 size={13} />
      };
    }
    if (s.includes("shipped") || s.includes("transit") || s.includes("processing")) {
      return {
        bg: "rgba(59, 130, 246, 0.12)",
        color: "#3b82f6",
        border: "rgba(59, 130, 246, 0.3)",
        label: status,
        icon: <Package size={13} />
      };
    }
    if (s.includes("cancel")) {
      return {
        bg: "rgba(239, 68, 68, 0.12)",
        color: "#ef4444",
        border: "rgba(239, 68, 68, 0.3)",
        label: "Cancelled",
        icon: <XCircle size={13} />
      };
    }
    // Default Pending
    return {
      bg: "rgba(245, 158, 11, 0.12)",
      color: "#f59e0b",
      border: "rgba(245, 158, 11, 0.3)",
      label: "Pending",
      icon: <Clock size={13} />
    };
  };

  const badge = getStatusBadge();

  const handleClick = () => {
    if (onSelect) {
      onSelect(order);
    } else {
      navigate("/orders");
    }
  };

  return (
    <div
      onClick={handleClick}
      title="View order details"
      style={{
        padding: "12px 14px",
        background: "var(--color-bg-surface, #1e293b)",
        border: "1px solid var(--color-border, #334155)",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        marginBottom: "8px"
      }}
      className="ai-order-card-mini"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-coral, #FF7043)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border, #334155)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Header: ID, Date & Status Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "#f8fafc" }}>
            #{orderId.slice(-8).toUpperCase()}
          </span>
          {dateStr && (
            <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginLeft: "6px" }}>
              • {dateStr}
            </span>
          )}
        </div>

        {/* Status Pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 8px",
            borderRadius: "12px",
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
            fontSize: "0.72rem",
            fontWeight: 600
          }}
        >
          {badge.icon}
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Items preview */}
      {items.length > 0 && (
        <div style={{ fontSize: "0.82rem", color: "#cbd5e1", marginBottom: "8px", lineHeight: "1.4" }}>
          {items.slice(0, 2).map((item, idx) => (
            <div key={idx} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              • {item}
            </div>
          ))}
          {items.length > 2 && (
            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
              +{items.length - 2} more item(s)
            </span>
          )}
        </div>
      )}

      {/* Footer: Total & Action Link */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "6px", borderTop: "1px dashed rgba(51, 65, 85, 0.6)" }}>
        <div>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginRight: "4px" }}>Total:</span>
          <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--color-coral, #FF7043)" }}>
            ₹{total.toLocaleString("en-IN")}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.75rem", color: "#38bdf8", fontWeight: 600 }}>
          <span>Track Order</span>
          <ArrowRight size={12} />
        </div>
      </div>
    </div>
  );
}


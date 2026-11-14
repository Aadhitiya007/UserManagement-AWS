import { useState } from "react";
import { ShoppingBag, Check, Star } from "lucide-react";
import { useCart } from "../../context/CartContext";

export default function ProductCardMini({ product, onSelect }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  if (!product) return null;

  const price = Number(product.effectivePrice || product.price || 0);
  const mrp = Number(product.mrp || 0);
  const isOutOfStock = product.stock !== undefined && Number(product.stock) <= 0;

  const handleAdd = (e) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div
      onClick={() => onSelect && onSelect(product)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px",
        background: "var(--color-bg-surface, #1e293b)",
        border: "1px solid var(--color-border, #334155)",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        marginBottom: "6px"
      }}
      className="ai-product-card-mini"
    >
      {/* Product Image */}
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "8px",
          overflow: "hidden",
          flexShrink: 0,
          background: "var(--color-bg-base, #0f172a)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <ShoppingBag size={20} color="var(--color-text-secondary, #94a3b8)" />
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.82rem",
            fontWeight: "600",
            color: "var(--color-text-primary, #f8fafc)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {product.name}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--color-coral, #FF7043)" }}>
            ₹{price.toLocaleString("en-IN")}
          </span>
          {mrp > price && (
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--color-text-secondary, #94a3b8)",
                textDecoration: "line-through"
              }}
            >
              ₹{mrp.toLocaleString("en-IN")}
            </span>
          )}
          {product.rating > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                fontSize: "0.7rem",
                color: "#eab308",
                marginLeft: "auto"
              }}
            >
              <Star size={11} fill="#eab308" />
              {product.rating}
            </span>
          )}
        </div>
      </div>

      {/* Quick Add Button */}
      <button
        onClick={handleAdd}
        disabled={isOutOfStock}
        title={isOutOfStock ? "Out of Stock" : "Add to Bag"}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          border: "none",
          background: isOutOfStock
            ? "var(--color-bg-base, #334155)"
            : added
            ? "#10b981"
            : "var(--color-primary, #3b82f6)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isOutOfStock ? "not-allowed" : "pointer",
          flexShrink: 0,
          transition: "background 0.2s ease"
        }}
      >
        {added ? <Check size={14} /> : <ShoppingBag size={14} />}
      </button>
    </div>
  );
}


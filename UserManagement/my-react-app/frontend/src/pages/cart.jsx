import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import { API_URL } from "../config/api";
import {
  ShoppingBag,
  Trash2,
  Tag,
  ArrowRight,
  ShieldCheck,
  Truck,
  AlertTriangle
} from "lucide-react";

function Cart() {
  const { cart, updateQuantity, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Coupon States
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const hasOutOfStockItems = cart.some((item) => item.stock !== undefined && item.stock <= 0);
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isStaff = currentUser.role === "admin" || currentUser.role === "manager";

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const couponDiscount = appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0;
  const deliveryFee = subtotal - couponDiscount >= 500 || subtotal === 0 ? 0 : 50;
  const finalPayable = Math.max(0, subtotal - couponDiscount) + deliveryFee;

  const freeDeliveryThreshold = 500;
  const remainingForFreeDelivery = Math.max(0, freeDeliveryThreshold - (subtotal - couponDiscount));
  const freeDeliveryProgress = Math.min(100, Math.round(((subtotal - couponDiscount) / freeDeliveryThreshold) * 100));

  async function handleApplyCoupon(e) {
    e?.preventDefault();
    if (!couponInput.trim()) return;

    try {
      setCouponLoading(true);
      setCouponError("");

      const res = await fetch(`${API_URL}/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponInput.trim().toUpperCase(),
          subtotal: subtotal
        })
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.message || "Invalid or ineligible coupon code");
      }

      setAppliedCoupon(data);
      setCouponInput("");
    } catch (err) {
      setCouponError(err.message);
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError("");
    setCouponInput("");
  }

  async function handleCheckout() {
    if (loading || hasOutOfStockItems) return;

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (cart.length === 0) return;

    try {
      setLoading(true);
      setError("");

      const orderProducts = cart.map((item) => ({
        productId: item._id || item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || ""
      }));

      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          products: orderProducts,
          totalAmount: finalPayable,
          couponCode: appliedCoupon?.coupon?.code || appliedCoupon?.code || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to place order");
      }

      const orderId = data.order?._id || data.order?.id;
      navigate(`/payment/${orderId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "32px", paddingBottom: "60px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "1.85rem",
              fontWeight: "800",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.03em",
              margin: "0 0 4px"
            }}
          >
            Your Shopping Bag
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", margin: 0 }}>
            {cart.length} item{cart.length !== 1 ? "s" : ""} selected for checkout
          </p>
        </div>

        {isStaff && (
          <div
            style={{
              padding: "12px 18px",
              backgroundColor: "rgba(13, 148, 136, 0.12)",
              color: "#0F766E",
              border: "1px solid rgba(13, 148, 136, 0.25)",
              borderRadius: "var(--radius-md)",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px"
            }}
          >
            <span>
              🛡️ <strong>Staff Mode Notice:</strong> You are logged in as a <strong>{currentUser.role === "admin" ? "Super Admin" : "Store Manager"}</strong>. Consumer carts are for QA testing.
            </span>
            <Link
              to="/admin/orders"
              style={{
                color: "#0F766E",
                fontWeight: "700",
                textDecoration: "underline",
                fontSize: "0.85rem"
              }}
            >
              Go to Store Orders Pipeline →
            </Link>
          </div>
        )}

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

        {hasOutOfStockItems && (
          <div
            style={{
              padding: "14px 18px",
              backgroundColor: "var(--color-warning-light)",
              color: "var(--color-warning)",
              borderRadius: "var(--radius-md)",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <AlertTriangle size={18} />
            <span>
              One or more items in your cart are currently <strong>out of stock</strong>. Please remove them before proceeding to payment.
            </span>
          </div>
        )}

        {cart.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your bag is empty"
            description="Looks like you haven't added any items to your cart yet. Discover our fresh drops now."
            action={
              <Link to="/products" className="btn btn-primary btn-sm">
                <span>Browse Catalog</span>
                <ArrowRight size={14} />
              </Link>
            }
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "32px",
              alignItems: "start"
            }}
          >
            {/* Left: Cart Items Table/List */}
            <div>
              {/* Free Shipping Progress Indicator */}
              <div
                className="card"
                style={{
                  padding: "16px 20px",
                  marginBottom: "20px",
                  backgroundColor: "var(--color-surface)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", color: "var(--color-text-primary)" }}>
                    <Truck size={16} color="var(--color-primary)" />
                    {remainingForFreeDelivery === 0 ? (
                      <span style={{ color: "var(--color-success)" }}>🎉 You unlocked FREE Delivery!</span>
                    ) : (
                      <span>Add ₹{remainingForFreeDelivery} more for FREE Delivery</span>
                    )}
                  </div>
                  <span style={{ fontWeight: "700", color: "var(--color-primary)" }}>{freeDeliveryProgress}%</span>
                </div>
                <div
                  style={{
                    height: "6px",
                    width: "100%",
                    backgroundColor: "var(--color-surface-subtle)",
                    borderRadius: "var(--radius-pill)",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${freeDeliveryProgress}%`,
                      backgroundColor: remainingForFreeDelivery === 0 ? "var(--color-success)" : "var(--color-primary)",
                      borderRadius: "var(--radius-pill)",
                      transition: "width 0.3s ease"
                    }}
                  />
                </div>
              </div>

              {/* Desktop Items Table */}
              <div className="table-container cart-table-desktop">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th style={{ textAlign: "right" }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => {
                      const id = item._id || item.id;
                      const imageUrl = item.imageUrl || item.image || "https://placehold.co/100x100?text=No+Image";
                      const isItemOutOfStock = item.stock !== undefined && item.stock <= 0;

                      return (
                        <tr key={id} style={{ opacity: isItemOutOfStock ? 0.6 : 1 }}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <img
                                src={imageUrl}
                                alt={item.name}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "https://placehold.co/60x60?text=No+Img";
                                }}
                                style={{
                                  width: "52px",
                                  height: "52px",
                                  objectFit: "cover",
                                  borderRadius: "var(--radius-xs)",
                                  border: "1px solid var(--color-border)"
                                }}
                              />
                              <div>
                                <strong style={{ color: "var(--color-text-primary)", display: "block" }}>
                                  {item.name}
                                </strong>
                                {isItemOutOfStock && <Badge variant="danger">Out of Stock</Badge>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: "var(--color-text-primary)", fontWeight: "600" }}>
                              ₹{item.price}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => updateQuantity(id, item.quantity - 1)}
                                className="btn btn-secondary btn-sm"
                                disabled={isItemOutOfStock}
                                style={{ width: "30px", height: "30px", padding: 0 }}
                              >
                                -
                              </button>
                              <span style={{ fontWeight: "700", minWidth: "22px", textAlign: "center" }}>
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(id, item.quantity + 1)}
                                className="btn btn-secondary btn-sm"
                                disabled={isItemOutOfStock || (item.stock && item.quantity >= item.stock)}
                                style={{ width: "30px", height: "30px", padding: 0 }}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: "var(--color-primary)" }}>
                              ₹{item.price * item.quantity}
                            </strong>
                          </td>
                          <td>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => removeFromCart(id)}
                                className="btn btn-ghost btn-sm"
                                title="Remove Item"
                              >
                                <Trash2 size={15} color="var(--color-error)" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Item Cards */}
              <div className="cart-cards-mobile">
                {cart.map((item) => {
                  const id = item._id || item.id;
                  const imageUrl = item.imageUrl || item.image || "https://placehold.co/100x100?text=No+Image";
                  const isItemOutOfStock = item.stock !== undefined && item.stock <= 0;

                  return (
                    <div
                      key={id}
                      style={{
                        padding: "14px",
                        backgroundColor: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        opacity: isItemOutOfStock ? 0.6 : 1
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://placehold.co/60x60?text=No+Img";
                        }}
                        style={{
                          width: "60px",
                          height: "60px",
                          objectFit: "cover",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border)",
                          flexShrink: 0
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong
                          style={{
                            color: "var(--color-text-primary)",
                            fontSize: "0.88rem",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {item.name}
                        </strong>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "4px 0 8px" }}>
                          <span style={{ color: "var(--color-text-primary)", fontWeight: "700", fontSize: "0.95rem" }}>
                            ₹{item.price}
                          </span>
                          <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
                            Total: ₹{item.price * item.quantity}
                          </span>
                        </div>

                        {/* Mobile Stepper + Remove */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(id, item.quantity - 1)}
                              className="btn btn-secondary btn-sm"
                              disabled={isItemOutOfStock}
                              style={{ width: "32px", height: "32px", padding: 0 }}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: "700", minWidth: "24px", textAlign: "center", fontSize: "0.9rem" }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(id, item.quantity + 1)}
                              className="btn btn-secondary btn-sm"
                              disabled={isItemOutOfStock || (item.stock && item.quantity >= item.stock)}
                              style={{ width: "32px", height: "32px", padding: 0 }}
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(id)}
                            className="btn btn-ghost btn-sm"
                            title="Remove Item"
                            style={{ padding: "6px 10px", color: "var(--color-error)" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Summary & Promo Coupon */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Coupon Box */}
              <div className="card">
                <h4 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Tag size={16} color="var(--color-primary)" />
                  <span>Promotional Voucher</span>
                </h4>

                {appliedCoupon ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-success-light)",
                      border: "1px solid var(--color-success)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      <strong style={{ color: "var(--color-success)" }}>
                        ✓ {appliedCoupon.coupon?.code || appliedCoupon.code}
                      </strong>
                      <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--color-success)" }}>
                        Saving ₹{appliedCoupon.discountAmount} on this drop!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="btn btn-secondary btn-sm"
                      style={{ height: "28px", padding: "0 8px", fontSize: "0.75rem" }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. WELCOME10"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      style={{ textTransform: "uppercase", fontWeight: "700" }}
                    />
                    <button
                      type="submit"
                      className="btn btn-secondary btn-sm"
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  </form>
                )}

                {couponError && (
                  <p style={{ color: "var(--color-error)", fontSize: "0.82rem", marginTop: "8px", marginBottom: 0 }}>
                    {couponError}
                  </p>
                )}
              </div>

              {/* Order Summary Breakdown */}
              <div className="card">
                <h3 style={{ fontSize: "1.15rem", fontWeight: "800", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--color-border)" }}>
                  Order Summary
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.92rem", marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                    <span>Bag Subtotal</span>
                    <strong style={{ color: "var(--color-text-primary)" }}>₹{subtotal}</strong>
                  </div>

                  {couponDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-success)" }}>
                      <span>Voucher Discount</span>
                      <strong>- ₹{couponDiscount}</strong>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                    <span>Estimated Delivery</span>
                    <strong style={{ color: deliveryFee === 0 ? "var(--color-success)" : "var(--color-text-primary)" }}>
                      {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: "14px",
                      borderTop: "1px solid var(--color-border)",
                      fontSize: "1.25rem",
                      fontWeight: "800"
                    }}
                  >
                    <span>Total Amount</span>
                    <span style={{ color: "var(--color-primary)" }}>₹{finalPayable}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loading || hasOutOfStockItems || cart.length === 0}
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%" }}
                >
                  <ShieldCheck size={18} />
                  <span>
                    {loading ? "Preparing Checkout..." : hasOutOfStockItems ? "Remove Out of Stock Items" : "Proceed to Payment"}
                  </span>
                </button>

                
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Cart;

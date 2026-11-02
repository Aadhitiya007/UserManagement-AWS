import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { API_URL } from "../config/api";

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

  // Check for any out-of-stock items in cart
  const hasOutOfStockItems = cart.some((item) => (item.stock !== undefined && item.stock <= 0));

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const couponDiscount = appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0;
  const deliveryFee = (subtotal - couponDiscount) >= 500 || subtotal === 0 ? 0 : 50;
  const finalPayable = Math.max(0, subtotal - couponDiscount) + deliveryFee;

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

      // Retain cart items until payment succeeds so user can return to cart safely
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
      <div className="container">
        <h2 style={{ marginBottom: "20px" }}>Shopping Cart</h2>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {hasOutOfStockItems && (
          <div style={{ padding: "14px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: "8px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <span>One or more items in your cart are currently <strong>out of stock</strong>. Please remove them before proceeding to checkout.</span>
          </div>
        )}

        {cart.length === 0 ? (
          <div style={{ background: "white", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "1.1rem", color: "#6b7280", marginBottom: "20px" }}>Your cart is empty.</p>
            <Link to="/products" className="btn btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const id = item._id || item.id;
                    const imageUrl = item.imageUrl || item.image || "https://via.placeholder.com/100x100?text=No+Image";
                    const isItemOutOfStock = item.stock !== undefined && item.stock <= 0;

                    return (
                      <tr key={id} style={{ background: isItemOutOfStock ? "#fff1f2" : "" }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <img
                              src={imageUrl}
                              alt={item.name}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "https://via.placeholder.com/60?text=No+Img";
                              }}
                              style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px" }}
                            />
                            <div>
                              <span style={{ fontWeight: "500", display: "block" }}>{item.name}</span>
                              {isItemOutOfStock && (
                                <span className="badge badge-danger" style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                                  Out of Stock
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>₹{item.price}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              onClick={() => updateQuantity(id, item.quantity - 1)}
                              className="btn btn-outline btn-sm"
                              disabled={isItemOutOfStock}
                            >
                              -
                            </button>
                            <span style={{ padding: "0 8px", fontWeight: "600" }}>{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(id, item.quantity + 1)}
                              className="btn btn-outline btn-sm"
                              disabled={isItemOutOfStock || (item.stock && item.quantity >= item.stock)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ fontWeight: "600", color: "#2563eb" }}>₹{item.price * item.quantity}</td>
                        <td>
                          <button onClick={() => removeFromCart(id)} className="btn btn-danger btn-sm">
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Order Summary & Coupon Card */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Promotional Coupon Box */}
              <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ marginBottom: "12px", color: "#1e293b", fontSize: "1rem" }}>🏷️ Have a Coupon?</h4>
                {appliedCoupon ? (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "#15803d" }}>✓ {appliedCoupon.coupon?.code || appliedCoupon.code}</strong>
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#166534" }}>
                        Saving ₹{appliedCoupon.discountAmount} on this order!
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="btn btn-outline btn-sm"
                      style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. WELCOME10, SPOOKY20"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      style={{ textTransform: "uppercase" }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  </form>
                )}

                {couponError && (
                  <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "8px", marginBottom: 0 }}>
                    {couponError}
                  </p>
                )}
              </div>

              {/* Order Summary Breakdown */}
              <div style={{ background: "white", padding: "24px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ marginBottom: "15px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>Order Summary</h3>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", color: "#64748b" }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>₹{subtotal}</span>
                </div>

                {couponDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", color: "#16a34a" }}>
                    <span>Coupon Discount:</span>
                    <span style={{ fontWeight: "600" }}>- ₹{couponDiscount}</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", color: "#64748b" }}>
                  <span>Estimated Delivery:</span>
                  <span style={{ fontWeight: "600", color: deliveryFee === 0 ? "#16a34a" : "#0f172a" }}>
                    {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #e2e8f0", fontSize: "1.2rem", fontWeight: "bold" }}>
                  <span>Final Payable:</span>
                  <span style={{ color: "#2563eb" }}>₹{finalPayable}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px", marginTop: "16px" }}
                  disabled={loading || hasOutOfStockItems || cart.length === 0}
                >
                  {loading ? "Placing Order..." : hasOutOfStockItems ? "Remove Out of Stock Items" : "Place Order"}
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

import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { API_URL } from "../config/api";
import { throttle } from "../utils/throttle";

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Verified Buyer & Review States
  const [canReview, setCanReview] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProductDetails();
    checkPurchaseEligibility();
  }, [id]);

  async function fetchProductDetails() {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/products/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Product not found");
      setProduct(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkPurchaseEligibility() {
    const token = localStorage.getItem("token");
    if (!token) {
      setCanReview(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/products/${id}/can-review`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.canReview) {
        setCanReview(true);
      } else {
        setCanReview(false);
      }
    } catch {
      setCanReview(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login to submit a review.");
      navigate("/login");
      return;
    }

    if (!comment.trim()) {
      setReviewMessage("Please enter a review comment.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewMessage("");
      const res = await fetch(`${API_URL}/api/products/${id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rating: userRating, comment: comment.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit review");

      setProduct(data.product);
      setComment("");
      setReviewMessage("🎉 Thank you! Your review has been published.");
    } catch (err) {
      setReviewMessage(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container">
          <p>Loading product details...</p>
        </div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Navbar />
        <div className="container">
          <p style={{ color: "red" }}>{error || "Product not found"}</p>
        </div>
      </>
    );
  }

  const imageUrl = product.imageUrl || product.image || "https://via.placeholder.com/400x300?text=No+Image";

  const isOutOfStock = product.stock <= 0;

  // Dynamic pricing calculations
  const originalMRP = product.mrp || Math.round(product.price * 1.3);
  const discountPercent = originalMRP > product.price 
    ? Math.round(((originalMRP - product.price) / originalMRP) * 100) 
    : 0;

  const reviewsList = product.reviews || [];
  const avgRating = product.rating || (reviewsList.length > 0 ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1) : 4.5);
  const totalReviews = product.reviewsCount || reviewsList.length;
  const warranty = product.warranty || "1 Year Manufacturer Warranty";

  // Throttled Add to Cart: prevents spam-clicking and replaces annoying alert with smooth feedback
  const handleAddToCart = throttle(() => {
    addToCart(product, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  }, 800);

  async function handleBuyNow() {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login to purchase items directly.");
      navigate("/login");
      return;
    }
    try {
      setBuying(true);
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          products: [
            {
              productId: product._id || product.id,
              name: product.name,
              price: product.price,
              quantity: quantity,
              image: product.image || ""
            }
          ],
          totalAmount: product.price * quantity
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to place order");
      const orderId = data.order?._id || data.order?.id;
      navigate(`/payment/${orderId}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBuying(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <Link to="/products" className="btn btn-outline btn-sm" style={{ marginBottom: "20px" }}>
          ← Back to Products
        </Link>

        {/* Product Details Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", background: "white", padding: "30px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          {/* Left Column: Image & Product Specifications */}
          <div>
            <img
              src={imageUrl}
              alt={product.name}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "https://via.placeholder.com/400x300?text=No+Image";
              }}
              style={{ width: "100%", maxHeight: "380px", objectFit: "cover", borderRadius: "8px" }}
            />

            <div className="specs-container">
              <h3 className="specs-title">Product Specifications</h3>
              <table className="specs-table">
                <tbody>
                  <tr>
                    <td className="spec-key">Product Name</td>
                    <td className="spec-val">{product.name}</td>
                  </tr>
                  <tr>
                    <td className="spec-key">Category</td>
                    <td className="spec-val">{product.category}</td>
                  </tr>
                  <tr>
                    <td className="spec-key">Warranty</td>
                    <td className="spec-val">{warranty}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Pricing, Rating, Action Buttons */}
          <div>
            <span style={{ textTransform: "uppercase", color: "#6b7280", fontSize: "0.85rem", fontWeight: "600" }}>
              {product.category}
            </span>
            <h1 style={{ fontSize: "1.8rem", margin: "8px 0" }}>{product.name}</h1>

            {/* Dynamic Rating & Review Badge */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
              <span className="rating-badge">
                {avgRating} ★
              </span>
              <span className="rating-count">{totalReviews} Customer Rating{totalReviews !== 1 ? "s" : ""}</span>
            </div>

            {/* Pricing Breakdown */}
            <div className="price-container">
              <span className="selling-price">₹{product.price}</span>
              {discountPercent > 0 && (
                <>
                  <span className="mrp-price">₹{originalMRP}</span>
                  <span className="discount-badge">{discountPercent}% off</span>
                </>
              )}
            </div>

            {isOutOfStock && (
              <div style={{ marginBottom: "20px" }}>
                <span className="badge badge-danger">Out of Stock</span>
              </div>
            )}

            <p style={{ color: "#4b5563", marginBottom: "20px", lineHeight: "1.7" }}>
              {product.description || "No description provided."}
            </p>

            {/* Trust Badges */}
            <div className="trust-badges-grid">
              <div className="trust-item">
                <span className="icon">🔄</span>
                <span>7 Days Replacement</span>
              </div>
              <div className="trust-item">
                <span className="icon">💵</span>
                <span>Cash on Delivery</span>
              </div>
              <div className="trust-item">
                <span className="icon">🛡️</span>
                <span>{warranty}</span>
              </div>
            </div>

            {!isOutOfStock && (
              <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
                <label style={{ fontWeight: "500" }}>Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value))))}
                  className="form-control"
                  style={{ width: "80px" }}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "15px" }}>
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`btn ${isOutOfStock ? "btn-out-of-stock" : (addedFeedback ? "btn-success" : "btn-outline")}`}
                style={{
                  flex: 1,
                  padding: "12px",
                  transition: "all 0.25s ease",
                  background: isOutOfStock ? "#f1f5f9" : (addedFeedback ? "#16a34a" : ""),
                  color: isOutOfStock ? "#94a3b8" : (addedFeedback ? "#ffffff" : ""),
                  borderColor: isOutOfStock ? "#cbd5e1" : (addedFeedback ? "#16a34a" : "")
                }}
              >
                {isOutOfStock ? "Out of Stock" : (addedFeedback ? "✓ Added to Cart!" : "🛒 Add to Cart")}
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className="btn btn-outline"
                title={isInWishlist(product._id || product.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                style={{
                  padding: "12px 18px",
                  fontSize: "1.25rem",
                  color: isInWishlist(product._id || product.id) ? "#ef4444" : "#64748b",
                  borderColor: isInWishlist(product._id || product.id) ? "#ef4444" : "#cbd5e1"
                }}
              >
                {isInWishlist(product._id || product.id) ? "♥" : "♡"}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock || buying}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: "12px",
                  background: isOutOfStock ? "#94a3b8" : "#f59e0b",
                  borderColor: isOutOfStock ? "#94a3b8" : "#d97706",
                  color: isOutOfStock ? "#ffffff" : "#000",
                  fontWeight: "bold"
                }}
              >
                {isOutOfStock ? "Unavailable" : (buying ? "Processing..." : "⚡ Buy Now")}
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className="btn btn-outline"
                title={isInWishlist(product._id || product.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                style={{
                  padding: "12px 18px",
                  fontSize: "1.25rem",
                  color: isInWishlist(product._id || product.id) ? "#ef4444" : "#64748b",
                  borderColor: isInWishlist(product._id || product.id) ? "#ef4444" : "#cbd5e1"
                }}
              >
                {isInWishlist(product._id || product.id) ? "♥" : "♡"}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Reviews & Ratings Section */}
        <div className="reviews-section">
          <h2 style={{ marginBottom: "16px", color: "#1e293b" }}>Customer Ratings & Reviews</h2>

          {/* Review Submission Form (Only for Verified Buyers) */}
          <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "8px", marginBottom: "30px", border: "1px solid #e2e8f0" }}>
            {canReview ? (
              <form onSubmit={handleSubmitReview}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ fontSize: "1.1rem" }}>Write a Review</h3>
                  <span className="verified-buyer-badge">✔ Verified Buyer</span>
                </div>

                {reviewMessage && (
                  <div style={{ padding: "10px", margin: "12px 0", borderRadius: "6px", background: reviewMessage.includes("🎉") ? "#dcfce7" : "#fee2e2", color: reviewMessage.includes("🎉") ? "#166534" : "#991b1b", fontSize: "0.9rem" }}>
                    {reviewMessage}
                  </div>
                )}

                {/* Star Rating Picker */}
                <div style={{ margin: "12px 0" }}>
                  <label style={{ fontWeight: "500", fontSize: "0.9rem" }}>Select Rating:</label>
                  <div className="star-rating-input">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`star ${star <= userRating ? "active" : ""}`}
                        onClick={() => setUserRating(star)}
                      >
                        ★
                      </span>
                    ))}
                    <span style={{ fontSize: "1rem", color: "#475569", marginLeft: "10px" }}>
                      ({userRating} / 5 Stars)
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: "500", fontSize: "0.9rem" }}>Your Feedback:</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Share your experience with this product..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={reviewSubmitting}>
                  {reviewSubmitting ? "Submitting..." : "Submit Review"}
                </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className="btn btn-outline"
                title={isInWishlist(product._id || product.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                style={{
                  padding: "12px 18px",
                  fontSize: "1.25rem",
                  color: isInWishlist(product._id || product.id) ? "#ef4444" : "#64748b",
                  borderColor: isInWishlist(product._id || product.id) ? "#ef4444" : "#cbd5e1"
                }}
              >
                {isInWishlist(product._id || product.id) ? "♥" : "♡"}
              </button>
              </form>
            ) : (
              <div style={{ textAlign: "center", color: "#6b7280", padding: "10px 0" }}>
                🔒 <strong>Verified Purchaser Review Only</strong>: You must purchase this item to write a review. All visitors can read reviews below!
              </div>
            )}
          </div>

          {/* All Customer Reviews List (Publicly Visible to Everyone) */}
          <div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "#334155" }}>
              All Reviews ({reviewsList.length})
            </h3>

            {reviewsList.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>No reviews submitted yet. Be the first verified buyer to review this product!</p>
            ) : (
              reviewsList.map((rev) => (
                <div key={rev._id || rev.createdAt} className="review-card">
                  <div className="review-header">
                    <div>
                      <strong style={{ color: "#0f172a" }}>{rev.userName}</strong>
                      <span className="verified-buyer-badge">✔ Verified Buyer</span>
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ color: "#f59e0b", fontSize: "1rem", margin: "4px 0" }}>
                    {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                    <span style={{ color: "#475569", fontSize: "0.88rem", marginLeft: "8px", fontWeight: "bold" }}>
                      {rev.rating} / 5
                    </span>
                  </div>

                  <p style={{ color: "#334155", fontSize: "0.95rem", marginTop: "6px" }}>
                    {rev.comment}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductDetail;

import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import Badge from "../components/ui/Badge";
import { API_URL } from "../config/api";
import { throttle } from "../utils/throttle";
import {
  ArrowLeft,
  Heart,
  ShoppingBag,
  Zap,
  Star,
  ShieldCheck,
  RotateCcw,
  Truck,
  CheckCircle2,
  Lock,
  MessageSquare
} from "lucide-react";

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

  const handleAddToCart = throttle(() => {
    addToCart(product, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1600);
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

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
          <p style={{ color: "var(--color-text-secondary)" }}>Loading product specifications...</p>
        </div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ padding: "60px 20px", textAlign: "center" }}>
          <p style={{ color: "var(--color-error)" }}>{error || "Product not found"}</p>
          <Link to="/products" className="btn btn-primary btn-sm" style={{ marginTop: "16px" }}>
            Return to Storefront
          </Link>
        </div>
      </>
    );
  }

  const pId = product._id || product.id;
  const imageUrl = product.imageUrl || product.image || "https://placehold.co/500x400?text=No+Image";
  const isOutOfStock = product.stock <= 0;
  const isLowStock = !isOutOfStock && product.stock <= 5;
  const inWishlist = isInWishlist(pId);

  const originalMRP = product.mrp || Math.round(product.price * 1.3);
  const discountPercent = originalMRP > product.price
    ? Math.round(((originalMRP - product.price) / originalMRP) * 100)
    : 0;

  const reviewsList = product.reviews || [];
  const avgRating = product.rating || (reviewsList.length > 0 ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1) : 4.8);
  const totalReviews = product.reviewsCount || reviewsList.length;

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "24px", paddingBottom: "60px" }}>
        <Link
          to="/products"
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: "24px", display: "inline-flex" }}
        >
          <ArrowLeft size={14} />
          <span>Back to Catalog</span>
        </Link>

        {/* 2-Column Product Detail Layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "40px",
            marginBottom: "48px"
          }}
        >
          {/* Left: Product Media & Specs */}
          <div>
            <div
              className="card"
              style={{
                padding: "0",
                overflow: "hidden",
                height: "440px",
                backgroundColor: "var(--color-surface-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                position: "relative"
              }}
            >
              <img
                src={imageUrl}
                alt={product.name}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "https://placehold.co/500x400?text=No+Image";
                }}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />

              <div style={{ position: "absolute", top: "16px", left: "16px" }}>
                {isOutOfStock ? (
                  <Badge variant="danger">Out of Stock</Badge>
                ) : isLowStock ? (
                  <Badge variant="warning">Only {product.stock} units left</Badge>
                ) : discountPercent > 0 ? (
                  <Badge variant="success">{discountPercent}% OFF DROP</Badge>
                ) : null}
              </div>
            </div>

            {/* Specifications Card */}
            <div className="card">
              <h3 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "14px" }}>
                Product Specifications
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.88rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid var(--color-border)" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Category</span>
                  <strong style={{ color: "var(--color-text-primary)" }}>{product.category || "General"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid var(--color-border)" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Availability</span>
                  <strong style={{ color: isOutOfStock ? "var(--color-error)" : isLowStock ? "var(--color-warning)" : "var(--color-success)" }}>
                    {isOutOfStock ? "Out of Stock" : isLowStock ? `Low Stock (Only ${product.stock} remaining)` : "In Stock"}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Warranty</span>
                  <strong style={{ color: "var(--color-text-primary)" }}>1 Year Manufacturer Assurance</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Product Purchase Panel */}
          <div>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-coral)"
              }}
            >
              {product.category || "Curated"}
            </span>

            <h1
              style={{
                fontSize: "2.1rem",
                fontWeight: "800",
                lineHeight: "1.25",
                color: "var(--color-text-primary)",
                margin: "6px 0 12px"
              }}
            >
              {product.name}
            </h1>

            {/* Rating pill */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <Badge variant="success" icon={Star}>
                {avgRating} / 5.0
              </Badge>
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                Based on {totalReviews} customer feedback review{totalReviews !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Price Row */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "12px",
                padding: "16px 20px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                marginBottom: "24px"
              }}
            >
              <span style={{ fontSize: "2rem", fontWeight: "800", color: "var(--color-text-primary)" }}>
                ₹{Number(product.price).toLocaleString("en-IN")}
              </span>
              {discountPercent > 0 && (
                <>
                  <span style={{ fontSize: "1.1rem", color: "var(--color-text-muted)", textDecoration: "line-through" }}>
                    ₹{Number(originalMRP).toLocaleString("en-IN")}
                  </span>
                  <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--color-coral)" }}>
                    {discountPercent}% OFF
                  </span>
                </>
              )}
            </div>

            <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)", lineHeight: "1.7", marginBottom: "28px" }}>
              {product.description || "Premium quality product, verified and dispatched directly from our regional fulfillment centers."}
            </p>

            {/* Trust Highlights */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: "28px"
              }}
            >
              <div
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface-subtle)",
                  textAlign: "center"
                }}
              >
                <RotateCcw size={18} color="var(--color-primary)" style={{ margin: "0 auto 4px" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--color-text-primary)", display: "block" }}>
                  7-Day Return
                </span>
              </div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface-subtle)",
                  textAlign: "center"
                }}
              >
                <Truck size={18} color="var(--color-success)" style={{ margin: "0 auto 4px" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--color-text-primary)", display: "block" }}>
                  Fast Dispatch
                </span>
              </div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface-subtle)",
                  textAlign: "center"
                }}
              >
                <ShieldCheck size={18} color="var(--color-coral)" style={{ margin: "0 auto 4px" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--color-text-primary)", display: "block" }}>
                  Verified Safe
                </span>
              </div>
            </div>

            {/* Quantity Selector */}
            {!isOutOfStock && (
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
                <label style={{ fontSize: "0.9rem", fontWeight: "700", color: "var(--color-text-primary)" }}>
                  Quantity:
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "36px", height: "36px", padding: 0 }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: "700", fontSize: "1rem", minWidth: "28px", textAlign: "center" }}>
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "36px", height: "36px", padding: 0 }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`btn btn-lg ${isOutOfStock ? "btn-secondary" : addedFeedback ? "btn-accent" : "btn-primary"}`}
                style={{ flex: 1.5, minWidth: "160px" }}
              >
                <ShoppingBag size={18} />
                <span>{isOutOfStock ? "Sold Out" : addedFeedback ? "Added to Bag! ✓" : "Add to Bag"}</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={isOutOfStock || buying}
                className="btn btn-lg btn-accent"
                style={{ flex: 1.2, minWidth: "140px" }}
              >
                <Zap size={18} />
                <span>{buying ? "Ordering..." : "Instant Buy"}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className="btn btn-lg btn-secondary btn-icon-only"
                title={inWishlist ? "Remove from Wishlist" : "Save to Wishlist"}
                style={{ width: "50px", flexShrink: 0 }}
              >
                <Heart size={20} fill={inWishlist ? "var(--color-coral)" : "none"} color={inWishlist ? "var(--color-coral)" : "currentColor"} />
              </button>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: "800", margin: "0 0 4px" }}>
                Verified Customer Reviews
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", margin: 0 }}>
                Real feedback from verified purchasers.
              </p>
            </div>
            <Badge variant="info">{reviewsList.length} Reviews</Badge>
          </div>

          {/* Review Submission Form */}
          <div
            style={{
              padding: "20px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-surface-subtle)",
              border: "1px solid var(--color-border)",
              marginBottom: "28px"
            }}
          >
            {canReview ? (
              <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: 0 }}>Write a Review</h3>
                  <Badge variant="success">✔ Verified Buyer</Badge>
                </div>

                {reviewMessage && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: reviewMessage.includes("🎉") ? "var(--color-success-light)" : "var(--color-error-light)",
                      color: reviewMessage.includes("🎉") ? "var(--color-success)" : "var(--color-error)",
                      fontSize: "0.85rem"
                    }}
                  >
                    {reviewMessage}
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ marginBottom: "6px" }}>Select Star Rating:</label>
                  <div style={{ display: "flex", gap: "6px", cursor: "pointer" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={22}
                        onClick={() => setUserRating(star)}
                        fill={star <= userRating ? "#FBBF24" : "none"}
                        color={star <= userRating ? "#FBBF24" : "var(--color-text-muted)"}
                      />
                    ))}
                    <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "var(--color-text-secondary)", marginLeft: "8px" }}>
                      ({userRating} / 5 Stars)
                    </span>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Review Details</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Describe product quality, delivery experience, fit and finish..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ alignSelf: "flex-start" }}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? "Publishing Review..." : "Publish Review"}
                </button>
              </form>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem", color: "var(--color-text-secondary)" }}>
                <Lock size={16} color="var(--color-text-muted)" />
                <span>
                  <strong>Verified Purchaser Protection:</strong> Only customers who have purchased this drop can write a review. All visitors can browse verified ratings below.
                </span>
              </div>
            )}
          </div>

          {/* Reviews Stream */}
          {reviewsList.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>
              No customer reviews yet. Be the first verified buyer to share feedback!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {reviewsList.map((rev, idx) => (
                <div
                  key={rev._id || idx}
                  style={{
                    padding: "16px 20px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "0.92rem", color: "var(--color-text-primary)" }}>
                        {rev.userName || "Verified Buyer"}
                      </strong>
                      <Badge variant="success">✔ Verified Buyer</Badge>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                      {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "3px", marginBottom: "6px" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        fill={star <= rev.rating ? "#FBBF24" : "none"}
                        color={star <= rev.rating ? "#FBBF24" : "var(--color-text-muted)"}
                      />
                    ))}
                  </div>

                  <p style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", lineHeight: "1.5", margin: 0 }}>
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ProductDetail;

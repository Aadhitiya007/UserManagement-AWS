import { useState, useEffect, useMemo } from "react";
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
  Lock
} from "lucide-react";

const COLOR_HEX_MAP = {
  // Titanium & Metallic
  "natural titanium": "#b8b2a8",
  "titanium gray": "#7a7b80",
  "blue titanium": "#3b4454",
  "black titanium": "#2c2c2e",
  "titanium black": "#1f2022",
  "titanium violet": "#524d5b",
  "carbon gray dlc titanium": "#3a3c3e",
  "silver chrome": "#e8e9ec",
  "platinum silver": "#d6d8db",
  "platinum white": "#f5f6f8",

  // Blacks & Darks
  "black": "#121212",
  "classic black": "#18181b",
  "midnight": "#0f172a",
  "midnight black": "#111827",
  "space black": "#1a1a1c",
  "space gray": "#4b4846",
  "phantom black": "#1a1a1a",
  "obsidian": "#1d1f21",
  "silky black": "#1e1e1e",
  "triple black": "#0d0d0d",
  "carbon black": "#212529",
  "black vegan leather": "#1a1918",
  "washed black": "#2d3139",
  "charcoal": "#334155",
  "charcoal grey": "#374151",
  "graphite": "#374151",
  "graphite black": "#27272a",
  "eclipse gray": "#3b3d42",

  // Whites & Light Tones
  "white": "#f8fafc",
  "shell white": "#f3f4f6",
  "white smoke": "#f1f5f9",
  "white vegan leather": "#f4f4f0",
  "white joy-con": "#f8fafc",
  "silver": "#e2e8f0",
  "silver grey": "#cbd5e1",
  "fog gray": "#94a3b8",
  "starlight": "#f5f2e9",
  "cream": "#fef08a",
  "porcelain": "#f1f5f9",
  "white/pure platinum": "#f8fafc",
  "optic white": "#ffffff",
  "pale grey": "#e2e8f0",

  // Blues
  "blue": "#2563eb",
  "bay blue": "#7ba4db",
  "sky blue": "#38bdf8",
  "icy blue": "#bae6fd",
  "navy": "#1e3a8a",
  "raw indigo": "#1e293b",
  "vintage faded wash": "#64748b",

  // Greens
  "green": "#16a34a",
  "flowy emerald": "#047857",
  "sage green": "#84a98c",
  "dark olive": "#3f4739",
  "forest green": "#166534",

  // Pinks & Purples & Warms
  "pink": "#ec4899",
  "smoky pink": "#db7093",
  "dusty rose": "#be185d",
  "magenta": "#d946ef",
  "purple": "#9333ea",
  "yellow": "#eab308",
  "oatmeal": "#e2d9cc",
  "oatmeal heather": "#d5ccc0",
  "sandstone": "#d4b996",
  "beige": "#f5f5dc",
  "brown": "#78350f",

  // Special Edition themes
  "neon red / neon blue": "#ff3c28",
  "zelda tears of the kingdom": "#0ea5e9"
};

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [activeImageOverride, setActiveImageOverride] = useState(null);

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
    setActiveImageOverride(null);
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
      if (Array.isArray(data.variantAttributes) && data.variantAttributes.length > 0) {
        const initialAttrs = {};
        data.variantAttributes.forEach((attr) => {
          if (Array.isArray(attr.options) && attr.options.length > 0) {
            initialAttrs[attr.name] = attr.options[0];
          }
        });
        setSelectedAttributes(initialAttrs);
      }
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

  const activeVariant = useMemo(() => {
    if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
      return null;
    }
    return product.variants.find((v) => {
      if (!v.attributes) return false;
      return Object.entries(selectedAttributes).every(
        ([key, val]) => v.attributes[key] === val
      );
    }) || product.variants[0];
  }, [product, selectedAttributes]);

  const currentPrice = activeVariant?.price !== undefined ? Number(activeVariant.price) : Number(product?.price || 0);
  const currentMRP = activeVariant?.mrp !== undefined ? Number(activeVariant.mrp) : (product?.mrp || Math.round(currentPrice * 1.3));
  const currentStock = activeVariant?.stock !== undefined ? Number(activeVariant.stock) : Number(product?.stock || 0);
  const currentImage = activeVariant?.image || product?.imageUrl || product?.image || "https://placehold.co/500x400?text=No+Image";
  const currentDisplayImage = activeImageOverride || currentImage;

  // Flatten catalog base image, extra angles, and all distinct variant images into interactive gallery
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const list = [];
    const seenUrls = new Set();

    const mainImg = product.imageUrl || product.image;
    if (mainImg) {
      list.push({
        url: mainImg,
        label: "Primary View",
        colorHex: null,
        variant: null
      });
      seenUrls.add(mainImg);
    }

    if (Array.isArray(product.images)) {
      product.images.forEach((img, idx) => {
        if (img && !seenUrls.has(img)) {
          list.push({
            url: img,
            label: `Angle ${idx + 2}`,
            colorHex: null,
            variant: null
          });
          seenUrls.add(img);
        }
      });
    }

    if (Array.isArray(product.variants)) {
      product.variants.forEach((v) => {
        if (v.image && !seenUrls.has(v.image)) {
          const colorVal = v.attributes?.["Color"] ||
                           v.attributes?.["Color Theme"] ||
                           v.attributes?.["Finish"] ||
                           v.attributes?.["Wash"] ||
                           v.attributes?.["Chassis Color"] ||
                           v.attributes?.["Band Color"];
          const normalized = colorVal ? String(colorVal).toLowerCase().trim() : null;
          const colorHex = normalized ? COLOR_HEX_MAP[normalized] : null;

          list.push({
            url: v.image,
            label: colorVal || v.name || "Variant",
            colorHex,
            variant: v
          });
          seenUrls.add(v.image);
        }
      });
    }

    return list;
  }, [product]);

  function handleAttributeSelect(attrName, option) {
    setActiveImageOverride(null);
    setSelectedAttributes((prev) => {
      const next = { ...prev, [attrName]: option };

      if (Array.isArray(product?.variants) && product.variants.length > 0) {
        // If exact combination exists, use it
        const exact = product.variants.find((v) =>
          v.attributes && Object.entries(next).every(([k, val]) => v.attributes[k] === val)
        );
        if (exact) return next;

        // If not, find closest variant that matches this newly chosen option (especially color)
        const partial = product.variants.find((v) =>
          v.attributes && v.attributes[attrName] === option
        );
        if (partial && partial.attributes) {
          return { ...partial.attributes, [attrName]: option };
        }
      }
      return next;
    });
  }

  function handleThumbnailClick(imgItem) {
    setActiveImageOverride(imgItem.url);
    if (imgItem.variant && imgItem.variant.attributes) {
      setSelectedAttributes((prev) => ({
        ...prev,
        ...imgItem.variant.attributes
      }));
    }
  }

  const handleAddToCart = throttle(() => {
    if (!product) return;
    const itemToAdd = {
      ...product,
      price: currentPrice,
      mrp: currentMRP,
      stock: currentStock,
      image: currentDisplayImage,
      selectedVariant: activeVariant
    };
    addToCart(itemToAdd, quantity);
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

      // Check for user's default shipping address
      let defaultAddress = null;
      try {
        const addrRes = await fetch(`${API_URL}/api/users/addresses/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (addrRes.ok) {
          const addrList = await addrRes.json();
          defaultAddress = addrList.find((a) => a.isDefault) || addrList[0] || null;
        }
      } catch (addrErr) {
        console.warn("Could not prefetch address:", addrErr.message);
      }

      // If user has no delivery address on file, take them to cart to add one
      if (!defaultAddress) {
        addToCart({
          ...product,
          price: currentPrice,
          mrp: currentMRP,
          stock: currentStock,
          image: currentDisplayImage,
          selectedVariant: activeVariant
        }, quantity);
        navigate("/cart");
        return;
      }

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
              price: currentPrice,
              quantity: quantity,
              image: currentDisplayImage,
              variant: activeVariant || null
            }
          ],
          totalAmount: currentPrice * quantity,
          shippingAddress: defaultAddress
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
  const isOutOfStock = currentStock <= 0;
  const isLowStock = !isOutOfStock && currentStock <= 5;
  const inWishlist = isInWishlist(pId);

  const originalMRP = currentMRP;
  const discountPercent = originalMRP > currentPrice
    ? Math.round(((originalMRP - currentPrice) / originalMRP) * 100)
    : 0;

  const reviewsList = product.reviews || [];
  const avgRating = product.rating || (reviewsList.length > 0 ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1) : 4.8);
  const totalReviews = product.reviewsCount || reviewsList.length;

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "24px", paddingBottom: "100px" }}>
        <Link
          to="/products"
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: "24px", display: "inline-flex" }}
        >
          <ArrowLeft size={14} />
          <span>Back to Catalog</span>
        </Link>

        {/* 2-Column Product Detail Layout */}
        <div className="product-detail-grid">
          {/* Left: Product Media & Specs */}
          <div>
            <div
              className="card product-detail-media"
              style={{
                padding: "0",
                overflow: "hidden",
                height: "440px",
                backgroundColor: "var(--color-surface-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: galleryImages.length > 1 ? "12px" : "24px",
                position: "relative"
              }}
            >
              <img
                key={currentDisplayImage}
                src={currentDisplayImage}
                alt={product.name}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "https://placehold.co/500x400?text=No+Image";
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "opacity 0.25s ease-in-out"
                }}
              />

              <div style={{ position: "absolute", top: "16px", left: "16px" }}>
                {isOutOfStock ? (
                  <Badge variant="danger">Out of Stock</Badge>
                ) : isLowStock ? (
                  <Badge variant="warning">Only {currentStock} units left</Badge>
                ) : discountPercent > 0 ? (
                  <Badge variant="success">{discountPercent}% OFF DROP</Badge>
                ) : null}
              </div>
            </div>

            {/* Interactive Image Gallery / Color Variant Thumbnails Strip */}
            {galleryImages.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  overflowX: "auto",
                  paddingBottom: "8px",
                  marginBottom: "24px",
                  scrollbarWidth: "thin"
                }}
              >
                {galleryImages.map((imgItem, idx) => {
                  const isActive = currentDisplayImage === imgItem.url;
                  return (
                    <button
                      key={`${imgItem.url}_${idx}`}
                      type="button"
                      onClick={() => handleThumbnailClick(imgItem)}
                      title={`View ${imgItem.label}`}
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        width: "66px",
                        height: "66px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: isActive ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                        outline: isActive ? "2px solid rgba(99, 102, 241, 0.35)" : "none",
                        padding: 0,
                        cursor: "pointer",
                        backgroundColor: "var(--color-surface-subtle)",
                        transition: "all 0.18s ease",
                        opacity: isActive ? 1 : 0.68,
                        transform: isActive ? "scale(1.02)" : "scale(1)"
                      }}
                    >
                      <img
                        src={imgItem.url}
                        alt={imgItem.label}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://placehold.co/100x100?text=Image";
                        }}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      {imgItem.colorHex && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: "3px",
                            right: "3px",
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor: imgItem.colorHex,
                            border: "1.5px solid #ffffff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

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
                {(isOutOfStock || isLowStock) && (
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid var(--color-border)" }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>Availability</span>
                    <strong style={{ color: isOutOfStock ? "var(--color-error)" : "var(--color-warning)" }}>
                      {isOutOfStock ? "Out of Stock" : `Low Stock (Only ${currentStock} remaining)`}
                    </strong>
                  </div>
                )}
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
                flexWrap: "wrap",
                gap: "12px",
                padding: "16px 20px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                marginBottom: "20px"
              }}
            >
              <span style={{ fontSize: "2rem", fontWeight: "800", color: "var(--color-text-primary)" }}>
                ₹{Number(currentPrice).toLocaleString("en-IN")}
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
              {activeVariant?.name && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.82rem",
                    backgroundColor: "rgba(99, 102, 241, 0.12)",
                    color: "var(--color-primary)",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    fontWeight: "600"
                  }}
                >
                  {activeVariant.name}
                </span>
              )}
            </div>

            {/* Interactive Variant Selectors (Size, Color, Storage, etc.) */}
            {Array.isArray(product.variantAttributes) && product.variantAttributes.length > 0 && (
              <div
                style={{
                  padding: "18px 20px",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px"
                }}
              >
                {product.variantAttributes.map((attr) => {
                  const isColorAttr = /color|colour|finish|theme|wash/i.test(attr.name);
                  const selectedVal = selectedAttributes[attr.name] || attr.options?.[0];

                  return (
                    <div key={attr.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {attr.name}
                        </span>
                        <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--color-primary)" }}>
                          {selectedVal}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {Array.isArray(attr.options) && attr.options.map((option) => {
                          const isSelected = selectedVal === option;
                          const normalizedColor = option.toLowerCase().trim();
                          const colorHex = isColorAttr ? (COLOR_HEX_MAP[normalizedColor] || null) : null;

                          if (isColorAttr && colorHex) {
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => handleAttributeSelect(attr.name, option)}
                                title={`Select ${attr.name}: ${option}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "6px 14px 6px 8px",
                                  borderRadius: "20px",
                                  fontSize: "0.84rem",
                                  fontWeight: isSelected ? "700" : "500",
                                  cursor: "pointer",
                                  transition: "all 0.18s ease",
                                  border: isSelected
                                    ? "2px solid var(--color-primary)"
                                    : "1px solid var(--color-border)",
                                  backgroundColor: isSelected
                                    ? "rgba(99, 102, 241, 0.12)"
                                    : "var(--color-surface-subtle)",
                                  color: isSelected
                                    ? "var(--color-primary)"
                                    : "var(--color-text-primary)",
                                  boxShadow: isSelected
                                    ? "0 0 0 2px rgba(99, 102, 241, 0.25)"
                                    : "none"
                                }}
                              >
                                <span
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "50%",
                                    backgroundColor: colorHex,
                                    border: "1.5px solid rgba(0,0,0,0.18)",
                                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
                                    display: "inline-block",
                                    flexShrink: 0
                                  }}
                                />
                                <span>{option}</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleAttributeSelect(attr.name, option)}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                fontSize: "0.85rem",
                                fontWeight: isSelected ? "700" : "500",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                                backgroundColor: isSelected ? "rgba(99, 102, 241, 0.14)" : "var(--color-surface-subtle)",
                                color: isSelected ? "var(--color-primary)" : "var(--color-text-primary)"
                              }}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
                    onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
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

      {/* Mobile Sticky Bottom Purchase Bar */}
      <div className="mobile-sticky-action-bar">
        <div>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", display: "block" }}>Price</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--color-text-primary)" }}>
              ₹{Number(product.price).toLocaleString("en-IN")}
            </span>
            {discountPercent > 0 && (
              <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-coral)" }}>
                {discountPercent}% OFF
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            className="btn btn-secondary btn-icon-only"
            style={{ width: "42px", height: "42px", borderRadius: "var(--radius-pill)" }}
            aria-label="Wishlist"
          >
            <Heart size={18} fill={inWishlist ? "var(--color-coral)" : "none"} color={inWishlist ? "var(--color-coral)" : "currentColor"} />
          </button>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`btn btn-sm ${isOutOfStock ? "btn-secondary" : addedFeedback ? "btn-accent" : "btn-primary"}`}
            style={{ height: "42px", padding: "0 18px", borderRadius: "var(--radius-pill)", fontWeight: "700" }}
          >
            <ShoppingBag size={16} />
            <span>{isOutOfStock ? "Sold Out" : addedFeedback ? "Added! ✓" : "Add to Bag"}</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default ProductDetail;

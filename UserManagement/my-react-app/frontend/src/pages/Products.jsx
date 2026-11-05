import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import { CardSkeleton } from "../components/ui/LoadingSkeleton";
import { API_URL } from "../config/api";
import { throttle } from "../utils/throttle";
import {
  Search,
  Heart,
  ShoppingBag,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  RotateCcw
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

function getCategoryIcon(cat) {
  const lower = (cat || "").toLowerCase();
  if (lower === "all") return "✨";
  if (lower.includes("electr")) return "⚡";
  if (lower.includes("cloth") || lower.includes("apparel")) return "👔";
  if (lower.includes("home") || lower.includes("kitchen")) return "🛋️";
  if (lower.includes("access")) return "🎒";
  if (lower.includes("book")) return "📚";
  return "🏷️";
}

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [addedItemKey, setAddedItemKey] = useState(null);

  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    const handleScroll = throttle(() => {
      setShowScrollTop(window.scrollY > 300);
    }, 150);

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      getProducts(search);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function getProducts(query = "") {
    try {
      setLoading(true);
      const url = query
        ? `${API_URL}/api/products?search=${encodeURIComponent(query)}`
        : `${API_URL}/api/products`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch products");
      setProducts(Array.isArray(data) ? data : data.products || []);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category && typeof p.category === "string" && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts = { All: products.length };
    products.forEach((p) => {
      const cat = p.category && typeof p.category === "string" ? p.category.trim() : null;
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter((p) => {
      const cat = p.category && typeof p.category === "string" ? p.category.trim().toLowerCase() : "";
      return cat === selectedCategory.toLowerCase();
    });
  }, [products, selectedCategory]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === "price-low") {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === "price-high") {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "rating") {
      list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
    return list;
  }, [filteredProducts, sortBy]);

  function handleSelectCategory(cat) {
    setSelectedCategory(cat);
    setCurrentPage(1);
  }

  function handleQuickAddToCart(product) {
    addToCart(product);
    const pId = product._id || product.id;
    setAddedItemKey(pId);
    setTimeout(() => setAddedItemKey(null), 1200);
  }

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />

      <div className="container" style={{ paddingTop: "32px", paddingBottom: "60px" }}>
        {/* Toolbar: Category Title, Search, Sort */}
        <div
          className="store-header-wrap"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px"
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.6rem",
                fontWeight: "800",
                color: "var(--color-text-primary)",
                letterSpacing: "-0.02em",
                margin: "0 0 2px"
              }}
            >
              {selectedCategory === "All" ? "Curated Collection" : `${selectedCategory} Collection`}
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", margin: 0 }}>
              Showing {sortedProducts.length} verified listings
            </p>
          </div>

          <div className="store-controls-wrap" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="store-search-wrap" style={{ position: "relative", minWidth: "220px" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-text-muted)"
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Search collection..."
                style={{
                  paddingLeft: "36px",
                  borderRadius: "var(--radius-pill)",
                  height: "40px",
                  fontSize: "0.88rem"
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ArrowUpDown size={15} color="var(--color-text-muted)" />
              <select
                className="form-control"
                style={{
                  borderRadius: "var(--radius-pill)",
                  height: "40px",
                  fontSize: "0.85rem",
                  fontWeight: "600"
                }}
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="featured">✨ Featured</option>
                <option value="price-low">💵 Price: Low to High</option>
                <option value="price-high">💎 Price: High to Low</option>
                <option value="newest">🆕 Newest First</option>
                <option value="rating">⭐ Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pill Bar */}
        <div
          className="category-pills-bar"
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "14px",
            marginBottom: "28px",
            WebkitOverflowScrolling: "touch"
          }}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
            const count = categoryCounts[cat] || 0;
            const icon = getCategoryIcon(cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelectCategory(cat)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  backgroundColor: isActive ? "var(--color-primary)" : "var(--color-surface)",
                  color: isActive ? "#FFFFFF" : "var(--color-text-secondary)",
                  border: isActive ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  boxShadow: isActive ? "0 4px 12px rgba(49, 94, 251, 0.25)" : "var(--shadow-xs)",
                  transition: "all var(--transition-fast)"
                }}
              >
                <span>{icon} {cat === "All" ? "All Drops" : cat}</span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: "700",
                    padding: "1px 6px",
                    borderRadius: "var(--radius-pill)",
                    backgroundColor: isActive ? "rgba(255, 255, 255, 0.25)" : "var(--color-surface-subtle)",
                    color: isActive ? "#FFFFFF" : "var(--color-text-muted)"
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

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

        {/* Product Cards Grid */}
        {loading ? (
          <div className="product-grid">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : sortedProducts.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No matching products found"
            description={
              selectedCategory !== "All"
                ? `There are no active drops under "${selectedCategory}" matching your criteria.`
                : "No products matched your search term."
            }
            action={
              (selectedCategory !== "All" || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("All");
                    setSearch("");
                    setCurrentPage(1);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <RotateCcw size={14} />
                  <span>Reset Filters</span>
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="product-grid">
              {paginatedProducts.map((product) => {
                const pId = product._id || product.id || product.productId;
                const imageUrl =
                  product.imageUrl ||
                  product.image ||
                  "https://placehold.co/400x300?text=No+Image";

                const isOutOfStock = product.stock !== undefined && Number(product.stock) <= 0;
                const isLowStock = !isOutOfStock && product.stock !== undefined && Number(product.stock) <= 5;
                const inWishlist = isInWishlist(pId);
                const isJustAdded = addedItemKey === pId;

                const hasDiscount = product.mrp && Number(product.mrp) > Number(product.price);
                const discountPercent = hasDiscount
                  ? Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100)
                  : 0;

                return (
                  <div key={pId} className="product-card">
                    {/* Floating Wishlist Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(product);
                      }}
                      className={`product-wishlist-btn ${inWishlist ? "active" : ""}`}
                      title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                      aria-label="Wishlist"
                    >
                      <Heart size={16} fill={inWishlist ? "var(--color-coral)" : "none"} />
                    </button>

                    {/* Stock / Promo Badge */}
                    <div className="product-card-badge">
                      {isOutOfStock ? (
                        <Badge variant="danger">Out of Stock</Badge>
                      ) : isLowStock ? (
                        <Badge variant="warning">Only {product.stock} Left</Badge>
                      ) : hasDiscount ? (
                        <Badge variant="success">{discountPercent}% OFF</Badge>
                      ) : null}
                    </div>

                    <Link to={`/products/${pId}`}>
                      <div className="product-image-wrap">
                        <img
                          src={imageUrl}
                          alt={product.name}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "https://placehold.co/400x300?text=No+Image";
                          }}
                        />
                      </div>
                    </Link>

                    <div className="product-card-body">
                      <span className="product-card-category">
                        {product.category || "Lifestyle"}
                      </span>

                      <h3 className="product-card-title">
                        <Link to={`/products/${pId}`}>{product.name}</Link>
                      </h3>

                      <div className="product-card-price-row">
                        <span className="product-price-current">
                          ₹{Number(product.price).toLocaleString("en-IN")}
                        </span>
                        {hasDiscount && (
                          <span className="product-price-original">
                            ₹{Number(product.mrp).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                        <Link
                          to={`/products/${pId}`}
                          className="btn btn-secondary btn-sm product-card-btn"
                          style={{ flex: 1 }}
                        >
                          Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleQuickAddToCart(product)}
                          disabled={isOutOfStock}
                          className={`btn btn-sm product-card-btn ${isOutOfStock ? "btn-secondary" : isJustAdded ? "btn-accent" : "btn-primary"}`}
                          style={{ flex: 1.3 }}
                        >
                          <ShoppingBag size={14} />
                          <span>{isOutOfStock ? "Sold Out" : isJustAdded ? "Added! ✓" : "Add to Bag"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "36px"
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.max(p - 1, 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={currentPage === 1}
                  className="btn btn-secondary btn-sm"
                >
                  ← Previous
                </button>

                <span style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)" }}>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.min(p + 1, totalPages));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              position: "fixed",
              bottom: "28px",
              right: "28px",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 90,
              cursor: "pointer",
              transition: "transform var(--transition-fast)"
            }}
            title="Scroll to Top"
            aria-label="Back to Top"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </>
  );
}

export default Products;

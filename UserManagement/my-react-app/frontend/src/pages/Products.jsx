import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { API_URL } from "../config/api";
import { throttle } from "../utils/throttle";

const ITEMS_PER_PAGE = 20;

function getCategoryIcon(cat) {
  const lower = (cat || "").toLowerCase();
  if (lower === "all") return "✨";
  if (lower.includes("season") || lower.includes("special") || lower.includes("halloween")) return "🎃";
  if (lower.includes("electr")) return "⚡";
  if (lower.includes("cloth") || lower.includes("apparel") || lower.includes("knit")) return "👔";
  if (lower.includes("home") || lower.includes("decor") || lower.includes("furnit") || lower.includes("living")) return "🛋️";
  if (lower.includes("access")) return "🎒";
  if (lower.includes("audio") || lower.includes("sound")) return "🎧";
  if (lower.includes("food") || lower.includes("gourmet")) return "🍫";
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
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    const handleScroll = throttle(() => {
      setShowScrollTop(window.scrollY > 250);
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
      setProducts(data);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Derive all unique non-empty categories present in the products catalog
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category && typeof p.category === "string" && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  // Compute product count per category
  const categoryCounts = useMemo(() => {
    const counts = { All: products.length };
    products.forEach((p) => {
      const cat = p.category && typeof p.category === "string" ? p.category.trim() : null;
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Instant client-side category filtering
  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter((p) => {
      const cat = p.category && typeof p.category === "string" ? p.category.trim().toLowerCase() : "";
      return cat === selectedCategory.toLowerCase();
    });
  }, [products, selectedCategory]);

  // Client-side sorting (Phase 3)
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

  // Pagination (20 products per page based on sorted and filtered list)
  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />
      <div className="container">
        {/* Catalog Header & Search/Sort Toolbar */}
        <div id="catalog-view" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px", flexWrap: "wrap", gap: "14px", marginTop: "12px" }}>
          <div>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#f97316", fontWeight: "700" }}>
              Catalog & Curation · {sortedProducts.length} {sortedProducts.length === 1 ? "Item" : "Items"}
            </span>
            <h2 style={{ fontSize: "1.75rem", fontWeight: "800", color: "#0f172a", margin: "4px 0 0" }}>
              {selectedCategory === "All" ? "Curated Collection" : `${selectedCategory} Collection`}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Sorting Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: "600" }}>Sort:</span>
              <select
                className="catalog-sort-select"
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

            {/* Search Input */}
            <div style={{ position: "relative", minWidth: "240px" }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search products by title, tag..."
                style={{ paddingLeft: "36px", borderRadius: "9999px", background: "#ffffff", borderColor: "#cbd5e1", fontSize: "0.85rem" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9rem", pointerEvents: "none" }}>
                🔍
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal Category Pill Bar */}
        <div className="category-pill-bar">
          {categories.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
            const count = categoryCounts[cat] || 0;
            const icon = getCategoryIcon(cat);

            return (
              <button
                key={cat}
                type="button"
                className={`category-pill-btn ${isActive ? "active" : ""}`}
                onClick={() => handleSelectCategory(cat)}
              >
                <span>{icon} {cat === "All" ? "All Products" : cat}</span>
                <span className="category-pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading products...</p>
        ) : sortedProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1", margin: "20px 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#0f172a", marginBottom: "6px" }}>No matching products found</h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "16px" }}>
              {selectedCategory !== "All"
                ? `There are currently no products under "${selectedCategory}" matching your search.`
                : "No products matched your search query."}
            </p>
            {(selectedCategory !== "All" || search) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("All");
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="btn btn-primary btn-sm"
              >
                Reset Filters & Show All
              </button>
            )}
          </div>
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
                const hasDiscount = product.mrp && Number(product.mrp) > Number(product.price);
                const discountPercent = hasDiscount
                  ? Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100)
                  : 0;
                const inWishlist = isInWishlist(pId);

                return (
                  <div key={pId} className="product-card" style={{ position: "relative" }}>
                    {/* Out of Stock Ribbon Overlay */}
                    {isOutOfStock && <span className="badge-out-of-stock">Out of Stock</span>}

                    {/* Wishlist Heart Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(product);
                      }}
                      className={`wishlist-heart-btn ${inWishlist ? "active" : ""}`}
                      title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                      aria-label="Toggle Wishlist"
                    >
                      {inWishlist ? "❤️" : "🤍"}
                    </button>

                    <Link to={`/products/${pId}`}>
                      <img
                        src={imageUrl}
                        alt={product.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://placehold.co/400x300?text=No+Image";
                        }}
                      />
                    </Link>

                    <div className="product-card-body">
                      <span style={{ fontSize: "0.8rem", color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                        {product.category}
                      </span>
                      <h3 className="product-card-title">
                        <Link to={`/products/${pId}`}>{product.name}</Link>
                      </h3>

                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "6px 0 14px" }}>
                        <span className="product-card-price" style={{ margin: 0 }}>
                          ₹{Number(product.price).toLocaleString("en-IN")}
                        </span>
                        {hasDiscount && (
                          <>
                            <span style={{ fontSize: "0.88rem", color: "#94a3b8", textDecoration: "line-through" }}>
                              ₹{Number(product.mrp).toLocaleString("en-IN")}
                            </span>
                            <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: "bold" }}>
                              {discountPercent}% OFF
                            </span>
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: "auto", display: "flex", gap: "10px" }}>
                        <Link to={`/products/${pId}`} className="btn btn-outline btn-sm" style={{ flex: 1, textAlign: "center" }}>
                          Details
                        </Link>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={isOutOfStock}
                          className={`btn btn-sm ${isOutOfStock ? "btn-out-of-stock" : "btn-primary"}`}
                          style={{ flex: 1 }}
                        >
                          {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "30px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.max(p - 1, 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={currentPage === 1}
                  className="btn btn-outline btn-sm"
                  style={{ padding: "6px 14px" }}
                >
                  ← Previous
                </button>

                <span style={{ fontSize: "0.9rem", color: "#475569" }}>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.min(p + 1, totalPages));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={currentPage === totalPages}
                  className="btn btn-outline btn-sm"
                  style={{ padding: "6px 14px" }}
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
            className="scroll-to-top-btn"
            title="Back to Top"
          >
            ↑
          </button>
        )}
      </div>
    </>
  );
}

export default Products;

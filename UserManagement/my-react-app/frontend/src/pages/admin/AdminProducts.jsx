import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import { TableRowSkeleton } from "../../components/ui/LoadingSkeleton";
import { API_URL } from "../../config/api";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Filter,
  ArrowUpDown,
  Boxes,
  Sparkles
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function fetchProducts(query = "") {
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

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");

      setProducts(products.filter((p) => p._id !== id));
      alert("Product deleted successfully");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSeedCatalog() {
    if (!window.confirm("This will purge legacy products and seed brand new premium products with full variants (Size, Color, Storage). Proceed?")) return;

    const token = localStorage.getItem("token");
    try {
      setSeeding(true);
      const res = await fetch(`${API_URL}/api/products/seed-catalog`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to seed catalog");
      alert(data.message);
      await fetchProducts("");
    } catch (err) {
      alert(err.message);
    } finally {
      setSeeding(false);
    }
  }

  // Categories list
  const categories = ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];

  // Filtered & Sorted products
  const filteredProducts = products
    .filter((p) => {
      if (selectedCategory === "all") return true;
      return p.category?.toLowerCase() === selectedCategory.toLowerCase();
    })
    .sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      if (sortBy === "stock-low") return (a.stock || 0) - (b.stock || 0);
      return 0;
    });

  // Pagination (20 products per page)
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function getStockBadge(stock) {
    const qty = Number(stock || 0);
    if (qty <= 0) {
      return <Badge variant="danger">Out of Stock ({qty})</Badge>;
    }
    if (qty <= 5) {
      return <Badge variant="warning">Low Stock ({qty})</Badge>;
    }
    return <Badge variant="success">In Stock ({qty})</Badge>;
  }

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <PageHeader
            title="Products & Inventory"
            subtitle="Manage product catalog, real-time warehouse stock, and pricing."
            badge={<Badge variant="info">{products.length} Products</Badge>}
            actions={
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleSeedCatalog}
                  disabled={seeding}
                  className="btn btn-secondary"
                  title="Purge legacy products and seed real-world catalog with variants"
                >
                  <Sparkles size={16} />
                  <span>{seeding ? "Seeding..." : "Seed Variant Catalog"}</span>
                </button>
                <Link to="/admin/products/add" className="btn btn-primary">
                  <Plus size={16} />
                  <span>Add Product</span>
                </Link>
              </div>
            }
          />

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

          {/* Filters Bar */}
          <div
            className="card"
            style={{
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
              <div style={{ position: "relative", width: "100%", maxWidth: "360px" }}>
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
                  placeholder="Search products by title, category..."
                  style={{ paddingLeft: "38px" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {categories.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Filter size={16} color="var(--color-text-muted)" />
                  <select
                    className="form-control"
                    style={{ width: "auto", minWidth: "140px" }}
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c === "all" ? "All Categories" : c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ArrowUpDown size={16} color="var(--color-text-muted)" />
              <select
                className="form-control"
                style={{ width: "auto" }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="default">Sort: Default</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="stock-low">Stock: Low First</option>
              </select>
            </div>
          </div>

          {/* Products Table */}
          {loading ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowSkeleton cols={5} />
                  <TableRowSkeleton cols={5} />
                  <TableRowSkeleton cols={5} />
                  <TableRowSkeleton cols={5} />
                </tbody>
              </table>
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No products found"
              description="No products matched your search or category filter. Add a new product or reset filters."
              action={
                <Link to="/admin/products/add" className="btn btn-primary btn-sm">
                  <Plus size={14} />
                  <span>Add First Product</span>
                </Link>
              }
            />
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "80px" }}>Preview</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock Level</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => {
                      const imageUrl =
                        product.imageUrl ||
                        product.image ||
                        "https://via.placeholder.com/100x100?text=No+Image";

                      return (
                        <tr key={product._id || product.id}>
                          <td>
                            <div
                              style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "var(--radius-sm)",
                                overflow: "hidden",
                                backgroundColor: "var(--color-surface-subtle)",
                                border: "1px solid var(--color-border)"
                              }}
                            >
                              <img
                                src={imageUrl}
                                alt={product.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong style={{ color: "var(--color-text-primary)", display: "block" }}>
                                {product.name}
                              </strong>
                              {product.discount?.isActive && (
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "var(--color-coral)",
                                    fontWeight: "700"
                                  }}
                                >
                                  🏷️ {product.discount.percentage}% Off Sale
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <Badge variant="neutral">{product.category || "General"}</Badge>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                              <strong style={{ color: "var(--color-primary)" }}>
                                ₹{product.price}
                              </strong>
                              {product.discount?.isActive && (
                                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", textDecoration: "line-through" }}>
                                  ₹{product.originalPrice || product.price}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{getStockBadge(product.stock)}</td>
                          <td>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                              <Link
                                to={`/admin/products/edit/${product._id || product.id}`}
                                className="btn btn-secondary btn-sm"
                                title="Edit Product"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </Link>
                              <button
                                onClick={() => handleDelete(product._id || product.id, product.name)}
                                className="btn btn-danger btn-sm"
                                title="Delete Product"
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "24px"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
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
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default AdminProducts;

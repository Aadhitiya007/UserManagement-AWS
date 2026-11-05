import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import { TableRowSkeleton } from "../../components/ui/LoadingSkeleton";
import { API_URL } from "../../config/api";
import { Star, Search, Trash2, MessageSquare, AlertCircle } from "lucide-react";

const ITEMS_PER_PAGE = 20;

function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/api/products/reviews/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load reviews");
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteReview(productId, reviewId, customerName) {
    if (!window.confirm(`Are you sure you want to delete the review by "${customerName}"?`)) {
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}/reviews/${reviewId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete review");

      setReviews((prev) => prev.filter((r) => (r._id || r.id) !== reviewId));
      alert("Review deleted successfully!");
    } catch (err) {
      alert(err.message);
    }
  }

  const filteredReviews = reviews.filter((r) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (r.productName && r.productName.toLowerCase().includes(term)) ||
      (r.userName && r.userName.toLowerCase().includes(term)) ||
      (r.comment && r.comment.toLowerCase().includes(term)) ||
      String(r.rating).includes(term)
    );
  });

  const totalPages = Math.ceil(filteredReviews.length / ITEMS_PER_PAGE) || 1;
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setCurrentPage(1);
  }

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <PageHeader
            title="Customer Reviews"
            subtitle="Moderate customer ratings, product satisfaction, and buyer feedback."
            badge={<Badge variant="info">{reviews.length} Reviews</Badge>}
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

          {/* Search Bar */}
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
            <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
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
                placeholder="Search reviews by customer, product, comment..."
                style={{ paddingLeft: "38px" }}
                value={search}
                onChange={handleSearchChange}
              />
            </div>

            <span style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)" }}>
              Showing <strong>{filteredReviews.length}</strong> submitted ratings
            </span>
          </div>

          {loading ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Feedback</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                </tbody>
              </table>
            </div>
          ) : filteredReviews.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No customer reviews found"
              description={search ? `No reviews matched "${search}".` : "No customer reviews have been submitted yet."}
            />
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "24%" }}>Product</th>
                      <th style={{ width: "18%" }}>Customer</th>
                      <th style={{ width: "12%" }}>Rating</th>
                      <th style={{ width: "32%" }}>Feedback Comment</th>
                      <th style={{ width: "14%" }}>Date</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReviews.map((rev) => {
                      const id = rev._id || rev.id;
                      const img = rev.productImage
                        ? rev.productImage.startsWith("http")
                          ? rev.productImage
                          : `${API_URL}/${rev.productImage.replace(/^\//, "")}`
                        : "https://via.placeholder.com/45";

                      return (
                        <tr key={id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <img
                                src={img}
                                alt={rev.productName}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "https://via.placeholder.com/45";
                                }}
                                style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "var(--radius-xs)" }}
                              />
                              <strong style={{ fontSize: "0.9rem", color: "var(--color-text-primary)" }}>
                                {rev.productName}
                              </strong>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: "600", color: "var(--color-text-primary)" }}>
                              {rev.userName || "Customer"}
                            </span>
                          </td>
                          <td>
                            <Badge
                              variant={rev.rating >= 4 ? "success" : rev.rating >= 3 ? "warning" : "danger"}
                              icon={Star}
                            >
                              {rev.rating} / 5
                            </Badge>
                          </td>
                          <td>
                            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                              "{rev.comment}"
                            </p>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                              {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : "-"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => handleDeleteReview(rev.productId, id, rev.userName)}
                                className="btn btn-danger btn-sm"
                                title="Delete Review"
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

export default AdminReviews;

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import { API_URL } from "../../config/api";
import { ArrowLeft, Upload, AlertCircle } from "lucide-react";

function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [stock, setStock] = useState("");
  const [currentImage, setCurrentImage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/products/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load product details");

        setName(data.name || "");
        setDescription(data.description || "");
        setPrice(data.price || "");
        setCategory(data.category || "Electronics");
        setStock(data.stock || 0);
        setCurrentImage(data.imageUrl || data.image || "");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const token = localStorage.getItem("token");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("category", category);
    formData.append("stock", stock);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update product");
      }

      alert("🎉 Product updated successfully!");
      navigate("/admin/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="admin-layout">
          <AdminSidebar />
          <main className="admin-content">
            <p style={{ color: "var(--color-text-secondary)" }}>Loading product details...</p>
          </main>
        </div>
      </>
    );
  }

  const displayImage =
    imagePreview ||
    (currentImage
      ? currentImage.startsWith("http") || currentImage.startsWith("data:")
        ? currentImage
        : `${API_URL}/${currentImage.replace(/^\//, "")}`
      : "");

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <PageHeader
            title="Edit Product"
            subtitle={`Updating specifications and stock for "${name}".`}
            actions={
              <Link to="/admin/products" className="btn btn-secondary btn-sm">
                <ArrowLeft size={14} />
                <span>Back to Catalog</span>
              </Link>
            }
          />

          {error && (
            <div
              style={{
                padding: "14px",
                backgroundColor: "var(--color-error-light)",
                color: "var(--color-error)",
                borderRadius: "var(--radius-md)",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ maxWidth: "760px" }}>
            <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Price (₹ INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={price}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseFloat(val) >= 0) setPrice(val);
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Warehouse Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={stock}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val, 10) >= 0) setStock(val);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Books">Books</option>
                  <option value="Home & Kitchen">Home & Kitchen</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Product Image</label>
                {displayImage && (
                  <div style={{ marginBottom: "12px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", display: "block", marginBottom: "6px" }}>
                      Active Image:
                    </span>
                    <div
                      style={{
                        width: "110px",
                        height: "110px",
                        borderRadius: "var(--radius-sm)",
                        overflow: "hidden",
                        border: "1px solid var(--color-border)"
                      }}
                    >
                      <img src={displayImage} alt="Current" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  </div>
                )}

                <div
                  style={{
                    border: "2px dashed var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "20px",
                    textAlign: "center",
                    backgroundColor: "var(--color-surface-subtle)",
                    cursor: "pointer",
                    position: "relative"
                  }}
                >
                  <Upload size={24} color="var(--color-text-muted)" style={{ margin: "0 auto 6px" }} />
                  <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary)", margin: "0 0 2px" }}>
                    Upload replacement image (Amazon S3)
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                      width: "100%",
                      height: "100%"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={submitting}
                >
                  {submitting ? "Saving Changes..." : "Save Product Changes"}
                </button>
                <Link to="/admin/products" className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    </>
  );
}

export default EditProduct;

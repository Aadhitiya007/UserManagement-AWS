import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import { API_URL } from "../../config/api";
import { ArrowLeft, Upload, Check, AlertCircle } from "lucide-react";

function AddProduct() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [stock, setStock] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

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
    setLoading(true);

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
      const res = await fetch(`${API_URL}/api/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create product");
      }

      alert("🎉 Product created and synced with S3 successfully!");
      navigate("/admin/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <PageHeader
            title="Create Product"
            subtitle="Add a new item to your online storefront with S3 media hosting."
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
                <label className="form-label">Product Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Modern Ergonomic Wireless Keyboard"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe key features, technical specifications, and materials..."
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
                    placeholder="1499.00"
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
                    placeholder="25"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Store Category *</label>
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
                <label className="form-label">Product Image (Uploaded to Amazon S3)</label>
                <div
                  style={{
                    border: "2px dashed var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "24px",
                    textAlign: "center",
                    backgroundColor: "var(--color-surface-subtle)",
                    cursor: "pointer",
                    position: "relative"
                  }}
                >
                  <Upload size={28} color="var(--color-text-muted)" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: "0.88rem", fontWeight: "600", color: "var(--color-text-primary)", margin: "0 0 4px" }}>
                    Select image to upload
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: 0 }}>
                    PNG, JPG, or WEBP up to 5MB
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

                {imagePreview && (
                  <div style={{ marginTop: "14px" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-secondary)" }}>
                      Selected Preview:
                    </span>
                    <div
                      style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "var(--radius-sm)",
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        marginTop: "6px"
                      }}
                    >
                      <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? "Publishing to S3..." : "Publish Product"}
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

export default AddProduct;

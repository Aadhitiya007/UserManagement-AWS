import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { API_URL } from "../../config/api";

function AdminDiscounts() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [maxTotalUsage, setMaxTotalUsage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function fetchCoupons() {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/coupons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load coupons");
      setCoupons(Array.isArray(data) ? data : data.coupons || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCoupon(e) {
    e.preventDefault();
    if (!code.trim() || !discountValue || !expirationDate) {
      setError("Please fill all required fields: Code, Discount Value, and Expiration Date.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      const token = localStorage.getItem("token");

      const payload = {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType,
        discountValue: Number(discountValue),
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        expirationDate: new Date(expirationDate).toISOString(),
        maxTotalUsage: maxTotalUsage ? Number(maxTotalUsage) : null
      };

      const res = await fetch(`${API_URL}/api/coupons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create coupon");

      setSuccess(`🎉 Coupon ${payload.code} created successfully!`);
      setShowCreateModal(false);
      resetForm();
      fetchCoupons();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(coupon) {
    try {
      setError("");
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/coupons/${coupon.code}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update coupon status");
      fetchCoupons();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(codeToDelete) {
    if (!window.confirm(`Are you sure you want to delete coupon "${codeToDelete}"?`)) return;

    try {
      setError("");
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/coupons/${codeToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete coupon");
      setSuccess(`Coupon "${codeToDelete}" deleted.`);
      fetchCoupons();
    } catch (err) {
      setError(err.message);
    }
  }

  function resetForm() {
    setCode("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinOrderAmount("");
    setMaxDiscountAmount("");
    setExpirationDate("");
    setMaxTotalUsage("");
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ padding: "30px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <Link to="/admin/dashboard" className="btn btn-outline btn-sm" style={{ marginBottom: "8px" }}>
              ← Admin Dashboard
            </Link>
            <h1 style={{ fontSize: "1.8rem", margin: "6px 0", color: "#0f172a" }}>
              🏷️ Promotional Coupons & Discounts
            </h1>
            <p style={{ color: "#64748b", margin: 0 }}>
              Manage store-wide promotional coupons, percentage discounts, and minimum cart thresholds.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="btn btn-primary"
            style={{ padding: "10px 18px", fontWeight: "600" }}
          >
            {showCreateModal ? "Cancel" : "+ Create Coupon"}
          </button>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "12px 16px", background: "#dcfce7", color: "#166534", borderRadius: "8px", marginBottom: "20px" }}>
            {success}
          </div>
        )}

        {/* Create Coupon Drawer / Box */}
        {showCreateModal && (
          <div className="admin-card" style={{ marginBottom: "30px", border: "2px solid #3b82f6" }}>
            <div className="admin-card-header" style={{ background: "#eff6ff" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e3a8a" }}>✨ Create New Promotional Coupon</h3>
            </div>
            <div style={{ padding: "24px" }}>
              <form onSubmit={handleCreateCoupon}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Coupon Code *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. SPOOKY20"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      style={{ textTransform: "uppercase" }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Discount Type *
                    </label>
                    <select
                      className="form-control"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Rupee Amount (₹)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Discount Value * ({discountType === "percentage" ? "%" : "₹"})
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 200"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Min Cart Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="0 (No minimum)"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="Optional cap for % discounts"
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Expiration Date *
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Description / Banner Note
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 20% off on all festival orders over ₹999"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", marginBottom: "6px" }}>
                      Total Redemptions Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="Unlimited if empty"
                      value={maxTotalUsage}
                      onChange={(e) => setMaxTotalUsage(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Creating..." : "Save Coupon"}
                  </button>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Coupons Table Card */}
        <div className="admin-card">
          <div className="admin-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b" }}>
              Active & Configured Coupons ({coupons.length})
            </h3>
            <button onClick={fetchCoupons} className="btn btn-outline btn-sm">
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading coupons...</div>
          ) : coupons.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              No coupons created yet. Click "+ Create Coupon" above to launch your first promotion!
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px" }}>Code</th>
                    <th style={{ padding: "12px 16px" }}>Discount</th>
                    <th style={{ padding: "12px 16px" }}>Min Cart / Cap</th>
                    <th style={{ padding: "12px 16px" }}>Expires</th>
                    <th style={{ padding: "12px 16px" }}>Usage</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => {
                    const isExpired = new Date(c.expirationDate) < new Date();
                    return (
                      <tr key={c.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <strong style={{ color: "#2563eb", fontSize: "0.95rem" }}>{c.code}</strong>
                          {c.description && (
                            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>{c.description}</p>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontWeight: "600", color: "#0f172a" }}>
                            {c.discountType === "percentage" ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "0.85rem", color: "#475569" }}>
                          Min: ₹{c.minOrderAmount || 0}
                          {c.maxDiscountAmount ? ` | Max: ₹${c.maxDiscountAmount}` : ""}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "0.85rem" }}>
                          <span style={{ color: isExpired ? "#dc2626" : "#475569" }}>
                            {new Date(c.expirationDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "0.85rem", color: "#475569" }}>
                          {c.usageCount || 0} {c.maxTotalUsage ? `/ ${c.maxTotalUsage}` : "uses"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {isExpired ? (
                            <span className="badge badge-danger">Expired</span>
                          ) : c.isActive ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-secondary" style={{ background: "#94a3b8", color: "#fff" }}>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button
                              onClick={() => handleToggleStatus(c)}
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                            >
                              {c.isActive ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDelete(c.code)}
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default AdminDiscounts;


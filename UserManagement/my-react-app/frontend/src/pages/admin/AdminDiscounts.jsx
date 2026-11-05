import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import PageHeader from "../../components/ui/PageHeader";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import { API_URL } from "../../config/api";
import {
  Tag,
  Plus,
  Copy,
  Check,
  Calendar,
  AlertCircle,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Percent,
  CheckCircle2
} from "lucide-react";

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

  const [copiedCode, setCopiedCode] = useState("");

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
    if (!window.confirm(`Are you sure you want to permanently delete coupon "${codeToDelete}"?`)) return;

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

  function handleCopy(c) {
    navigator.clipboard.writeText(c);
    setCopiedCode(c);
    setTimeout(() => setCopiedCode(""), 2000);
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
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <PageHeader
            title="Discounts & Coupons"
            subtitle="Configure promotional codes, percentage discounts, and usage limits."
            badge={<Badge variant="info">{coupons.length} Active Codes</Badge>}
            actions={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
              >
                <Plus size={16} />
                <span>Create Coupon</span>
              </button>
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

          {success && (
            <div
              style={{
                padding: "14px",
                backgroundColor: "var(--color-success-light)",
                color: "var(--color-success)",
                borderRadius: "var(--radius-md)",
                marginBottom: "20px"
              }}
            >
              {success}
            </div>
          )}

          {loading ? (
            <p style={{ color: "var(--color-text-secondary)" }}>Loading promotional coupons...</p>
          ) : coupons.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No promotional coupons active"
              description="Create promotional discount codes to incentivize checkout and customer retention."
              action={
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus size={14} />
                  <span>Create First Coupon</span>
                </button>
              }
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "20px"
              }}
            >
              {coupons.map((coupon) => {
                const isExpired = new Date(coupon.expirationDate) < new Date();
                const isCopied = copiedCode === coupon.code;

                return (
                  <div
                    key={coupon.code}
                    className="card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      borderColor: coupon.isActive && !isExpired ? "var(--color-primary)" : "var(--color-border)",
                      opacity: coupon.isActive && !isExpired ? 1 : 0.75
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "12px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: "800",
                              fontSize: "1.15rem",
                              color: "var(--color-primary)",
                              letterSpacing: "0.05em",
                              backgroundColor: "var(--color-primary-light)",
                              padding: "4px 8px",
                              borderRadius: "var(--radius-xs)"
                            }}
                          >
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(coupon.code)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px", height: "auto" }}
                            title="Copy Code"
                          >
                            {isCopied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                          </button>
                        </div>

                        <Badge variant={!coupon.isActive ? "danger" : isExpired ? "warning" : "success"}>
                          {!coupon.isActive ? "Disabled" : isExpired ? "Expired" : "Active"}
                        </Badge>
                      </div>

                      <div style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--color-text-primary)", marginBottom: "4px" }}>
                        {coupon.discountType === "percentage"
                          ? `${coupon.discountValue}% OFF`
                          : `₹${coupon.discountValue} FLAT OFF`}
                      </div>

                      {coupon.description && (
                        <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "14px" }}>
                          {coupon.description}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          fontSize: "0.82rem",
                          color: "var(--color-text-secondary)",
                          backgroundColor: "var(--color-surface-subtle)",
                          padding: "10px 12px",
                          borderRadius: "var(--radius-sm)",
                          marginBottom: "16px"
                        }}
                      >
                        <div>
                          Min. Order: <strong>₹{coupon.minOrderAmount || 0}</strong>
                        </div>
                        {coupon.maxDiscountAmount && (
                          <div>
                            Max Discount Cap: <strong>₹{coupon.maxDiscountAmount}</strong>
                          </div>
                        )}
                        <div>
                          Usage: <strong>{coupon.usageCount || 0}</strong> / {coupon.maxTotalUsage || "∞"} used
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Calendar size={12} />
                          <span>Expires: {new Date(coupon.expirationDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "12px",
                        borderTop: "1px solid var(--color-border)"
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(coupon)}
                        className="btn btn-secondary btn-sm"
                      >
                        {coupon.isActive ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(coupon.code)}
                        className="btn btn-danger btn-sm"
                        title="Delete Coupon"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CREATE COUPON MODAL */}
          <Modal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            title="🏷️ Create Promotional Voucher"
          >
            <form onSubmit={handleCreateCoupon} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Promotional Code *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. FESTIVE30"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  style={{ textTransform: "uppercase", fontWeight: "700" }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Campaign Description</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Festive seasonal discount for orders above ₹500"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Discount Type *</label>
                  <select
                    className="form-control"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {discountType === "percentage" ? "Discount Percentage *" : "Discount Amount (₹) *"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={discountType === "percentage" ? "100" : undefined}
                    className="form-control"
                    placeholder={discountType === "percentage" ? "20" : "150"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Min. Order Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="Optional cap"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Expiration Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Usage Limit (Total)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    placeholder="e.g. 100 uses"
                    value={maxTotalUsage}
                    onChange={(e) => setMaxTotalUsage(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={submitting}
                >
                  {submitting ? "Publishing Coupon..." : "Publish Coupon"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        </main>
      </div>
    </>
  );
}

export default AdminDiscounts;

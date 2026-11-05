import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_URL } from "../../config/api";
import { ShieldCheck, Mail, Lock, ArrowLeft, AlertCircle } from "lucide-react";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/staff-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Staff authentication failed.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #1E293B 0%, #0F172A 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-sans)"
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "440px",
          width: "100%",
          padding: "0",
          overflow: "hidden",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.1)"
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
            padding: "32px 24px 24px",
            textAlign: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            position: "relative"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(49, 94, 251, 0.15)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              border: "1px solid rgba(49, 94, 251, 0.3)"
            }}
          >
            <ShieldCheck size={26} />
          </div>

          <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#FFFFFF", margin: "0 0 4px" }}>
            Staff & Manager Portal
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#94A3B8", margin: 0 }}>
            Restricted access for Store Managers & Administrators
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "32px 28px" }}>
          {error && (
            <div
              style={{
                padding: "12px 14px",
                backgroundColor: "var(--color-error-light)",
                color: "var(--color-error)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "20px",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px"
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Staff Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail
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
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="manager@shopiee.com"
                  className="form-control"
                  style={{ paddingLeft: "38px" }}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Security Password</label>
              <div style={{ position: "relative" }}>
                <Lock
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="form-control"
                  style={{ paddingLeft: "38px" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "6px" }}
            >
              {loading ? "Verifying Credentials..." : "Access Management Console"}
            </button>
          </form>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--color-border)",
              textAlign: "center"
            }}
          >
            <Link
              to="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--color-text-secondary)",
                fontSize: "0.85rem",
                fontWeight: "500"
              }}
            >
              <ArrowLeft size={14} />
              <span>Return to Customer Storefront</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;

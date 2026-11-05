import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  KeyRound, 
  Mail, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from "lucide-react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      const data = await res.json();
      setSubmitted(true);
      setMessage(
        data.message ||
        "If an account exists with this email address, a password reset link has been dispatched to your inbox."
      );
    } catch (err) {
      setError(err.message || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "460px", margin: "60px auto", padding: "0 20px" }}>
        <div className="card" style={{ padding: "36px 30px", borderRadius: "20px" }}>
          
          {submitted ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(22, 163, 106, 0.12)",
                color: "var(--success)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px"
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
                Check Your Email
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "20px" }}>
                {message}
              </p>
              
              <div style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "14px",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <Clock size={16} style={{ color: "var(--warning)", flexShrink: 0 }} />
                <span>The link will remain active for <strong>15 minutes</strong>. Remember to check spam folders.</span>
              </div>

              <Link to="/login" className="btn btn-primary" style={{ display: "block", width: "100%", padding: "12px", fontWeight: 700, textDecoration: "none" }}>
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: "26px" }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)",
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "14px",
                  boxShadow: "0 6px 16px rgba(49, 94, 251, 0.3)"
                }}>
                  <KeyRound size={24} />
                </div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  Forgot Password?
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "4px" }}>
                  Enter your email to receive a secure recovery link
                </p>
              </div>

              {error && (
                <div style={{
                  padding: "12px 14px",
                  background: "rgba(220, 38, 38, 0.1)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                  borderRadius: "10px",
                  color: "var(--error)",
                  fontSize: "0.85rem",
                  marginBottom: "18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: "22px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Registered Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                    <input
                      type="email"
                      className="form-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      style={{ paddingLeft: "40px" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "13px", fontWeight: 700, fontSize: "0.95rem" }}
                  disabled={loading}
                >
                  {loading ? "Sending Reset Link..." : "Send Reset Link"}
                </button>

                <div style={{ textAlign: "center", marginTop: "22px" }}>
                  <Link
                    to="/login"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textDecoration: "none"
                    }}
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </Link>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}

export default ForgotPassword;
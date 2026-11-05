import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Mail, 
  Send 
} from "lucide-react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("verifying"); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token was found in this link.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`${API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to verify email.");
        }

        setStatus("success");
        setMessage(data.message || "Your email address has been successfully verified!");
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Invalid or expired email verification link.");
      }
    }

    verify();
  }, [token]);

  async function handleResend(e) {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    try {
      setResending(true);
      setResendStatus("");
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() })
      });
      const data = await res.json();
      setResendStatus(data.message || "A new verification link has been sent if an unverified account exists.");
    } catch {
      setResendStatus("Failed to send verification email. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "520px", margin: "60px auto", padding: "0 20px" }}>
        <div className="card" style={{ padding: "40px 32px", borderRadius: "20px", textAlign: "center" }}>
          
          {status === "verifying" && (
            <div>
              <div style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(49, 94, 251, 0.1)",
                color: "var(--primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px"
              }}>
                <Clock size={32} />
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
                Verifying your email...
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem" }}>
                Please wait while we confirm your account credentials with Shopiee.
              </p>
            </div>
          )}

          {status === "success" && (
            <div>
              <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(22, 163, 106, 0.12)",
                color: "var(--success)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
                boxShadow: "0 0 0 8px rgba(22, 163, 106, 0.05)"
              }}>
                <CheckCircle2 size={36} />
              </div>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
                Email Verified!
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "28px" }}>
                {message}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Link to="/login" className="btn btn-primary" style={{ padding: "12px", fontWeight: 700, textDecoration: "none" }}>
                  Sign In Now
                </Link>
                <Link to="/products" className="btn btn-secondary" style={{ padding: "12px", fontWeight: 600, textDecoration: "none" }}>
                  Browse Shop
                </Link>
              </div>
            </div>
          )}

          {status === "error" && (
            <div>
              <div style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(220, 38, 38, 0.1)",
                color: "var(--error)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px"
              }}>
                <AlertCircle size={32} />
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--error)", marginBottom: "8px" }}>
                Verification Failed
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: "1.6", marginBottom: "24px" }}>
                {message}
              </p>

              {/* Resend box */}
              <div style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "20px",
                textAlign: "left"
              }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Need a new verification link?
                </h4>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0 0 14px 0" }}>
                  Enter your email address below and we'll dispatch a fresh activation token.
                </p>

                <form onSubmit={handleResend} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                    <input
                      type="email"
                      placeholder="Enter registered email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                      className="form-control"
                      style={{ paddingLeft: "38px" }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={resending}
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    <Send size={14} />
                    {resending ? "Dispatching link..." : "Resend Verification Link"}
                  </button>
                </form>

                {resendStatus && (
                  <p style={{ color: "var(--primary)", fontSize: "0.82rem", marginTop: "12px", marginBottom: 0, fontWeight: 500 }}>
                    {resendStatus}
                  </p>
                )}
              </div>

              <div style={{ marginTop: "20px" }}>
                <Link to="/login" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textDecoration: "none" }}>
                  ← Return to Sign In
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default VerifyEmail;
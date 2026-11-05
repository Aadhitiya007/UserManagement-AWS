import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle
} from "lucide-react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";
import { useCart } from "../context/CartContext";

function ShoppingDoodle() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
      <svg
        width="110"
        height="100"
        viewBox="0 0 120 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 4px 14px rgba(49, 94, 251, 0.15))" }}
      >
        {/* Soft pastel background cloud/blob */}
        <path
          d="M24 52C18 30 36 14 58 15C80 16 98 28 96 52C94 76 78 94 54 93C30 92 26 74 24 52Z"
          fill="rgba(49, 94, 251, 0.1)"
        />
        
        {/* Main Shopping Bag Doodle Body */}
        <rect
          x="32"
          y="36"
          width="54"
          height="54"
          rx="12"
          fill="#315EFB"
          stroke="#172033"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        
        {/* Shopping Bag Handles (Hand-drawn arch) */}
        <path
          d="M46 36V24C46 17.5 51.5 12 59 12C66.5 12 72 17.5 72 24V36"
          stroke="#172033"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        
        {/* Cheerful Doodle Eyes */}
        <circle cx="48" cy="55" r="3" fill="#FFFFFF" />
        <circle cx="70" cy="55" r="3" fill="#FFFFFF" />
        
        {/* Playful Smile */}
        <path
          d="M53 64C56 68 62 68 65 64"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        
        {/* Rosy Cheeks */}
        <circle cx="42" cy="62" r="3" fill="#FF7043" opacity="0.9" />
        <circle cx="76" cy="62" r="3" fill="#FF7043" opacity="0.9" />

        {/* Small Gift Box with Ribbon popping out */}
        <rect
          x="76"
          y="60"
          width="26"
          height="26"
          rx="6"
          fill="#FF7043"
          stroke="#172033"
          strokeWidth="2.4"
        />
        <path d="M89 60V86" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M76 73H102" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
        {/* Ribbon Bow */}
        <path
          d="M85 57C82 54 86 52 89 57C92 52 96 54 93 57"
          stroke="#172033"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Playful Doodle Sparkles */}
        <path
          d="M20 28L22 22L24 28L30 30L24 32L22 38L20 32L14 30L20 28Z"
          fill="#FBBF24"
          stroke="#172033"
          strokeWidth="1.2"
        />
        <circle cx="98" cy="24" r="2.5" fill="#16A36A" />
        <circle cx="16" cy="74" r="2.5" fill="#315EFB" />
        <path
          d="M102 42L103.5 38L105 42L109 43.5L105 45L103.5 49L102 45L98 43.5L102 42Z"
          fill="#FF7043"
        />
      </svg>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(() => {
    return new URLSearchParams(window.location.search).get("expired") === "1";
  });

  const navigate = useNavigate();
  const { switchUser } = useCart();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSessionExpired(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store auth data in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Switch cart to the logged-in user's personal cart
      if (typeof switchUser === "function") {
        switchUser(data.user);
      }

      if (data.user?.role === "admin" || data.user?.role === "manager") {
        navigate("/admin/dashboard");
      } else {
        navigate("/products");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "440px", margin: "50px auto", padding: "0 20px" }}>
        <div className="card" style={{ padding: "36px 30px", borderRadius: "20px" }}>
          
          {/* Header with Friendly Shopping Doodle */}
          <div style={{ textAlign: "center", marginBottom: "26px" }}>
            <ShoppingDoodle />
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Welcome back
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "4px" }}>
              Sign in to manage your bag, track orders, and view wishlist
            </p>
          </div>

          {sessionExpired && (
            <div style={{
              padding: "12px 14px",
              background: "rgba(217, 119, 6, 0.1)",
              border: "1px solid rgba(217, 119, 6, 0.3)",
              borderRadius: "10px",
              color: "var(--warning)",
              fontSize: "0.85rem",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <AlertCircle size={16} />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

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
            <div className="form-group" style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  style={{ paddingLeft: "40px" }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                  Password
                </label>
                <Link to="/forgot-password" style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  style={{ paddingLeft: "40px", paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    padding: 0
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "13px",
                fontSize: "0.95rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in to Shopiee"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Registration link */}
          <p style={{ marginTop: "24px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
            New to Shopiee?{" "}
            <Link to="/signup" style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>
              Create an account
            </Link>
          </p>

          {/* Staff Portal Link */}
          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
            <Link
              to="/admin/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 500
              }}
            >
              <ShieldCheck size={14} /> Staff & Manager Portal →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}

export default Login;
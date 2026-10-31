import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";
import { useCart } from "../context/CartContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

      if (data.user?.role === "admin") {
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
      <div className="container">
        <div className="form-card">
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>User Login</h2>

          {sessionExpired && (
            <div style={{ padding: "10px", background: "#fef3c7", color: "#92400e", borderRadius: "6px", marginBottom: "15px", border: "1px solid #fde68a" }}>
              ⚠️ Your session has expired. Please sign in again.
            </div>
          )}

          {error && (
            <div style={{ padding: "10px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "15px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@example.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p style={{ marginTop: "20px", textAlign: "center", color: "#6b7280" }}>
            Don't have an account? <Link to="/signup" style={{ color: "#2563eb" }}>Register</Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default Login;

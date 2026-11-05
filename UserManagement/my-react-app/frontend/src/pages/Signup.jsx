import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, 
  Mail, 
  Lock, 
  Calendar, 
  Globe, 
  Phone, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  UserPlus,
  CheckCircle2
} from "lucide-react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Regex Patterns for Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{10}$/; // Requires exactly 10 digits

  function validateForm() {
    if (!name.trim()) {
      return "Full Name is required.";
    }

    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address (e.g. user@example.com).";
    }

    if (!password || password.length < 6) {
      return "Password must be at least 6 characters long.";
    }

    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 18) {
      return "You must be at least 18 years old to create an account.";
    }

    if (!country.trim()) {
      return "Country is required.";
    }

    if (!phoneRegex.test(phone.trim())) {
      return "Phone number must be a valid 10-digit number.";
    }

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Perform Regex and Form Validation
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          age: Number(age),
          country: country.trim(),
          phone: phone.trim(),
          role: "user" // Default role
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "520px", margin: "40px auto", padding: "0 20px" }}>
        <div className="card" style={{ padding: "36px 32px", borderRadius: "20px" }}>
          
          {success ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(22, 163, 106, 0.12)",
                color: "var(--success)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px"
              }}>
                <CheckCircle2 size={34} />
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
                Account Created!
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: "1.6", marginBottom: "24px" }}>
                A verification link has been sent to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>. Please check your inbox to activate your account.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="btn btn-primary"
                style={{ width: "100%", padding: "13px", fontWeight: 700 }}
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
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
                  <UserPlus size={24} />
                </div>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  Create Account
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "4px" }}>
                  Join Shopiee to explore curated collections and track orders
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
                {/* Full Name */}
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Full Name *
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                    <input
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Jane Doe"
                      style={{ paddingLeft: "40px" }}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Email Address *
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

                {/* Password */}
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Password *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="At least 6 characters"
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

                {/* Age & Country Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                  <div className="form-group">
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                      Age (18+) *
                    </label>
                    <div style={{ position: "relative" }}>
                      <Calendar size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                      <input
                        type="number"
                        min="18"
                        max="120"
                        className="form-control"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        required
                        placeholder="24"
                        style={{ paddingLeft: "36px" }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                      Country *
                    </label>
                    <div style={{ position: "relative" }}>
                      <Globe size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                      <input
                        type="text"
                        className="form-control"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        required
                        placeholder="India"
                        style={{ paddingLeft: "36px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="form-group" style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                    Phone Number (10 digits) *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                    <input
                      type="tel"
                      maxLength={10}
                      className="form-control"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      required
                      placeholder="9876543210"
                      style={{ paddingLeft: "40px" }}
                    />
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
                  {loading ? "Creating Account..." : "Create Account"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              {/* Login Link */}
              <p style={{ marginTop: "22px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                Already have an account?{" "}
                <Link to="/login" style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>
                  Sign in
                </Link>
              </p>
            </>
          )}

        </div>
      </div>
    </>
  );
}

export default Signup;
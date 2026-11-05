import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { 
  CheckCircle2, 
  FileText, 
  Package, 
  ShoppingBag, 
  Download, 
  Clock, 
  AlertCircle,
  Sparkles
} from "lucide-react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") || searchParams.get("order_id");
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("No order reference provided.");
      setLoading(false);
      return;
    }

    verifyPayment();
  }, [orderId]);

  async function verifyPayment() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_URL}/api/payment/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to verify payment status");
      }

      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "640px", margin: "40px auto", padding: "0 20px" }}>
        {loading ? (
          <div className="card" style={{ padding: "40px", textAlign: "center" }}>
            <LoadingSkeleton lines={4} />
          </div>
        ) : error ? (
          <div className="card" style={{ padding: "40px", textAlign: "center", borderColor: "rgba(220, 38, 38, 0.3)" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(220, 38, 38, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--error)" }}>
              <AlertCircle size={28} />
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--error)", marginBottom: "8px" }}>Verification Notice</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>{error}</p>
            <Link to="/orders" className="btn btn-primary">
              Go to My Orders
            </Link>
          </div>
        ) : order?.paymentStatus !== "Paid" ? (
          <div className="card" style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(217, 119, 6, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--warning)" }}>
              <Clock size={28} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--warning)", marginBottom: "8px" }}>
              Payment Status: {order?.paymentStatus || "Pending"}
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.92rem", lineHeight: "1.6" }}>
              Your transaction is being confirmed by our payment partners. Please allow a few moments.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={verifyPayment} className="btn btn-primary">
                Refresh Status
              </button>
              <Link to={`/payment/${orderId}`} className="btn btn-secondary">
                Retry Payment
              </Link>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: "36px 30px", borderRadius: "20px" }}>
            
            {/* Celebration Graphic */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(22, 163, 106, 0.12)",
                color: "var(--success)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                boxShadow: "0 0 0 8px rgba(22, 163, 106, 0.05)"
              }}>
                <CheckCircle2 size={36} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "6px" }}>
                <span className="badge badge-success">
                  <Sparkles size={12} style={{ marginRight: "4px" }} /> Confirmed & Verified
                </span>
              </div>

              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Payment Successful!
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", marginTop: "6px" }}>
                Thank you for your order. We are preparing it for delivery.
              </p>
            </div>

            {/* Email Dispatch Notice */}
            <div style={{
              background: "rgba(22, 163, 106, 0.08)",
              border: "1px solid rgba(22, 163, 106, 0.2)",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "24px",
              fontSize: "0.85rem",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontWeight: 500
            }}>
              <FileText size={16} />
              <span>An official Tax Invoice has been generated and dispatched to your email.</span>
            </div>

            {/* Receipt Summary Card */}
            <div style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "20px",
              marginBottom: "24px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Order Reference</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>#{orderId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Payment Gateway</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {order.paymentDetails?.provider === "razorpay" ? "Razorpay Gateway (Live)" : (order.paymentMethod || "Online Payment")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Transaction ID</span>
                <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--text-primary)", fontSize: "0.82rem" }}>
                  {order.paymentDetails?.transactionId || (sessionId ? sessionId.slice(0, 18) + "..." : "COMPLETED")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Payment Date</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {order.paymentDetails?.paidAt ? new Date(order.paymentDetails.paidAt).toLocaleString() : new Date().toLocaleString()}
                </span>
              </div>

              <div style={{
                borderTop: "1px dashed var(--border)",
                paddingTop: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline"
              }}>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Amount Paid</span>
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--success)" }}>₹{order.totalAmount}</span>
              </div>
            </div>

            {/* Tax Invoice Direct Download */}
            <div style={{ marginBottom: "20px" }}>
              <a
                href={`${API_URL}/api/orders/${orderId}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "13px",
                  width: "100%",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  textDecoration: "none"
                }}
              >
                <Download size={16} /> Download Official Tax Invoice (PDF)
              </a>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Link 
                to="/orders" 
                className="btn btn-primary" 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "8px", 
                  padding: "12px", 
                  fontSize: "0.92rem", 
                  fontWeight: 600 
                }}
              >
                <Package size={16} /> My Orders
              </Link>
              <Link 
                to="/products" 
                className="btn btn-secondary" 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "8px", 
                  padding: "12px", 
                  fontSize: "0.92rem", 
                  fontWeight: 600 
                }}
              >
                <ShoppingBag size={16} /> Storefront
              </Link>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

export default PaymentSuccess;
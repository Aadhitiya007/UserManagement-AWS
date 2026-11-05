import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { 
  ShieldCheck, 
  CreditCard, 
  Zap, 
  ArrowLeft, 
  AlertCircle, 
  Lock, 
  CheckCircle2, 
  HelpCircle,
  Smartphone,
  Building2,
  Receipt
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { API_URL } from "../config/api";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function Payment() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rzpLoading, setRzpLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelledNotice, setCancelledNotice] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("UPI");

  useEffect(() => {
    if (searchParams.get("cancelled") === "true") {
      setCancelledNotice(true);
    }
    fetchOrderDetails();
  }, [orderId]);

  async function fetchOrderDetails() {
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
        throw new Error(data.message || "Could not retrieve order for payment");
      }

      // If already paid, go straight to success
      if (data.paymentStatus === "Paid") {
        navigate(`/payment/success?orderId=${orderId}`);
        return;
      }

      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Real Razorpay Checkout Flow (UPI, Google Pay, PhonePe, Paytm, RuPay, Cards, NetBanking)
  async function handleRazorpayPayment() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setRzpLoading(true);
      setError("");

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
      }

      const res = await fetch(`${API_URL}/api/payment/razorpay/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create Razorpay order.");
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "Shopiee Store",
        description: `Order #${orderId.slice(-8)} Payment`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.customer?.name || "",
          email: data.customer?.email || "",
          contact: data.customer?.phone || ""
        },
        theme: {
          color: "#315EFB"
        },
        handler: async function (response) {
          try {
            setProcessing(true);
            const verifyRes = await fetch(`${API_URL}/api/payment/razorpay/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.message || "Razorpay payment verification failed.");
            }

            clearCart();
            navigate(`/payment/success?orderId=${orderId}`);
          } catch (err) {
            setError(err.message || "Payment verification failed.");
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setRzpLoading(false);
            setProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (failResp) {
        setError(failResp.error?.description || "Payment failed at gateway.");
        setRzpLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || "Could not open Razorpay checkout.");
    } finally {
      setRzpLoading(false);
    }
  }

  // Demo / Simulation Payment Flow
  async function handleCompleteSimulation() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setProcessing(true);
      setError("");

      const res = await fetch(`${API_URL}/api/payment/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId,
          shouldSucceed: true,
          paymentMethod
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Payment simulation failed");
      }

      clearCart();
      navigate(`/payment/success?orderId=${orderId}`);
    } catch (err) {
      setError(err.message || "An error occurred during payment processing");
      setProcessing(false);
    }
  }

  async function handleCancelToCart() {
    const token = localStorage.getItem("token");
    try {
      setProcessing(true);
      setError("");

      await fetch(`${API_URL}/api/payment/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });

      navigate("/cart");
    } catch (err) {
      setError(err.message || "Failed to cancel order");
      setProcessing(false);
    }
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: "680px", margin: "40px auto", padding: "0 20px" }}>
        
        {/* Breadcrumb / Back button */}
        <div style={{ marginBottom: "20px" }}>
          <button 
            onClick={handleCancelToCart}
            disabled={processing || rzpLoading}
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "8px", 
              background: "none", 
              border: "none", 
              color: "var(--text-secondary)", 
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500
            }}
          >
            <ArrowLeft size={16} /> Return to Cart
          </button>
        </div>

        {loading ? (
          <div className="card" style={{ padding: "36px", textAlign: "center" }}>
            <LoadingSkeleton lines={4} />
          </div>
        ) : error ? (
          <div className="card" style={{ padding: "36px", textAlign: "center", borderColor: "rgba(220, 38, 38, 0.3)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(220, 38, 38, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--error)" }}>
              <AlertCircle size={24} />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--error)", marginBottom: "8px" }}>Payment Error</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>{error}</p>
            <button onClick={fetchOrderDetails} className="btn btn-primary">
              Retry Payment
            </button>
          </div>
        ) : !order ? (
          <div className="card" style={{ padding: "36px", textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)" }}>Order details not found.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: "32px", borderRadius: "18px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: "8px" }}>
                  <Lock size={12} style={{ marginRight: "4px" }} /> 256-bit SSL Encrypted
                </span>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  Secure Checkout
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                  Complete your order payment via UPI, Cards, NetBanking, or Simulator.
                </p>
              </div>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(49, 94, 251, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                <ShieldCheck size={22} />
              </div>
            </div>

            {cancelledNotice && (
              <div style={{
                background: "rgba(217, 119, 6, 0.1)",
                border: "1px solid rgba(217, 119, 6, 0.3)",
                borderRadius: "10px",
                padding: "12px 16px",
                color: "var(--warning)",
                fontSize: "0.88rem",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}>
                <AlertCircle size={18} />
                <span>Payment was cancelled. Your selected items and inventory remain securely held.</span>
              </div>
            )}

            {/* Order Summary Box */}
            <div style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "20px",
              marginBottom: "24px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Order Reference</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>#{orderId.slice(-8).toUpperCase()}</span>
              </div>

              {/* Items Preview if available */}
              {Array.isArray(order.products) && order.products.length > 0 && (
                <div style={{ borderTop: "1px dashed var(--border)", borderBottom: "1px dashed var(--border)", padding: "12px 0", margin: "12px 0" }}>
                  {order.products.map((p, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                      <span style={{ color: "var(--text-primary)" }}>{p.name} <span style={{ color: "var(--text-secondary)" }}>× {p.quantity}</span></span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>₹{p.price * p.quantity}</span>
                    </div>
                  ))}
                  {order.couponCode && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--success)", marginTop: "4px" }}>
                      <span>Discount ({order.couponCode})</span>
                      <span>-₹{order.couponDiscount}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block" }}>Total Amount Due</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Inclusive of all taxes & delivery</span>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--success)" }}>
                  ₹{order.totalAmount}
                </div>
              </div>
            </div>

            {/* Razorpay Gateway Action Button */}
            <div style={{ marginBottom: "24px" }}>
              <button
                type="button"
                onClick={handleRazorpayPayment}
                className="btn btn-primary"
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  borderRadius: "12px",
                  boxShadow: "0 8px 20px rgba(49, 94, 251, 0.28)"
                }}
                disabled={rzpLoading || processing}
              >
                {rzpLoading ? (
                  <>Initializing Gateway...</>
                ) : (
                  <>
                    <Zap size={18} /> Pay ₹{order.totalAmount} with Razorpay
                  </>
                )}
              </button>
              
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px", color: "var(--text-secondary)", fontSize: "0.8rem", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Smartphone size={14} /> UPI (GPay, PhonePe, Paytm)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <CreditCard size={14} /> Cards & RuPay
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Building2 size={14} /> NetBanking
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{
              display: "flex",
              alignItems: "center",
              margin: "24px 0",
              color: "var(--text-secondary)",
              fontSize: "0.82rem"
            }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
              <span style={{ padding: "0 12px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                OR Instant Sandbox Test
              </span>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
            </div>

            {/* Simulated Payment Fallback Card */}
            <div style={{
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
              background: "var(--surface)",
              marginBottom: "16px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Select Simulation Mode
                </span>
                <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>Developer Mode</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                {["UPI", "Card", "NetBanking", "CashOnDelivery"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: paymentMethod === m ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: paymentMethod === m ? "rgba(49, 94, 251, 0.08)" : "var(--background)",
                      color: paymentMethod === m ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCompleteSimulation}
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "0.92rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
                disabled={processing || rzpLoading}
              >
                <CheckCircle2 size={16} />
                {processing ? "Simulating Payment..." : "Instant Payment Simulation (Demo)"}
              </button>
            </div>

            {/* Cancel Order */}
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={handleCancelToCart}
                className="btn btn-ghost"
                style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}
                disabled={processing || rzpLoading}
              >
                Cancel and return to Cart
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

export default Payment;
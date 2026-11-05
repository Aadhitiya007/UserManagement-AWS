const crypto = require("crypto");

class RazorpayService {
  _getCredentials() {
    const keyId = (process.env.RAZORPAY_KEY_ID || "").trim().replace(/^["']|["']$/g, "");
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim().replace(/^["']|["']$/g, "");
    return { keyId, keySecret };
  }

  _getAuthHeader() {
    const { keyId, keySecret } = this._getCredentials();
    if (!keyId || !keySecret) return null;
    return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  }

  /**
   * Create Razorpay Order
   */
  async createOrder({ order, customerEmail, customerPhone }) {
    const { keyId, keySecret } = this._getCredentials();
    const amountInPaise = Math.round(order.totalAmount * 100);

    // Fallback mock in unit test mode
    if (process.env.NODE_ENV === "test") {
      return {
        id: `order_rzp_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        amount: amountInPaise,
        currency: "INR",
        receipt: order._id || order.id,
        keyId: keyId || "rzp_test_mock_key_id"
      };
    }

    if (!keyId || !keySecret) {
      throw new Error(
        "Razorpay credentials are not configured on the server. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Lambda."
      );
    }

    const auth = this._getAuthHeader();
    const payload = {
      amount: amountInPaise,
      currency: "INR",
      receipt: String(order._id || order.id),
      notes: {
        orderId: String(order._id || order.id),
        email: customerEmail || order.userEmail || "",
        phone: customerPhone || ""
      }
    };

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const desc = (data.error && data.error.description) || "Failed to create Razorpay order";
      if (res.status === 401 || desc.toLowerCase().includes("auth")) {
        throw new Error(
          "Razorpay Authentication Failed: The RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in your Lambda environment variables is incorrect or inactive. Please verify them in your Razorpay Dashboard."
        );
      }
      throw new Error(desc);
    }

    return {
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      receipt: data.receipt,
      keyId
    };
  }

  /**
   * Cryptographically verify payment signature returned by Razorpay Checkout
   */
  verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return false;
    }

    // Offline mock test bypass
    if (process.env.NODE_ENV === "test" && razorpay_signature === "mock_valid_signature") {
      return true;
    }

    const { keySecret } = this._getCredentials();
    if (!keySecret) {
      throw new Error("RAZORPAY_KEY_SECRET is not configured on the server.");
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    return expectedSignature === razorpay_signature;
  }
}

module.exports = new RazorpayService();

/**
 * Computes official tax invoice HTML for an order snapshot.
 * Reusable across the browser invoice endpoint and email delivery.
 */
function generateInvoiceHtml(order, options = {}) {
  const isEmail = options.isEmail || false;
  const items = order.products || [];
  const orderId = order.orderId || order._id || "ORDER";
  const invoiceNumber = `INV-${orderId.slice(-8).toUpperCase()}`;
  const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  const subtotal = order.originalSubtotal || order.totalAmount || 0;
  const prodDiscount = order.productDiscountTotal || 0;
  const couponDisc = order.couponDiscount || 0;
  const delivery = order.deliveryFee || 0;
  const total = order.totalAmount || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; margin: 0; padding: 30px; background: #f8fafc; }
    .invoice-card { max-width: 780px; margin: 0 auto; background: #fff; padding: 36px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 18px; margin-bottom: 24px; }
    .company-title { font-size: 24px; font-weight: 800; color: #2563eb; margin: 0; letter-spacing: -0.02em; }
    .invoice-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; text-align: right; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; }
    .meta-box h4 { margin: 0 0 6px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #cbd5e1; color: #475569; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .totals { width: 320px; margin-left: auto; font-size: 13px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
    .totals-grand { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; font-weight: 800; color: #2563eb; border-top: 2px solid #0f172a; margin-top: 8px; }
    .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 18px; line-height: 1.5; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { box-shadow: none; border: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    ${
      !isEmail
        ? `<div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <a href="javascript:history.back()" style="color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 600;">← Back to Orders</a>
      <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">🖨️ Print / Save as PDF</button>
    </div>`
        : ""
    }

    <div class="header">
      <div>
        <h1 class="company-title">SHOPIEE</h1>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Official Tax Invoice & Delivery Receipt</p>
      </div>
      <div>
        <div class="invoice-title">TAX INVOICE</div>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 12px; text-align: right;">${invoiceNumber}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Billed & Shipped To:</h4>
        <strong>${order.userName || "Valued Customer"}</strong><br>
        Email: ${order.userEmail || "customer@example.com"}<br>
        Customer ID: ${order.userId}
      </div>
      <div class="meta-box" style="text-align: right;">
        <h4>Order & Payment Details:</h4>
        <strong>Order Date:</strong> ${invoiceDate}<br>
        <strong>Order Status:</strong> ${order.status}<br>
        <strong>Payment Status:</strong> <span style="color: ${order.paymentStatus === 'Paid' ? '#16a34a' : '#d97706'}; font-weight: bold;">${order.paymentStatus || 'Pending'}</span><br>
        <strong>Payment Method:</strong> ${order.paymentMethod || order.paymentDetails?.method || "Online"}<br>
        ${
          order.paymentDetails?.razorpayPaymentId || order.paymentDetails?.transactionId
            ? `<strong>Payment ID:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${order.paymentDetails.razorpayPaymentId || order.paymentDetails.transactionId}</code><br>`
            : ""
        }
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item Description</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${it.name || it.productName || "Product"}</strong></td>
            <td style="text-align: right;">₹${Number(it.price || 0).toLocaleString("en-IN")}</td>
            <td style="text-align: center;">${it.quantity}</td>
            <td style="text-align: right;">₹${(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString("en-IN")}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Items Subtotal:</span>
        <span>₹${Number(subtotal).toLocaleString("en-IN")}</span>
      </div>
      ${
        prodDiscount > 0
          ? `
      <div class="totals-row" style="color: #16a34a;">
        <span>Product Savings:</span>
        <span>- ₹${Number(prodDiscount).toLocaleString("en-IN")}</span>
      </div>`
          : ""
      }
      ${
        couponDisc > 0
          ? `
      <div class="totals-row" style="color: #16a34a;">
        <span>Coupon Discount (${order.couponCode || "PROMO"}):</span>
        <span>- ₹${Number(couponDisc).toLocaleString("en-IN")}</span>
      </div>`
          : ""
      }
      <div class="totals-row">
        <span>Estimated Delivery:</span>
        <span>${delivery === 0 ? "FREE" : "₹" + Number(delivery).toLocaleString("en-IN")}</span>
      </div>
      <div class="totals-grand">
        <span>Total Paid:</span>
        <span>₹${Number(total).toLocaleString("en-IN")}</span>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for shopping with Shopiee! This is an authentic computer-generated tax invoice.</p>
      <p>Order ID: ${orderId} | Verified Cloud Transaction</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  generateInvoiceHtml
};


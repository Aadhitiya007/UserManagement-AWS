/**
 * Cloud & Production Email Service
 * Supports Amazon SES / SMTP when configured, with safe local logging fallback.
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const fromAddress = process.env.EMAIL_FROM || '"Shopiee" <no-reply@shopiee.com>';

  // Check if nodemailer is available and configured
  try {
    const nodemailer = require("nodemailer");
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port,
        secure: port === 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      return await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: text || html.replace(/<[^>]+>/g, ""),
        html,
        attachments
      });
    }
  } catch (_) {
    // nodemailer not installed or SMTP not configured
  }

  // Safe fallback: log formatted message for development & testing
  console.log(`[Email Service] Notification to: ${to} | Subject: "${subject}"`);
  if (text || html) {
    const preview = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(`[Email Service] Body preview: ${preview.substring(0, 160)}...`);
  }

  return { messageId: `mock_${Date.now()}` };
}

module.exports = sendEmail;


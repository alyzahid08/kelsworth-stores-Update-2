const nodemailer = require("nodemailer");

// Email is optional: if SMTP isn't configured yet, we skip sending instead
// of breaking checkout. This lets the store work immediately and have email
// turned on later without any code changes — just add the env vars.
function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

function formatPKR(amount) {
  return "Rs. " + Number(amount).toLocaleString("en-PK");
}

function orderEmailHTML(order, items) {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #dcd7c9">${i.product_name} (Size ${i.size}) × ${i.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #dcd7c9;text-align:right">${formatPKR(i.unit_price * i.qty)}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14141a">
    <h2 style="letter-spacing:0.02em">KELSWORTH</h2>
    <p>Hi ${order.first_name}, thanks for your order — here's your confirmation.</p>
    <p style="font-family:monospace;background:#f6f4ee;padding:10px 14px;display:inline-block">Order #${order.order_number}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      ${rows}
      <tr><td style="padding:8px 0">Subtotal</td><td style="text-align:right">${formatPKR(order.subtotal)}</td></tr>
      <tr><td style="padding:8px 0">Shipping</td><td style="text-align:right">${order.shipping === 0 ? "Free" : formatPKR(order.shipping)}</td></tr>
      ${order.discount > 0 ? `<tr><td style="padding:8px 0">Discount</td><td style="text-align:right">-${formatPKR(order.discount)}</td></tr>` : ""}
      <tr><td style="padding:10px 0;font-weight:bold;border-top:2px dashed #14141a">Total</td><td style="text-align:right;font-weight:bold;border-top:2px dashed #14141a">${formatPKR(order.total)}</td></tr>
    </table>
    <p style="margin-top:20px">Shipping to:<br>${order.address}, ${order.city} ${order.postal_code || ""}</p>
    <p>Payment: Cash on Delivery — pay the rider when your order arrives.</p>
    <p style="margin-top:24px;color:#4d4d49;font-size:13px">You can check your order status any time at our order tracking page using this order number and the email it was placed with.</p>
  </div>`;
}

async function sendOrderConfirmation(order, items) {
  if (!isEmailConfigured()) {
    console.log(`[email] SMTP not configured — skipped confirmation email for order ${order.order_number}`);
    return;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || `Kelsworth <${process.env.SMTP_USER}>`,
      to: order.email,
      subject: `Your Kelsworth order ${order.order_number} is confirmed`,
      html: orderEmailHTML(order, items),
    });
  } catch (err) {
    // Never let an email failure fail the order itself — just log it.
    console.error(`[email] Failed to send confirmation for order ${order.order_number}:`, err.message);
  }
}

module.exports = { sendOrderConfirmation, isEmailConfigured };

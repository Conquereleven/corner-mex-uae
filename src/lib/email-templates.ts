const PRIMARY = "#c2410c"; // brand orange-ish
const SITE = "Corner Mex";

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5f1;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f1;padding:24px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4">
        <tr><td style="background:${PRIMARY};padding:18px 24px;color:#fff;font-size:18px;font-weight:bold">${SITE}</td></tr>
        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 12px;font-size:22px">${title}</h1>
          ${body}
          ${cta ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="background:${PRIMARY};color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">${cta.label}</a></p>` : ""}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #e7e5e4;color:#78716c;font-size:12px">© ${new Date().getFullYear()} ${SITE} · UAE</td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

function itemsTable(items: { name: string; qty: number; total: number }[]) {
  const rows = items.map((i) => `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f5f5f4">${i.name} <span style="color:#78716c">× ${i.qty}</span></td>
    <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;font-variant-numeric:tabular-nums">${i.total.toFixed(2)} AED</td>
  </tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-top:8px">${rows}</table>`;
}

export type OrderEmailContext = {
  orderNumber: string;
  total: number;
  items: { name: string; qty: number; total: number }[];
  publicOrigin: string;
  orderId: string;
};

export function tplOrderPlaced(ctx: OrderEmailContext) {
  return {
    subject: `Order ${ctx.orderNumber} received · ${SITE}`,
    html: layout(
      "Thanks for your order!",
      `<p style="margin:0;color:#44403c">We've received order <strong>${ctx.orderNumber}</strong>. We'll notify you when it ships.</p>
       ${itemsTable(ctx.items)}
       <p style="margin:16px 0 0;font-weight:bold">Total: ${ctx.total.toFixed(2)} AED</p>`,
      { label: "View order", url: `${ctx.publicOrigin}/account` },
    ),
  };
}

export function tplOrderShipped(ctx: OrderEmailContext & { carrier: string; tracking: string | null; trackingUrl: string | null; sla?: string | null }) {
  return {
    subject: `Your order ${ctx.orderNumber} has shipped`,
    html: layout(
      "Your order is on the way 🚚",
      `<p style="margin:0;color:#44403c">Order <strong>${ctx.orderNumber}</strong> shipped via <strong>${ctx.carrier}</strong>.</p>
       ${ctx.tracking ? `<p style="margin:8px 0">Tracking: <strong>${ctx.tracking}</strong></p>` : ""}
       ${ctx.sla ? `<p style="margin:0;color:#78716c">Estimated arrival: ${ctx.sla}</p>` : ""}`,
      ctx.trackingUrl ? { label: "Track shipment", url: ctx.trackingUrl } : { label: "View order", url: `${ctx.publicOrigin}/account` },
    ),
  };
}

export function tplOrderDelivered(ctx: OrderEmailContext) {
  return {
    subject: `Order ${ctx.orderNumber} delivered`,
    html: layout(
      "Delivered ✅",
      `<p style="margin:0;color:#44403c">Your order <strong>${ctx.orderNumber}</strong> has been marked as delivered. ¡Buen provecho!</p>`,
      { label: "Leave feedback", url: `${ctx.publicOrigin}/account` },
    ),
  };
}

export const CARRIER_TRACKING_URLS: Record<string, (t: string) => string> = {
  aramex: (t) => `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(t)}`,
  dhl: (t) => `https://www.dhl.com/ae-en/home/tracking.html?tracking-id=${encodeURIComponent(t)}`,
  fedex: (t) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`,
  talabat: (t) => `https://www.talabat.com/uae/orders/${encodeURIComponent(t)}`,
  local_courier: () => "",
  pickup: () => "",
  other: () => "",
};

export function buildTrackingUrl(carrier: string, tracking: string | null) {
  if (!tracking) return null;
  const fn = CARRIER_TRACKING_URLS[carrier];
  return fn ? fn(tracking) || null : null;
}
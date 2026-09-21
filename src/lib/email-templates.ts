import { CORNERMEX_PALETTE } from "@/config/brand-tokens";

/*
 * Email clients do not support custom properties, so these are literal hex —
 * but they are read from the brand token module rather than typed in, so a
 * palette change reaches the inbox too. The header band and the CTA both use
 * black on Sunset Orange, because white on it measures 2.89:1.
 */
const PRIMARY = CORNERMEX_PALETTE.sunsetOrange.hex;
const ON_PRIMARY = CORNERMEX_PALETTE.black.hex;
const PAGE = CORNERMEX_PALETTE.warmIvory.hex;
const SURFACE = "#FFFFFF";
const BORDER = CORNERMEX_PALETTE.softBorder.hex;
const INK = CORNERMEX_PALETTE.black.hex;
const MUTED = CORNERMEX_PALETTE.mutedInk.hex;
const SITE = "CornerMex";

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${PAGE};font-family:Arial,Helvetica,sans-serif;color:${INK}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:24px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:${SURFACE};border-radius:12px;overflow:hidden;border:1px solid ${BORDER}">
        <tr><td style="background:${PRIMARY};padding:18px 24px;color:${ON_PRIMARY};font-size:18px;font-weight:bold">${SITE}</td></tr>
        <tr><td style="padding:28px 24px">
          <h1 style="margin:0 0 12px;font-size:22px">${title}</h1>
          ${body}
          ${cta ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="background:${PRIMARY};color:${ON_PRIMARY};padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">${cta.label}</a></p>` : ""}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid ${BORDER};color:${MUTED};font-size:12px">© ${new Date().getFullYear()} ${SITE} · UAE</td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

function itemsTable(items: { name: string; qty: number; total: number }[]) {
  const rows = items
    .map(
      (i) => `<tr>
    <td style="padding:8px 0;border-bottom:1px solid ${BORDER}">${i.name} <span style="color:${MUTED}">× ${i.qty}</span></td>
    <td style="padding:8px 0;border-bottom:1px solid ${BORDER};text-align:right;font-variant-numeric:tabular-nums">${i.total.toFixed(2)} AED</td>
  </tr>`,
    )
    .join("");
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
      `<p style="margin:0;color:${INK}">We've received order <strong>${ctx.orderNumber}</strong>. We'll notify you when it ships.</p>
       ${itemsTable(ctx.items)}
       <p style="margin:16px 0 0;font-weight:bold">Total: ${ctx.total.toFixed(2)} AED</p>`,
      { label: "View order", url: `${ctx.publicOrigin}/account` },
    ),
  };
}

export function tplOrderShipped(
  ctx: OrderEmailContext & {
    carrier: string;
    tracking: string | null;
    trackingUrl: string | null;
    sla?: string | null;
  },
) {
  return {
    subject: `Your order ${ctx.orderNumber} has shipped`,
    html: layout(
      "Your order is on the way 🚚",
      `<p style="margin:0;color:${INK}">Order <strong>${ctx.orderNumber}</strong> shipped via <strong>${ctx.carrier}</strong>.</p>
       ${ctx.tracking ? `<p style="margin:8px 0">Tracking: <strong>${ctx.tracking}</strong></p>` : ""}
       ${ctx.sla ? `<p style="margin:0;color:${MUTED}">Estimated arrival: ${ctx.sla}</p>` : ""}`,
      ctx.trackingUrl
        ? { label: "Track shipment", url: ctx.trackingUrl }
        : { label: "View order", url: `${ctx.publicOrigin}/account` },
    ),
  };
}

export function tplOrderDelivered(ctx: OrderEmailContext) {
  return {
    subject: `Order ${ctx.orderNumber} delivered`,
    html: layout(
      "Delivered ✅",
      `<p style="margin:0;color:${INK}">Your order <strong>${ctx.orderNumber}</strong> has been marked as delivered. ¡Buen provecho!</p>`,
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

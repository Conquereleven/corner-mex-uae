import { trackCatalogEvent, type CatalogEventType } from "@/lib/catalog-events.functions";

const SID_KEY = "cmx-sid";
const SENT_KEY = "cmx-evt-sent";

function getSessionHash(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let v = window.localStorage.getItem(SID_KEY);
    if (!v) {
      v = (crypto && "randomUUID" in crypto) ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(SID_KEY, v);
    }
    return v;
  } catch { return undefined; }
}

// Per-session dedupe of high-volume events (impressions). Stored in sessionStorage so
// it resets per tab session but spans navigations.
function alreadySent(eventType: CatalogEventType, productId?: string): boolean {
  if (typeof window === "undefined") return true;
  if (eventType !== "card_impression") return false;
  try {
    const raw = window.sessionStorage.getItem(SENT_KEY);
    const set: Record<string, 1> = raw ? JSON.parse(raw) : {};
    const key = `${eventType}:${productId ?? "_"}`;
    if (set[key]) return true;
    set[key] = 1;
    window.sessionStorage.setItem(SENT_KEY, JSON.stringify(set));
    return false;
  } catch { return false; }
}

export function trackEvent(
  eventType: CatalogEventType,
  payload: { productId?: string; source?: string; metadata?: Record<string, unknown> } = {},
) {
  if (typeof window === "undefined") return;
  if (alreadySent(eventType, payload.productId)) return;
  const sessionHash = getSessionHash();
  // Fire and forget — never block UI on analytics.
  Promise.resolve()
    .then(() =>
      trackCatalogEvent({
        data: {
          eventType,
          productId: payload.productId,
          source: payload.source,
          metadata: payload.metadata,
          sessionHash,
        },
      }),
    )
    .catch(() => {});
}
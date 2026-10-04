// Public base URL.
//
// The Mexico domain is not decided yet, so nothing here names a host. In the
// browser the origin is the page's own. On the server it is
// CORNERMEX_PUBLIC_APPLICATION_URL, which a production deployment must set:
// without it, server-rendered canonical, Open Graph and email links have no
// trustworthy host to point at.
//
// There is deliberately no hard-coded Railway (or any other) fallback host. A
// customer-facing link must never be built from an infrastructure URL.

/** Used only when no origin is configured, e.g. local tooling and tests. */
const UNCONFIGURED_ORIGIN = "http://localhost:3000";

function configuredOrigin(): string | undefined {
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  if (typeof process === "undefined") return undefined;
  return process.env.CORNERMEX_PUBLIC_APPLICATION_URL;
}

/** True when a real public origin is available for customer-facing links. */
export function isSiteOriginConfigured(): boolean {
  const candidate = configuredOrigin()?.trim();
  if (!candidate) return false;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function siteOrigin(): string {
  const candidate = configuredOrigin()?.trim();
  if (!candidate) return UNCONFIGURED_ORIGIN;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return UNCONFIGURED_ORIGIN;
    return url.origin;
  } catch {
    return UNCONFIGURED_ORIGIN;
  }
}

export function siteUrl(path = "/"): string {
  return new URL(path, `${siteOrigin()}/`).toString();
}

const VERIFIED_PUBLIC_ORIGIN = "https://corner-mex-uae-production.up.railway.app";

function configuredOrigin(): string | undefined {
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  if (typeof process === "undefined") return undefined;
  return process.env.CORNERMEX_PUBLIC_APPLICATION_URL;
}

export function siteOrigin(): string {
  const candidate = configuredOrigin()?.trim();
  if (!candidate) return VERIFIED_PUBLIC_ORIGIN;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return VERIFIED_PUBLIC_ORIGIN;
    return url.origin;
  } catch {
    return VERIFIED_PUBLIC_ORIGIN;
  }
}

export function siteUrl(path = "/"): string {
  return new URL(path, `${siteOrigin()}/`).toString();
}

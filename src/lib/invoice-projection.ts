export type InvoiceProjection = {
  reference: string;
  number: string | null;
  status: string | null;
  issuedDate: string | null;
  url: string | null;
  pdfSupported: boolean;
};
/** Only an explicit provider-owned HTTPS host is eligible. No token-shaped URLs. */
export function safeInvoiceUrl(value: unknown, allowedHosts: readonly string[]): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      !allowedHosts.includes(url.hostname) ||
      /(?:access[_-]?token|oauth|refresh[_-]?token|authorization)/i.test(url.search)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function sanitizeInvoice(raw: InvoiceProjection | null, hosts: readonly string[]) {
  if (!raw) return null;
  return {
    reference: raw.reference,
    number: raw.number,
    status: raw.status,
    issuedDate:
      raw.issuedDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.issuedDate) ? raw.issuedDate : null,
    url: safeInvoiceUrl(raw.url, hosts),
    pdfSupported: raw.pdfSupported === true,
  };
}

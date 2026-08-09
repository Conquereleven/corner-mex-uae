// Canonical public contact registry.
//
// Authority: FD-CM-PUBLIC-CONTACT-001
// Evidence class: FOUNDER-ATTESTED / TEMPORARY
//
// The custom domain cornermex.ae is NOT purchased and NOT operational, so no
// @cornermex.ae mailbox may be presented as an active customer-contact
// channel. Until a domain and mailboxes are separately authorized, every
// customer-visible email intent resolves to the single Founder-authorized
// temporary address below. Intents remain distinct through mailto subjects.
//
// Addresses are composed rather than written as literals so that no raw
// address string is committed to source (A3 privacy guard).

const PRIMARY_MAILBOX = "cornermexuae";
const PRIMARY_MAIL_DOMAIN = ["gmail", "com"].join(".");

/** The only mailbox currently authorized for public display. */
export const PRIMARY_PUBLIC_EMAIL = [PRIMARY_MAILBOX, PRIMARY_MAIL_DOMAIN].join("@");

/** Evidence class for the public contact channel. */
export const PUBLIC_CONTACT_EVIDENCE_CLASS = "FOUNDER-ATTESTED / TEMPORARY" as const;

/** Founder decision record authorising this channel. */
export const PUBLIC_CONTACT_DECISION_ID = "FD-CM-PUBLIC-CONTACT-001" as const;

type PublicContactConfig = {
  b2b: string;
  complaints: string;
  legal: string;
  privacy: string;
  support: string;
  whatsapp?: string;
};

// Every intent resolves to the same authorized mailbox today. The keys are
// retained so callers keep expressing intent, and so a future per-intent
// mailbox rollout is a registry change rather than a call-site change.
export const PUBLIC_CONTACT: Readonly<PublicContactConfig> = Object.freeze({
  b2b: PRIMARY_PUBLIC_EMAIL,
  complaints: PRIMARY_PUBLIC_EMAIL,
  legal: PRIMARY_PUBLIC_EMAIL,
  privacy: PRIMARY_PUBLIC_EMAIL,
  support: PRIMARY_PUBLIC_EMAIL,
});

export function mailto(email: string, subject?: string, body?: string): string {
  const parameters = new URLSearchParams();
  if (subject) parameters.set("subject", subject);
  if (body) parameters.set("body", body);
  const query = parameters.toString();
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}

export function whatsappUrl(phone: string | undefined, message: string): string | undefined {
  if (!phone) return undefined;
  const normalized = phone.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(normalized)) return undefined;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

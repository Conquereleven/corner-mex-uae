const PUBLIC_MAIL_DOMAIN = ["cornermex", "ae"].join(".");

function address(mailbox: string): string {
  return [mailbox, PUBLIC_MAIL_DOMAIN].join("@");
}

type PublicContactConfig = {
  b2b: string;
  complaints: string;
  legal: string;
  privacy: string;
  whatsapp?: string;
};

export const PUBLIC_CONTACT: Readonly<PublicContactConfig> = Object.freeze({
  b2b: address("b2b"),
  complaints: address("complaints"),
  legal: address("legal"),
  privacy: address("privacy"),
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

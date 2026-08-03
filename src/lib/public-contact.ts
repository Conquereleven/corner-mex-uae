const PUBLIC_MAIL_DOMAIN = ["cornermex", "ae"].join(".");

function address(mailbox: string): string {
  return [mailbox, PUBLIC_MAIL_DOMAIN].join("@");
}

export const PUBLIC_CONTACT = Object.freeze({
  b2b: address("b2b"),
  complaints: address("complaints"),
  legal: address("legal"),
  privacy: address("privacy"),
});

export function mailto(email: string, subject?: string): string {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}

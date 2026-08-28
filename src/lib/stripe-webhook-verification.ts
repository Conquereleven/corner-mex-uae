/** Minimal injectable seam around Stripe's raw-body signature verifier. */
export function verifyStripeWebhookEvent<T>(input: {
  rawBody: string;
  signature: string | null;
  webhookSecret: string | undefined;
  constructEvent: (rawBody: string, signature: string, webhookSecret: string) => T;
}): { ok: true; event: T } | { ok: false } {
  if (!input.signature || !input.webhookSecret) return { ok: false };
  try {
    return {
      ok: true,
      event: input.constructEvent(input.rawBody, input.signature, input.webhookSecret),
    };
  } catch {
    return { ok: false };
  }
}

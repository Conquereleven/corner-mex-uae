import { z } from "zod";

export const PAYMENT_PROVIDER_UNAVAILABLE = "PAYMENT_PROVIDER_UNAVAILABLE";

export class PaymentProviderUnavailableError extends Error {
  constructor() {
    super(PAYMENT_PROVIDER_UNAVAILABLE);
  }
}

const providerConfig = z.object({
  CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED: z.literal("true"),
  CORNERMEX_CHECKOUT_ENABLED: z.literal("true"),
  CORNERMEX_PUBLIC_APPLICATION_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().min(1),
});

export function readStripeCheckoutProviderConfig(source = process.env) {
  const parsed = providerConfig.safeParse(source);
  if (!parsed.success) throw new PaymentProviderUnavailableError();
  return {
    applicationUrl: parsed.data.CORNERMEX_PUBLIC_APPLICATION_URL.replace(/\/$/, ""),
    secretKey: parsed.data.STRIPE_SECRET_KEY,
  };
}

export async function createStripeClient(source = process.env) {
  const config = readStripeCheckoutProviderConfig(source);
  const { default: Stripe } = await import("stripe");
  return { stripe: new Stripe(config.secretKey), applicationUrl: config.applicationUrl };
}

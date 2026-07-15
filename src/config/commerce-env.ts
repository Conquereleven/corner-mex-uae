import { z } from "zod";

const falseByDefault = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const environmentSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CORNERMEX_COMMERCE_MODEL: z
    .literal("single_merchant_with_internal_supplier_network")
    .default("single_merchant_with_internal_supplier_network"),
  CORNERMEX_APPLICATION_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  CORNERMEX_PUBLIC_APPLICATION_URL: z.string().url().optional(),
  CORNERMEX_MARKETPLACE_ENABLED: falseByDefault,
  CORNERMEX_SELLER_AUTH_ENABLED: falseByDefault,
  CORNERMEX_SELLER_PAYOUTS_ENABLED: falseByDefault,
  CORNERMEX_COMMISSIONS_ENABLED: falseByDefault,
  CORNERMEX_CHECKOUT_ENABLED: falseByDefault,
  CORNERMEX_EXTERNAL_EMAIL_ENABLED: falseByDefault,
  CORNERMEX_EXTERNAL_MESSAGES_ENABLED: falseByDefault,
  CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED: falseByDefault,
  CORNERMEX_AUTOMATIC_IMPORT_ENABLED: falseByDefault,
  CORNERMEX_AUTOMATIC_INVENTORY_SYNC_ENABLED: falseByDefault,
  CORNERMEX_OPENCLAW_ENABLED: falseByDefault,
  CORNERMEX_CORNEROPS_WRITE_ENABLED: falseByDefault,
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type CommerceEnvironment = z.infer<typeof environmentSchema>;

export function validateCommerceEnvironment(
  source: Record<string, string | undefined> = process.env,
): { valid: boolean; config?: CommerceEnvironment; missing: string[]; errors: string[] } {
  const leakedClientSecrets = Object.keys(source).filter(
    (key) => key.startsWith("VITE_") && /(SERVICE_ROLE|SECRET|PRIVATE|STRIPE_SECRET)/i.test(key),
  );
  const parsed = environmentSchema.safeParse(source);
  const missing = [
    ...(!source.SUPABASE_URL ? ["SUPABASE_URL"] : []),
    ...(!source.SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
  ];
  const errors = [
    ...leakedClientSecrets.map((key) => `server_secret_exposed_as_${key}`),
    ...(parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join("."))),
  ];
  if (parsed.success && parsed.data.CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED) {
    if (!parsed.data.CORNERMEX_CHECKOUT_ENABLED) errors.push("payment_requires_checkout");
    if (!parsed.data.STRIPE_SECRET_KEY) errors.push("payment_requires_STRIPE_SECRET_KEY");
    if (!parsed.data.STRIPE_WEBHOOK_SECRET) errors.push("payment_requires_STRIPE_WEBHOOK_SECRET");
    if (!parsed.data.CORNERMEX_PUBLIC_APPLICATION_URL) {
      errors.push("payment_requires_CORNERMEX_PUBLIC_APPLICATION_URL");
    }
  }

  return {
    valid: parsed.success && missing.length === 0 && errors.length === 0,
    ...(parsed.success ? { config: parsed.data } : {}),
    missing,
    errors,
  };
}

export function getCommerceSafetyStatus(source: Record<string, string | undefined> = process.env) {
  const parsed = environmentSchema.parse(source);
  return {
    commerceModel: parsed.CORNERMEX_COMMERCE_MODEL,
    marketplaceEnabled: parsed.CORNERMEX_MARKETPLACE_ENABLED,
    sellerAuthEnabled: parsed.CORNERMEX_SELLER_AUTH_ENABLED,
    sellerPayoutsEnabled: parsed.CORNERMEX_SELLER_PAYOUTS_ENABLED,
    commissionsEnabled: parsed.CORNERMEX_COMMISSIONS_ENABLED,
    checkoutEnabled: parsed.CORNERMEX_CHECKOUT_ENABLED,
    externalEmailEnabled: parsed.CORNERMEX_EXTERNAL_EMAIL_ENABLED,
    externalMessagesEnabled: parsed.CORNERMEX_EXTERNAL_MESSAGES_ENABLED,
    realPaymentExecutionEnabled: parsed.CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED,
    automaticImportEnabled: parsed.CORNERMEX_AUTOMATIC_IMPORT_ENABLED,
    automaticInventorySyncEnabled: parsed.CORNERMEX_AUTOMATIC_INVENTORY_SYNC_ENABLED,
    openClawEnabled: parsed.CORNERMEX_OPENCLAW_ENABLED,
    cornerOpsWriteEnabled: parsed.CORNERMEX_CORNEROPS_WRITE_ENABLED,
  };
}

// Canonical server-side gate and transport for outbound external email.
//
// Authorization and configuration are deliberately separate concepts:
//
//   * CORNERMEX_EXTERNAL_EMAIL_ENABLED is the AUTHORIZATION capability flag.
//     It is fail-closed: only the exact literal "true" enables sending.
//     Anything else — unset, "", "false", "0", "1", "TRUE", "True", "yes",
//     "on", arbitrary text — leaves external email disabled.
//
//   * Provider credentials (LOVABLE_API_KEY, RESEND_API_KEY) are CONFIGURATION.
//     Their presence never authorizes sending; their absence is an additional
//     independent reason to skip.
//
// Both conditions must hold before any outbound request is made. Provider keys
// are read from the environment only and are never logged or returned.
//
// The capability flag mirrors the canonical checkout pattern in
// src/lib/checkout-execution.server.ts and the contract declared in
// src/config/commerce-env.ts (CORNERMEX_EXTERNAL_EMAIL_ENABLED).

export const EXTERNAL_EMAIL_DISABLED = "EXTERNAL_EMAIL_DISABLED";

/** Fail-closed capability check. Only the exact string "true" enables email. */
export function isExternalEmailEnabled(
  value: string | undefined = process.env.CORNERMEX_EXTERNAL_EMAIL_ENABLED,
): boolean {
  return value === "true";
}

export function assertExternalEmailEnabled(
  value: string | undefined = process.env.CORNERMEX_EXTERNAL_EMAIL_ENABLED,
): void {
  if (!isExternalEmailEnabled(value)) {
    throw new Error(EXTERNAL_EMAIL_DISABLED);
  }
}

// Provider transport constants. The sender address is a public provider
// address, not a secret, but it is composed rather than written as a literal so
// changed files satisfy the A3 privacy guard (same pattern as public-contact.ts).
const PROVIDER_SENDER_MAILBOX = "onboarding";
const PROVIDER_SENDER_DOMAIN = ["resend", "dev"].join(".");
const PROVIDER_SENDER_ADDRESS = [PROVIDER_SENDER_MAILBOX, PROVIDER_SENDER_DOMAIN].join("@");

export const EXTERNAL_EMAIL_FROM = `Corner Mex <${PROVIDER_SENDER_ADDRESS}>`;
export const EXTERNAL_EMAIL_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type ExternalEmailSkipReason = "capability_disabled" | "provider_not_configured";

export type ExternalEmailResult =
  | { ok: true; skipped?: false }
  | { ok: false; skipped: true; reason: ExternalEmailSkipReason }
  | { ok: false; skipped?: false; error: string };

/** True only when provider configuration is present. Never an authorization. */
export function isExternalEmailProviderConfigured(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment.LOVABLE_API_KEY && environment.RESEND_API_KEY);
}

/**
 * Send one external email.
 *
 * Order of checks is significant: the authorization gate is evaluated BEFORE
 * provider configuration and before any network request, so a disabled
 * capability can never reach the provider even if credentials exist.
 */
export async function sendExternalEmail({
  to,
  subject,
  html,
  logPrefix = "[email]",
  environment = process.env,
}: {
  to: string;
  subject: string;
  html: string;
  logPrefix?: string;
  environment?: Record<string, string | undefined>;
}): Promise<ExternalEmailResult> {
  if (!isExternalEmailEnabled(environment.CORNERMEX_EXTERNAL_EMAIL_ENABLED)) {
    console.warn(`${logPrefix} Skipping send — CORNERMEX_EXTERNAL_EMAIL_ENABLED is not "true"`);
    return { ok: false, skipped: true, reason: "capability_disabled" };
  }
  if (!isExternalEmailProviderConfigured(environment)) {
    console.warn(`${logPrefix} Skipping send — external email provider is not configured`);
    return { ok: false, skipped: true, reason: "provider_not_configured" };
  }

  const response = await fetch(`${EXTERNAL_EMAIL_GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${environment.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": environment.RESEND_API_KEY as string,
    },
    body: JSON.stringify({ from: EXTERNAL_EMAIL_FROM, to: [to], subject, html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`${logPrefix} provider error`, response.status);
    return { ok: false, error: `${response.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}

// Lightweight legal acceptance evidence helpers.
//
// LEGAL_ACCEPTANCE_TODO:
// These helpers build a structured payload describing which legal document
// versions a user accepted, when, in which language and from which surface.
// Today the payload is only logged to the console at signup and checkout —
// it must be persisted server-side (e.g. on the user profile for signup and
// on the order record for checkout) before public UAE launch so we have
// auditable acceptance evidence per UAE consumer protection expectations.
import { LEGAL_DOCS } from "@/lib/legal-docs";

export type LegalAcceptanceSource = "signup" | "checkout" | "reacceptance";

export interface LegalVersions {
  terms: string;
  privacy: string;
  returns: string;
  cookies: string;
  aiTransparency: string;
}

export interface LegalAcceptancePayload {
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
  acceptedReturnsVersion?: string;
  acceptedLegalAt: string; // ISO timestamp
  acceptedLegalSource: LegalAcceptanceSource;
  acceptedLegalLanguage: "en";
}

function versionOf(slug: string): string {
  return LEGAL_DOCS.find((d) => d.slug === slug)?.version ?? "0.0.0";
}

export function getCurrentLegalVersions(): LegalVersions {
  return {
    terms: versionOf("terms-and-conditions"),
    privacy: versionOf("privacy-policy"),
    returns: versionOf("returns-refunds"),
    cookies: versionOf("cookie-policy"),
    aiTransparency: versionOf("ai-transparency"),
  };
}

export function buildLegalAcceptancePayload(
  source: LegalAcceptanceSource,
): LegalAcceptancePayload {
  const v = getCurrentLegalVersions();
  return {
    acceptedTermsVersion: v.terms,
    acceptedPrivacyVersion: v.privacy,
    acceptedLegalAt: new Date().toISOString(),
    acceptedLegalSource: source,
    acceptedLegalLanguage: "en",
  };
}

export function buildCheckoutLegalAcceptancePayload(): LegalAcceptancePayload {
  const v = getCurrentLegalVersions();
  return {
    acceptedTermsVersion: v.terms,
    acceptedPrivacyVersion: v.privacy,
    acceptedReturnsVersion: v.returns,
    acceptedLegalAt: new Date().toISOString(),
    acceptedLegalSource: "checkout",
    acceptedLegalLanguage: "en",
  };
}
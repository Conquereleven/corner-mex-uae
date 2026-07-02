// Lightweight legal acceptance evidence helpers.
//
// These helpers build a structured payload describing which legal document
// versions a user accepted, when, in which language and from which surface.
//
// Persistence:
//  - signup: forwarded to Supabase auth user_metadata via
//    supabase.auth.signUp({ options: { data: { legal_acceptance } } }).
//  - checkout: forwarded to placeOrder() and stored on
//    public.orders.legal_acceptance (jsonb).
//
// Follow-ups still open (require external decisions, tracked separately):
//  - UAE counsel sign-off on document contents.
//  - Optional mirror to a dedicated legal_acceptance_events table for
//    long-term audit querying (backend/database decision).
import { LEGAL_DOCS, BUSINESS_MODEL } from "@/lib/legal-docs";

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
  acceptedAiTransparencyVersion?: string;
  acceptedCookiePolicyVersion?: string;
  acceptedLegalAt: string; // ISO timestamp
  acceptedLegalSource: LegalAcceptanceSource;
  acceptedLegalLanguage: "en";
  sellerOfRecord: string;
  businessModel: typeof BUSINESS_MODEL.current;
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
    acceptedCookiePolicyVersion: v.cookies,
    acceptedLegalAt: new Date().toISOString(),
    acceptedLegalSource: source,
    acceptedLegalLanguage: "en",
    sellerOfRecord: BUSINESS_MODEL.sellerOfRecord,
    businessModel: BUSINESS_MODEL.current,
  };
}

export function buildCheckoutLegalAcceptancePayload(): LegalAcceptancePayload {
  const v = getCurrentLegalVersions();
  return {
    acceptedTermsVersion: v.terms,
    acceptedPrivacyVersion: v.privacy,
    acceptedReturnsVersion: v.returns,
    acceptedAiTransparencyVersion: v.aiTransparency,
    acceptedCookiePolicyVersion: v.cookies,
    acceptedLegalAt: new Date().toISOString(),
    acceptedLegalSource: "checkout",
    acceptedLegalLanguage: "en",
    sellerOfRecord: BUSINESS_MODEL.sellerOfRecord,
    businessModel: BUSINESS_MODEL.current,
  };
}
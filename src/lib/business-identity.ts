// Central registry of customer-visible business identity facts.
//
// Founder decision 2026-09-19 (docs/cornermex-2/LEGAL-IDENTITY.md):
//   CornerMex           = public ecommerce brand
//   RodMor TradeCo LLC  = seller / merchant of record
//   Intermex            = supplier only — never merchant, seller, invoice issuer
//                         or public brand for CornerMex customer orders.
//
// Evidence class: FOUNDER-ATTESTED (see
// docs/engineering-playbook/founder-decisions/FD-CM-BUSINESS-IDENTITY-001.md).
// These values are attested by the Founder as the authoritative business
// identity. They have NOT been independently verified against an external
// registry by any review agent, and no such verification is claimed.
//
// Fields whose real-world value the Founder has not confirmed for public
// display are typed as optional and left undefined — surfaces must render
// gracefully without them and must never substitute invented values.

import { ACTIVE_MARKET } from "../config/market.ts";

export type BusinessIdentity = {
  brandName: string;
  legalEntity: string;
  /** The entity customers buy from. Must equal legalEntity for CornerMex web orders. */
  merchantOfRecord: string;
  /** Founder-attested registered location wording used on public surfaces. */
  location: string;
  /** Founder-attested licensing authority. */
  licensingAuthority: string;
  tradeLicense: string;
  /**
   * Founder-attested beneficiary name for manual bank transfer.
   * Presence here does NOT enable bank transfer; activation remains gated by
   * configuration in payment-methods.ts.
   */
  bankAccountBeneficiary: string;
  /** Not yet confirmed for public display — do not fabricate. */
  phone?: string;
  /** Not yet confirmed for public display — do not fabricate. */
  streetAddress?: string;
  /** Not yet confirmed for public display — do not fabricate. */
  supportHours?: string;
  /** Not yet confirmed for public display — do not fabricate. */
  trn?: string;
};

/**
 * UAE identity (DEFERRED market). Founder-attested for the UAE operation and
 * retained for historical orders, the Zoho supplier guard and the retired UAE
 * modules. It is NOT the seller in Mexico and must not be shown on any active
 * surface — use marketSellerLine() / marketIdentityLine() below.
 */
export const BUSINESS_IDENTITY: Readonly<BusinessIdentity> = Object.freeze({
  brandName: "CornerMex",
  legalEntity: "RodMor TradeCo LLC",
  merchantOfRecord: "RodMor TradeCo LLC",
  location: "Sharjah Media City, Free Zone, UAE",
  licensingAuthority: "Sharjah Media City",
  tradeLicense: "2647014.01",
  bankAccountBeneficiary: "RodMor TradeCo LLC",
});

/** Evidence class for every value in BUSINESS_IDENTITY. */
export const BUSINESS_IDENTITY_EVIDENCE_CLASS = "FOUNDER-ATTESTED" as const;

/** Founder decision record that authorises these values. */
export const BUSINESS_IDENTITY_DECISION_ID = "FD-CM-BUSINESS-IDENTITY-001" as const;

/**
 * Legal entities that supply CornerMex. They may appear as suppliers, purchase
 * order counterparts or in historical records, but must never be presented as
 * the CornerMex merchant or used as the issuer of CornerMex customer invoices.
 * Identifiers are those already recorded in the repository
 * (docs/intermex-zoho-test-activation/observed-facts.json); none are invented.
 */
export const SUPPLIER_ENTITIES = Object.freeze([
  Object.freeze({
    name: "Intermex Pro General Trading LLC",
    role: "supplier" as const,
    zohoOrganizationId: "773588238",
    vatTrn: "100491647200003",
  }),
]);

/** "Sold by …" wording for any surface that names the seller. */
export function sellerOfRecordLine(): string {
  const b = BUSINESS_IDENTITY;
  return `Sold by ${b.merchantOfRecord}, trading as ${b.brandName}`;
}

export function businessIdentityLine(): string {
  const b = BUSINESS_IDENTITY;
  return `${b.brandName}, a trading brand of ${b.legalEntity} · ${b.location} · Trade license ${b.tradeLicense}`;
}

/**
 * "Vendido por …" for the ACTIVE market, or null while the seller entity for
 * that market has not been supplied. Callers render nothing for null; they must
 * never fall back to another market's entity.
 */
export function marketSellerLine(): string | null {
  const { sellerEntity } = ACTIVE_MARKET.legal;
  if (!sellerEntity) return null;
  return `Vendido por ${sellerEntity}, bajo la marca ${BUSINESS_IDENTITY.brandName}`;
}

/** The brand, plus the legal entity and tax id only when they are known. */
export function marketIdentityLine(): string {
  const { sellerEntity, taxId, taxIdLabel } = ACTIVE_MARKET.legal;
  if (!sellerEntity) return BUSINESS_IDENTITY.brandName;
  const tax = taxId && taxIdLabel ? ` · ${taxIdLabel} ${taxId}` : "";
  return `${BUSINESS_IDENTITY.brandName}, marca comercial de ${sellerEntity}${tax}`;
}

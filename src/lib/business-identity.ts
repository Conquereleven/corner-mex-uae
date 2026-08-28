// Central registry of customer-visible business identity facts.
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

export type BusinessIdentity = {
  brandName: string;
  legalEntity: string;
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

export const BUSINESS_IDENTITY: Readonly<BusinessIdentity> = Object.freeze({
  brandName: "Intermex",
  legalEntity: "RodMor TradeCo LLC",
  location: "Sharjah Media City, Free Zone, UAE",
  licensingAuthority: "Sharjah Media City",
  tradeLicense: "2647014.01",
  bankAccountBeneficiary: "RodMor TradeCo LLC",
});

/** Evidence class for every value in BUSINESS_IDENTITY. */
export const BUSINESS_IDENTITY_EVIDENCE_CLASS = "FOUNDER-ATTESTED" as const;

/** Founder decision record that authorises these values. */
export const BUSINESS_IDENTITY_DECISION_ID = "FD-CM-BUSINESS-IDENTITY-001" as const;

export function businessIdentityLine(): string {
  const b = BUSINESS_IDENTITY;
  return `${b.brandName}, a trading brand of ${b.legalEntity} · ${b.location} · Trade license ${b.tradeLicense}`;
}

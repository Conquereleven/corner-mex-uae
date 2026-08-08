// Central registry of customer-visible business identity facts.
// Every value here must be repository-verified truth. Fields whose real-world
// value has not been confirmed by the Founder are typed as optional and left
// undefined — surfaces must render gracefully without them and must never
// substitute invented values.

export type BusinessIdentity = {
  brandName: string;
  legalEntity: string;
  /** Verified registered location wording used in the public footer. */
  location: string;
  tradeLicense: string;
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
  brandName: "CornerMex",
  legalEntity: "RodMor TradeCo LLC",
  location: "Sharjah Media City, UAE",
  tradeLicense: "2647014.01",
});

export function businessIdentityLine(): string {
  const b = BUSINESS_IDENTITY;
  return `${b.brandName}, a trading brand of ${b.legalEntity} · ${b.location} · Trade license ${b.tradeLicense}`;
}

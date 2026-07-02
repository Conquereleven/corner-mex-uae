// Static legal document registry for CornerMex.
// These are working templates and MUST be reviewed by qualified UAE legal counsel
// before publication. Designed to be migrated to a CMS later without changing the
// rendering layer.

export type ReviewStatus = "Draft" | "Legal Review Required" | "Approved";

export interface LegalSection {
  id: string;
  heading: string;
  body: string[]; // paragraphs (plain text, rendered as <p>)
  list?: string[]; // optional bullet list rendered after body
}

export interface LegalDoc {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  version: string;
  lastUpdated: string; // ISO date
  owner: string;
  reviewStatus: ReviewStatus;
  language: "en";
  availableTranslations?: string[];
  futureTranslations?: string[];
  requiresArabicReview?: boolean;
  /**
   * Optional lifecycle flag. Documents marked as `phase-2-draft` describe
   * capabilities that are NOT active in the current first-party MVP and are
   * only kept for future planning (e.g. a future third-party marketplace).
   */
  lifecycle?: "active" | "phase-2-draft";
  sections: LegalSection[];
}

/**
 * Business model metadata for the current CornerMex operating model.
 * Referenced by the Legal Center, admin/legal and the checkout / signup
 * legal acceptance payload. Update here if the operating model changes.
 */
export const BUSINESS_MODEL = {
  current: "first_party_ecommerce" as const,
  futurePhase: "third_party_marketplace" as const,
  sellerOfRecord: "CornerMex",
  supplierModel:
    "CornerMex purchases products from suppliers (e.g. Intermex) and resells them directly to customers under the CornerMex brand.",
  marketplaceStatus: "Planned / Phase 2 / Not active for MVP",
  legalReviewStatus: "Legal Review Required" as ReviewStatus,
} as const;

const DISCLAIMER =
  "This document is a working template and must be reviewed by qualified UAE legal counsel before publication.";

const CONTACT_BLOCK: LegalSection = {
  id: "contact",
  heading: "Contact",
  body: [
    "For any question about this document, please reach out using the channels below. Company details will be completed once corporate registration is finalised.",
    "Complaints: we provide accessible channels to submit and follow up on complaints. Target initial response timeframe: [INSERT RESPONSE TIMEFRAME]. Escalation path after internal review: [INSERT UAE ESCALATION PROCESS AFTER LEGAL REVIEW].",
  ],
  list: [
    "Legal contact: legal@cornermex.ae",
    "Privacy contact: privacy@cornermex.ae",
    "Support contact: support@cornermex.ae",
    "Complaints contact: complaints@cornermex.ae",
    "Company legal name: [INSERT UAE LEGAL ENTITY NAME]",
    "Legal status: [INSERT LEGAL STATUS]",
    "Trade license number: [INSERT TRADE LICENSE NUMBER]",
    "Licensing authority: [INSERT LICENSING AUTHORITY]",
    "Registered address: [INSERT UAE REGISTERED ADDRESS]",
    "Website: [INSERT WEBSITE]",
    "Contact number: [INSERT CONTACT NUMBER]",
    "VAT registration: [INSERT VAT REGISTRATION STATUS IF APPLICABLE]",
    "TDRA / e-commerce approval: [INSERT IF APPLICABLE]",
  ],
};

const DISCLAIMER_SECTION: LegalSection = {
  id: "disclaimer",
  heading: "Legal disclaimer",
  body: [DISCLAIMER],
};

function doc(d: Omit<LegalDoc, "language" | "sections"> & { sections: LegalSection[] }): LegalDoc {
  return {
    language: "en",
    availableTranslations: [],
    futureTranslations: ["ar", "es"],
    requiresArabicReview: true,
    ...d,
    sections: [DISCLAIMER_SECTION, ...d.sections, CONTACT_BLOCK],
  };
}

export const LEGAL_DOCS: LegalDoc[] = [
  doc({
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    shortTitle: "Terms",
    summary:
      "The rules that govern your purchases from CornerMex as a first-party e-commerce retailer in the UAE, including orders, payments in AED, returns and UAE jurisdiction.",
    version: "1.1.0",
    lastUpdated: "2026-06-20",
    owner: "CornerMex Legal",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "identity", heading: "1. Who we are and our role", body: [
        "CornerMex is an online store operated in the United Arab Emirates. For the current MVP, CornerMex acts as the seller of record for products sold directly through the CornerMex website.",
        "CornerMex sources inventory from selected suppliers (including Intermex) and resells those products directly to customers under the CornerMex brand. Customers purchase directly from CornerMex, not from independent third-party sellers.",
        "If CornerMex later enables third-party sellers on the site, additional marketplace and seller terms will apply and will be published separately before activation.",
      ]},
      { id: "model", heading: "2. Operating model", body: [
        "Product availability depends on stock held or sourced by CornerMex and on supplier availability, import status, logistics and compliance checks.",
        "CornerMex may use third-party suppliers, logistics providers, payment processors, hosting providers, AI systems and support tools to operate the site and fulfil orders.",
      ]},
      { id: "buyer", heading: "3. Customer responsibilities", body: [
        "You must provide accurate account, delivery and contact information, use the platform lawfully, and respect sellers, couriers and support staff.",
        "You are responsible for any activity on your account.",
      ]},
      { id: "sourcing", heading: "4. Product sourcing and availability", body: [
        "CornerMex is responsible for ensuring products listed on the website are represented accurately to customers, subject to information provided by suppliers.",
        "Availability is subject to inventory and supplier availability. CornerMex may remove products where there are quality, safety, regulatory, import, labelling, shelf-life or recall concerns.",
        "See also the Supplier & Product Sourcing Policy.",
      ]},
      { id: "accounts", heading: "5. Account registration", body: [
        "An account is required to place orders. You must be at least 18 years old, or the age of legal capacity in your emirate of residence, to create one.",
        "We may suspend or close accounts that violate these Terms or our Acceptable Use Policy.",
      ]},
      { id: "listings", heading: "6. Product listings and pricing display", body: [
        "Listings include title, description, images, price in AED, available variants, applicable logistics fees and any digital payment fees, and shipping information. CornerMex does not warrant that listings are free of errors and may correct them at any time.",
      ]},
      { id: "pricing", heading: "7. Pricing, VAT and taxes", body: [
        "All prices are displayed in UAE Dirhams (AED). [INSERT VAT REGISTRATION STATUS AND TAX TREATMENT AFTER UAE TAX REVIEW]. Any applicable VAT will be reflected on the order confirmation and any tax invoice issued.",
      ]},
      { id: "orders", heading: "8. Orders and payments", body: [
        "An order is a customer offer to purchase. The contract of sale is formed only when CornerMex confirms acceptance of the order, typically upon successful payment capture.",
        "CornerMex may reject or cancel an order for reasons including stock issues, pricing errors, compliance issues, payment failure, suspected fraud, or logistics constraints.",
        "Payments are processed by regulated payment service providers. CornerMex does not store full card numbers.",
      ]},
      { id: "shipping", heading: "9. Shipping and logistics", body: [
        "Delivery windows depend on origin emirate, destination zone and the courier selected. Estimated delivery times are not guarantees. Risk of loss passes on delivery to the address you provided.",
      ]},
      { id: "returns", heading: "10. Returns, refunds and customer support", body: [
        "CornerMex is responsible for customer support, complaints, refund handling and the returns process for first-party orders placed on the CornerMex website. Details are set out in the separate Returns & Refunds Policy, which forms part of these Terms.",
      ]},
      { id: "availability", heading: "11. Product availability", body: [
        "If an item becomes unavailable after an order is placed, CornerMex will contact you to offer a replacement, partial fulfilment or refund.",
      ]},
      { id: "ai", heading: "12. AI-assisted features (CornerOps AI)", body: [
        "Parts of the site are assisted by CornerOps AI, including search, recommendations, customer support drafts, product content suggestions, admin decisions, fraud and risk checks, pricing suggestions and operations.",
        "AI does not replace human review for material customer-impacting decisions. AI outputs may contain errors and are not a substitute for professional advice. You may request human review (see the AI Transparency Notice).",
      ]},
      { id: "prohibited", heading: "13. Prohibited uses", body: [
        "Use of the platform is also subject to the Acceptable Use Policy. Violations may result in suspension, removal of content, or termination.",
      ]},
      { id: "ip", heading: "14. Intellectual property", body: [
        "The CornerMex name, logos, design system and content are protected. User submissions remain owned by their authors, who grant CornerMex a limited license to operate the site as set out in the IP Policy.",
      ]},
      { id: "liability", heading: "15. Limitation of liability", body: [
        "To the maximum extent permitted by UAE law, CornerMex's aggregate liability arising out of or related to your use of the platform is limited to the amount you paid for the order giving rise to the claim. CornerMex is not liable for indirect or consequential losses.",
        "Nothing in these Terms limits any liability that cannot be limited under UAE consumer protection law.",
      ]},
      { id: "disputes", heading: "16. Disputes and governing law", body: [
        "These Terms are governed by the laws of the United Arab Emirates and, where applicable, of the emirate of registration of CornerMex. Disputes are subject to the competent UAE courts.",
        "Nothing here requires you to waive rights under UAE consumer protection law or to submit low-value consumer claims to mandatory arbitration.",
        "Nothing in this section requires arbitration for a consumer digital contract below AED 50,000 where such a clause is not permitted under applicable UAE law.",
      ]},
      { id: "complaints", heading: "17. Complaints", body: [
        "We provide accessible channels to submit and follow up on complaints about the site, an order, content moderation or an AI-assisted decision.",
        "Write to complaints@cornermex.ae. Target initial response timeframe: [INSERT RESPONSE TIMEFRAME]. Where a complaint is not resolved internally, you may escalate via [INSERT UAE ESCALATION PROCESS AFTER LEGAL REVIEW], without prejudice to your rights under UAE consumer protection law.",
      ]},
      { id: "future-marketplace", heading: "18. Future marketplace features", body: [
        "CornerMex does not currently operate an open third-party seller marketplace. Any third-party marketplace features are not active and, if launched later, will be governed by separate seller terms, onboarding, KYC/KYB, compliance checks and UAE legal review.",
      ]},
      { id: "changes", heading: "19. Changes to these Terms", body: [
        "We may update these Terms. Material changes will be highlighted on the platform. Continued use after the effective date constitutes acceptance.",
      ]},
    ],
  }),

  doc({
    slug: "privacy-policy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    summary:
      "How CornerMex collects, uses, shares and protects your personal data, including AI-assisted processing and your rights as a data subject in the UAE.",
    version: "1.0.0",
    lastUpdated: "2026-06-19",
    owner: "CornerMex Privacy Office",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "controller", heading: "1. Data controller", body: [
        "The controller of personal data processed through CornerMex is [INSERT UAE LEGAL ENTITY NAME], operating from [INSERT UAE REGISTERED ADDRESS]. For the current MVP, CornerMex acts as the seller of record and processes customer data for its own first-party e-commerce orders. If a third-party marketplace is launched later, third-party sellers acting as independent controllers will be described in an updated Privacy Notice.",
      ]},
      { id: "data", heading: "2. Personal data we collect", list: [
        "Account data: name, email, phone, password hash, language preference.",
        "Order and payment-related data: order history, billing data, last-4 digits and brand of payment instrument (full card data is handled by our payment partners).",
        "Delivery data: address, recipient name, contact phone, delivery notes.",
        "Device and analytics data: IP address, device, browser, pages viewed, performance metrics, consented cookies.",
        "Business customer data (for B2B enquiries): business name, trade licence details where provided, contact details, order and quotation history.",
        "Support data: messages, attachments, satisfaction ratings.",
      ], body: []},
      { id: "ai", heading: "3. AI-assisted processing", body: [
        "We use CornerOps AI to assist with recommendations, search ranking, customer support drafting, content moderation, fraud and risk checks, pricing suggestions, supplier/product analysis and analytics. AI-assisted processing may include limited profiling to personalise your experience and to protect the site.",
        "Material decisions affecting you are reviewed by humans where required and you may request human review of an AI-assisted decision (see Section 8).",
      ]},
      { id: "purposes", heading: "4. Purposes of processing", list: [
        "Provide and operate the CornerMex online store and your account.",
        "Process orders, payments, deliveries, returns and refunds.",
        "Communicate about your orders and provide customer support.",
        "Prevent fraud, abuse and protect users, staff and suppliers.",
        "Improve and personalise the site, including via AI-assisted features.",
        "Comply with UAE legal, tax and regulatory obligations.",
      ], body: []},
      { id: "legal-bases", heading: "5. Legal bases", body: [
        "We process personal data on the bases of contract performance, our legitimate interests in operating a safe marketplace, compliance with legal obligations, and your consent where required (for example, marketing communications and non-essential cookies). You may withdraw consent at any time.",
      ]},
      { id: "sharing", heading: "6. Sharing", list: [
        "Suppliers (such as Intermex): limited to what is needed for sourcing, fulfilment, quality claims, recalls or legal compliance.",
        "Logistics partners: delivery contact and address.",
        "Payment service providers: data needed to authorise and reconcile payments.",
        "Hosting and infrastructure providers operating under contractual safeguards.",
        "Analytics providers under your cookie consent.",
        "AI providers used by CornerOps AI under contractual safeguards prohibiting use of your data to train third-party models without authorisation.",
        "Authorities when required by UAE law.",
        "If a third-party marketplace is launched later, seller-related data sharing will be described in updated Terms and Privacy notices.",
      ], body: []},
      { id: "transfers", heading: "7. International data transfers", body: [
        "Some of our processors operate outside the UAE. Where this is the case, we put in place contractual and technical safeguards consistent with UAE personal data protection requirements.",
      ]},
      { id: "retention", heading: "8. Data retention", body: [
        "We keep personal data only for as long as needed for the purposes above and to comply with UAE legal, tax and accounting obligations, after which it is deleted or anonymised.",
      ]},
      { id: "rights", heading: "9. Your rights", list: [
        "Access, correction and deletion of your personal data.",
        "Restriction or objection to certain processing, including profiling for marketing.",
        "Request human review of automated or AI-assisted decisions that materially affect you.",
        "Data portability where applicable.",
        "Withdraw consent at any time, without affecting prior lawful processing.",
      ], body: ["To exercise these rights, contact privacy@cornermex.ae. We may verify your identity before responding."]},
      { id: "security", heading: "10. Security", body: [
        "We apply administrative, technical and physical safeguards described in the Security & Data Protection Overview. No system is perfectly secure.",
      ]},
      { id: "breach", heading: "11. Breach notification", body: [
        "If a personal data breach is likely to result in significant risk to you, we will notify affected users and the competent UAE authority within the timeframes required by applicable law.",
      ]},
      { id: "minors", heading: "12. Children and minors", body: [
        "CornerMex is intended for adults. We do not knowingly process personal data of children under the age of legal capacity in your emirate. If you believe a minor has provided personal data, contact privacy@cornermex.ae.",
      ]},
    ],
  }),

  doc({
    slug: "cookie-policy",
    title: "Cookie Policy",
    shortTitle: "Cookies",
    summary:
      "How CornerMex uses cookies and similar technologies, the categories we use, and how you can manage your preferences.",
    version: "1.0.0",
    lastUpdated: "2026-06-19",
    owner: "CornerMex Privacy Office",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "what", heading: "1. What cookies are", body: [
        "Cookies are small text files stored in your browser. We also use similar technologies such as local storage. We refer to all of them as 'cookies' in this policy.",
      ]},
      { id: "necessary", heading: "2. Strictly necessary cookies", body: [
        "Required to operate the site: authentication, cart, security and fraud prevention. These cannot be turned off and do not require consent.",
      ]},
      { id: "analytics", heading: "3. Analytics cookies", body: [
        "Help us understand how visitors use the platform so we can improve it. Loaded only after your consent.",
      ]},
      { id: "marketing", heading: "4. Marketing cookies", body: [
        "Used to measure and personalise marketing campaigns across our channels. Loaded only after your consent.",
      ]},
      { id: "functional", heading: "5. Functional cookies", body: [
        "Remember non-essential preferences such as language and saved filters. Loaded only after your consent.",
      ]},
      { id: "third-party", heading: "6. Third-party cookies", body: [
        "Some cookies are set by trusted partners such as payment providers, fraud screening, embedded maps or analytics. These providers act under contractual safeguards.",
      ]},
      { id: "manage", heading: "7. Managing your preferences", body: [
        "You can update your preferences at any time using the 'Cookie preferences' link in the footer, or by clearing cookies in your browser. Withdrawing consent will not affect prior lawful processing.",
      ]},
    ],
  }),

  doc({
    slug: "returns-refunds",
    title: "Returns & Refunds Policy",
    shortTitle: "Returns",
    summary:
      "When you can return an order bought from CornerMex, how refunds are processed, and how to escalate a first-party e-commerce order issue.",
    version: "1.1.0",
    lastUpdated: "2026-06-20",
    owner: "CornerMex Operations",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "who", heading: "1. Who manages returns", body: [
        "CornerMex will manage the customer-facing return and refund process for first-party e-commerce orders placed through this website. You do not need to contact any third-party seller for MVP orders.",
      ]},
      { id: "scope", heading: "2. Eligibility", body: [
        "You can request a return, replacement, refund or (where appropriate) store credit for products that are defective, damaged, incorrect, incomplete, misdescribed, unsafe, that were not delivered, or where a late delivery means you can no longer reasonably benefit from the product, subject to the conditions below and to applicable UAE law.",
        "Food and short shelf-life consumables may have return exceptions where permitted by applicable UAE law. The final policy must be reviewed by UAE counsel and aligned with product category, storage, safety and shelf-life rules.",
      ]},
      { id: "window", heading: "3. Return window", body: [
        "Standard return window: [INSERT RETURN WINDOW AFTER UAE COUNSEL REVIEW] from delivery for eligible items. Perishable, food and personalised items may be non-returnable unless defective.",
      ]},
      { id: "non-returnable", heading: "3. Non-returnable items", list: [
        "Opened, used, temperature-compromised or perishable food, beverages, snacks, sauces, spices or short shelf-life consumables, unless defective, damaged, unsafe, incorrect, incomplete or where a return is legally required.",
        "Personalised, custom-prepared or made-to-order items.",
        "Items marked 'final sale' on the listing.",
      ], body: []},
      { id: "process", heading: "4. How to request a return", body: [
        "Open the order in your account, choose 'Request return' and describe the issue. CornerMex will inspect the request, may ask for photos or additional information, and will respond within a reasonable timeframe.",
      ]},
      { id: "food", heading: "5. Food and consumables", body: [
        "CornerMex will review food-related claims case by case based on safety, storage, shelf life, product condition and applicable UAE law. Final food returns language will be reviewed by UAE counsel.",
      ]},
      { id: "refunds", heading: "6. Refund method and timing", body: [
        "Approved refunds are issued to the original payment method, or (where appropriate) as a replacement or store credit. Bank processing times are typically [INSERT REFUND TIMING AFTER PAYMENT PROVIDER REVIEW] and depend on your bank.",
      ]},
      { id: "delayed", heading: "7. Delayed or undelivered orders", body: [
        "If your order has not arrived within the estimated window, contact support@cornermex.ae so we can investigate with the courier.",
      ]},
      { id: "escalation", heading: "8. Escalation", body: [
        "If you are not satisfied with the outcome of a return or refund request, contact complaints@cornermex.ae. Nothing in this policy affects your rights under UAE consumer protection law.",
      ]},
      { id: "complaints", heading: "9. Complaints", body: [
        "Formal complaints can be sent to complaints@cornermex.ae. Target initial response timeframe: [INSERT RESPONSE TIMEFRAME]. Escalation path after internal review: [INSERT UAE ESCALATION PROCESS AFTER LEGAL REVIEW].",
      ]},
    ],
  }),

  doc({
    slug: "ai-transparency",
    title: "AI Transparency Notice — CornerOps AI",
    shortTitle: "AI Transparency",
    summary:
      "How CornerOps AI assists CornerMex operations, its limitations, how your data is used by AI features and your rights to request human review.",
    version: "1.1.0",
    lastUpdated: "2026-06-20",
    owner: "CornerMex AI Governance",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "what", heading: "1. What CornerOps AI does", list: [
        "Product recommendations and personalisation.",
        "Personalised search, ranking and discovery.",
        "Product content drafting.",
        "Customer support drafting and complaint routing.",
        "Inventory planning and demand forecasting.",
        "Pricing suggestions.",
        "Supplier and product analysis.",
        "Fraud, abuse and risk signals.",
        "Order operations and return / refund triage.",
        "Admin dashboards and compliance reminders.",
      ], body: [
        "CornerOps AI may support internal operations, but CornerMex remains responsible for customer-facing decisions in the current first-party e-commerce model.",
      ]},
      { id: "human-review", heading: "2. Human review", body: [
        "CornerOps AI does not replace human review for critical cases. Material decisions affecting your account or orders are reviewed by trained staff before being applied.",
        "You can request human review when an AI-assisted decision materially affects you by writing to support@cornermex.ae.",
      ]},
      { id: "limitations", heading: "3. Limitations", body: [
        "AI models can produce incorrect, incomplete or biased outputs. AI-generated content may be reviewed, edited or approved by humans before publication where required. Do not rely on AI outputs for legal, medical, financial or safety-critical decisions.",
      ]},
      { id: "data", heading: "4. Data used by AI features", body: [
        "AI features process the minimum data necessary, including catalog data, anonymised usage signals and, where relevant, account-level data needed to personalise an experience. We do not authorise third-party AI providers to use your personal data to train their general models.",
      ]},
      { id: "rights", heading: "5. Your rights", list: [
        "Request human review of an AI-assisted decision that materially affects you.",
        "Object to certain AI-driven profiling, in particular for marketing personalisation.",
        "Access and correct personal data used by AI features, as set out in the Privacy Policy.",
      ], body: []},
      { id: "governance", heading: "6. Governance", body: [
        "CornerMex follows an internal AI governance process covering use-case review, data minimisation, prompt and output logging where appropriate, and incident handling.",
      ]},
    ],
  }),

  doc({
    slug: "seller-agreement",
    title: "Future Marketplace Seller Agreement (Phase 2 Draft)",
    shortTitle: "Future Sellers",
    summary:
      "Phase 2 draft. Not active for the current first-party e-commerce MVP. Describes future obligations of third-party sellers if CornerMex activates marketplace features.",
    version: "1.0.0-draft",
    lastUpdated: "2026-06-20",
    owner: "CornerMex Marketplace",
    reviewStatus: "Legal Review Required",
    lifecycle: "phase-2-draft",
    sections: [
      { id: "status", heading: "0. Status of this document", body: [
        "CornerMex does not currently operate an open third-party seller marketplace. This Seller Agreement is a Phase 2 draft for future marketplace expansion and does not apply to current first-party e-commerce purchases unless CornerMex activates seller onboarding.",
        "For the current MVP, CornerMex is the seller of record for products sold directly through the CornerMex website.",
      ]},
      { id: "onboarding", heading: "1. Onboarding and identity", body: [
        "Sellers must complete onboarding, including identity verification and provision of a valid UAE trade license or equivalent authorisation for the products they intend to sell. CornerMex may request additional documentation at any time.",
      ]},
      { id: "legality", heading: "2. Product legality and compliance", body: [
        "Sellers warrant that their products are lawful to sell in the UAE, comply with applicable food safety, import, labelling and packaging requirements, and that all necessary permits and approvals are in place.",
      ]},
      { id: "listings", heading: "3. Accurate listings", body: [
        "Listings must be accurate, complete and not misleading, including ingredients, allergens, country of origin, weight, expiry and storage conditions where applicable.",
      ]},
      { id: "pricing", heading: "4. Pricing, taxes and invoices", body: [
        "Sellers set prices in AED inclusive of any applicable VAT. Sellers are responsible for issuing tax invoices in line with UAE tax rules and for their own tax reporting.",
      ]},
      { id: "fulfilment", heading: "5. Delivery and logistics", body: [
        "Sellers must dispatch within the SLAs published in the seller dashboard and use the logistics options enabled by CornerMex unless otherwise agreed in writing.",
      ]},
      { id: "returns", heading: "6. Returns, warranties and recalls", body: [
        "Sellers honour the Returns & Refunds Policy and statutory warranties under UAE law. Sellers must comply with applicable product safety, labeling, storage, handling, recall and food/import rules, notify CornerMex immediately of any product safety issue or recall, and cooperate with corrective actions.",
      ]},
      { id: "ip", heading: "7. Intellectual property warranties", body: [
        "Sellers warrant that they own or are licensed to use all content they upload and that their products do not infringe third-party rights.",
      ]},
      { id: "data", heading: "8. Data protection", body: [
        "Sellers process buyer personal data received through CornerMex only to fulfil orders and provide after-sales support, in line with the Privacy Policy and applicable UAE law.",
      ]},
      { id: "prohibited", heading: "9. Prohibited products and conduct", body: [
        "Sellers must not list prohibited or restricted products and must comply with the Acceptable Use Policy at all times.",
      ]},
      { id: "fees", heading: "10. Commission and fees", body: [
        "Commission and fees are described in the seller dashboard and may be updated with reasonable notice. Current rate: [INSERT COMMISSION %].",
      ]},
      { id: "suspension", heading: "11. Suspension and removal", body: [
        "CornerMex may suspend or remove listings, payouts or seller accounts that breach this Agreement, our policies or applicable law, with notice where reasonably possible.",
      ]},
      { id: "indemnity", heading: "12. Indemnity", body: [
        "Sellers indemnify CornerMex against third-party claims arising from their products, listings, content or breach of this Agreement, subject to UAE law.",
      ]},
      { id: "law", heading: "13. Governing law and disputes", body: [
        "This Agreement is governed by UAE law. Disputes are subject to the competent UAE courts.",
      ]},
    ],
  }),

  doc({
    slug: "intellectual-property",
    title: "Intellectual Property Policy",
    shortTitle: "IP Policy",
    summary:
      "How we protect CornerMex IP and seller content, and how rights holders can report infringement.",
    version: "1.0.0",
    lastUpdated: "2026-06-19",
    owner: "CornerMex Legal",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "platform", heading: "1. CornerMex IP", body: [
        "The CornerMex name, logos, trademarks, design system, software and original content are owned by CornerMex or its licensors. No license is granted except as needed to use the platform.",
      ]},
      { id: "seller", heading: "2. Seller and user content", body: [
        "Sellers and users retain ownership of content they upload and grant CornerMex a worldwide, non-exclusive, royalty-free license to host, display, reformat and distribute it as needed to operate and promote the marketplace.",
      ]},
      { id: "report", heading: "3. Reporting infringement", body: [
        "Rights holders can report infringement by emailing legal@cornermex.ae with the information listed below. We review complete and good-faith reports promptly.",
      ], list: [
        "Identification of the protected work or trademark.",
        "Identification of the listing or content claimed to infringe (URL).",
        "Your full contact details and capacity to act for the rights holder.",
        "A statement of good-faith belief that the use is not authorised.",
        "A statement that the information is accurate, under penalty of perjury where applicable, and your signature.",
      ]},
      { id: "takedown", heading: "4. Takedown procedure", body: [
        "If a report is valid, we may remove or disable access to the content and notify the seller. We may share the report with the seller so they can respond.",
      ]},
      { id: "counter", heading: "5. Counter-notice", body: [
        "Sellers may submit a counter-notice if they believe content was removed in error. Counter-notices must include the seller's contact details and a statement of good-faith belief.",
      ]},
      { id: "repeat", heading: "6. Repeat infringers", body: [
        "We may suspend or terminate accounts of users or sellers who are repeat infringers.",
      ]},
    ],
  }),

  doc({
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    shortTitle: "Acceptable Use",
    summary:
      "What you may and may not do on CornerMex, covering illegal content, fraud, abuse, manipulation of reviews or rankings, and misuse of AI tools.",
    version: "1.0.0",
    lastUpdated: "2026-06-19",
    owner: "CornerMex Trust & Safety",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "prohibited", heading: "1. Prohibited content and activity", list: [
        "Illegal products or products restricted in the UAE without proper authorisation.",
        "Misleading listings, fake reviews, manipulated pricing or counterfeit goods.",
        "Fraud, money laundering, sanctions evasion or terrorism financing.",
        "Hate speech, defamation, harassment, threats or doxxing.",
        "Adult illegal content, content harmful to minors, or non-consensual content.",
        "Malware, phishing, unauthorised access, scraping, denial-of-service or other cyber abuse.",
        "Reverse-engineering, bypassing rate limits, or scraping at scale without written permission.",
      ], body: []},
      { id: "ai", heading: "2. Misuse of AI tools", body: [
        "Do not use CornerOps AI or third-party AI to generate deceptive content, impersonate others, evade moderation, manipulate rankings or reviews, or attempt to extract confidential data.",
      ]},
      { id: "integrity", heading: "3. Marketplace integrity", body: [
        "Do not attempt to manipulate reviews, rankings, search results, pricing or marketplace systems, including by coordinating with others.",
      ]},
      { id: "enforcement", heading: "4. Enforcement", body: [
        "We may remove content, restrict features, suspend or terminate accounts, freeze payouts, and report to UAE authorities where the law requires.",
      ]},
    ],
  }),

  doc({
    slug: "security",
    title: "Security & Data Protection Overview",
    shortTitle: "Security",
    summary:
      "How CornerMex protects user and seller data, including transport security, access control, monitoring, incident response and AI governance.",
    version: "1.0.0",
    lastUpdated: "2026-06-19",
    owner: "CornerMex Security",
    reviewStatus: "Legal Review Required",
    sections: [
      { id: "transport", heading: "1. Transport security", body: [
        "All traffic to CornerMex is encrypted in transit using TLS 1.2+.",
      ]},
      { id: "access", heading: "2. Access control", body: [
        "Production systems use role-based access control. Administrative access is restricted to authorised staff and is logged.",
      ]},
      { id: "encryption", heading: "3. Encryption at rest", body: [
        "Personal and order data are stored on managed infrastructure with encryption at rest. Secrets are stored in a dedicated secret manager.",
      ]},
      { id: "logging", heading: "4. Logging and monitoring", body: [
        "We log access to sensitive systems and monitor for anomalies. Logs are retained for the period required by UAE law and operational needs.",
      ]},
      { id: "backups", heading: "5. Backups", body: [
        "Critical datastores are backed up on a regular schedule. Backups are encrypted and access is restricted.",
      ]},
      { id: "incident", heading: "6. Incident response", body: [
        "We follow an internal incident response process covering detection, containment, eradication, recovery, notification and post-incident review. Affected users and the competent UAE authority are notified where required by law.",
      ]},
      { id: "vendors", heading: "7. Vendor security", body: [
        "Critical vendors (hosting, payments, logistics, AI) are assessed before onboarding and operate under contractual safeguards.",
      ]},
      { id: "admin", heading: "8. Admin access restrictions", body: [
        "Admin access to customer data is restricted to authorised staff with a business need, uses strong authentication, and is logged.",
      ]},
      { id: "minimisation", heading: "9. Data minimisation and privacy by design", body: [
        "We collect the minimum data required for each feature and apply privacy-by-design when building new features, including AI features.",
      ]},
      { id: "ai", heading: "10. AI governance and security", body: [
        "CornerOps AI use-cases are reviewed for risk, data minimisation and human oversight. Prompts and outputs may be logged where appropriate. Third-party AI providers are bound by contract not to use your data to train their general models.",
      ]},
    ],
  }),
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

export const LEGAL_INDEX = LEGAL_DOCS.map(({ slug, title, shortTitle, summary, version, lastUpdated, reviewStatus }) => ({
  slug, title, shortTitle, summary, version, lastUpdated, reviewStatus,
}));
# CornerOps Integration Boundary A1

CornerMex is the commerce system of record under `single_merchant_with_internal_supplier_network`. CornerOps is a separate operations-intelligence system. The shared contract is `contracts/cornermex-cornerops-boundary-v1.json` with SHA-256 `b87acfbdeac1427e141677616a0d8fbda5ecabc10a4c84012a9bd5d8bc98249a`.

CornerMex owns customer identity/PII, sellable catalog, prices, stock, checkout, orders, payments, fulfillment, published marketing, reviews and raw analytics. CornerOps owns supplier evidence/listings, sourcing analysis, planning inventory, internal drafts, Work Queue, approvals and audit.

Only masked or aggregated read data may flow from CornerMex to CornerOps. CornerOps-to-CornerMex writes, automatic activation, automatic stock copy and external contact are blocked. Shared references use immutable IDs and SKUs; names, emails and phone numbers are not cross-system keys. No mapping table or command bridge is implemented in A1.

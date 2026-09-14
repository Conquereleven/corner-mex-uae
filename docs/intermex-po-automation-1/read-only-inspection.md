# Read-only inspection — 14 September 2026

Evidence: authenticated Chrome Zoho Books UI, supplied video frames, Railway connector configuration/status and Supabase SELECT queries. No Zoho save/send/create, OAuth grant, provider activation, Railway write or remote database mutation was performed. An existing invoice edit form was opened to read its supply/tax fields and exited with Cancel.

## Zoho Books

Organization: Intermex Pro General Trading LLC, UAE/AED, Dubai, Asia/Dubai, English, accrual, January–December. Organization ID 773588238, observed Books host `books.zoho.com`. VAT registered; Standard Rate 5% is default; Zero Rate 0% also exists. Not configured as a Free Zone in the inspected form. Books notes that organization settings are shared with Inventory. Sender domain authentication was not complete. No sender/email settings were changed.

MAF customer: Majid Al Futtaim Cinemas LLC, AED, VAT Registered, Member State Dubai, Due on Receipt. Billing address is MAF Tower 1, Port Saeed, Deira, Dubai 60811. No shipping address/contact persons in the inspected customer, portal disabled. Additional Wafi address exists. No customer/address was created or edited.

The reference PO B202609-37789 already has invoice 41237, dated 13 September 2026. Observed item label `PR 0077 Sweet Nachos 1kg`, quantity 2.50 kg, rate AED 47, net 117.50, tax 5.88, total 123.38. Standard Rate 5%, tax exclusive, Due on Receipt, Standard Template, note `THANKS FOR YOUR SUPPORT!`. The invoice's actual Place of Supply is **Dubai (DU)** even though the store is in Ajman. Treat this as observed configuration requiring approved policy, not tax advice.

The saved order number contains `AJMAN CITY CENTRE CINEME STORE`; the PO says `CINEMA STORE`. Lookup therefore searches by customer/PO before comparing the complete reference. The video edits a pre-existing invoice; this PO must never be used to test a new live invoice.

The source video shows PO date 13.09.2026, delivery date 14.09.2026, unit `Kilogram`, and a price-after-discount column. Original PDF bytes/text layer were not supplied in the accessible reference; tests reconstruct this layout with synthetic identities. The actual item ID, billing address ID, complete catalog/custom-field inventory and API response shape remain unverified. Browser control subsequently failed to load its request-header policy while reopening the item catalog. No ID is guessed or seeded as an approved mapping.

Developer Space → Connections → My Connections showed no connections. This does **not** establish that no external OAuth client exists. No app registration, grant, token extraction or credential change occurred.

## Railway / Supabase

Railway production service `corner-mex-uae` sources `Conquereleven/corner-mex-uae`, branch main, check suites enabled, Railpack V3 / runtime V2, one replica in asia-southeast1-eqsg3a, public target port 8080. Latest observed deployment: SUCCESS, 12 September 2026 10:58:08 UTC. Configuration inspection showed 17 variable names, including commerce/checkout, VAT, Zoho mode/live-writes and Supabase variables. No Zoho OAuth/worker-secret names appeared in that list. Values were not read, so this does not assert their values or credential validity.

Supabase SELECT inspection found GO-LIVE-2 migration `20260912185327` as the newest ledger entry, following Stripe/Zoho/B2B portal migrations. `provider_runtime_gates` contained zero rows (zero enabled); `accounting_integration_jobs` contained zero rows. This is a point-in-time observation, not an activation guarantee. The new PO migration was not applied remotely.

## API/OAuth integration prerequisites

Use the existing GO-LIVE-2 regional host validation and server-only token refresh. UI authentication is not an API refresh token. Verify the organization/data center via read-only API before granting execution. For discovery, request only the required Books READ scopes for settings, contacts, items and invoices; any future invoice CREATE scope needs a separate reviewed OAuth grant. Do not request customer/item writes or send permissions for this flow. Store credentials only in the approved server secret store, not Git or browser variables. No firewall change was evidenced as necessary for normal outbound HTTPS; none was made.

Official references: [Zoho OAuth](https://www.zoho.com/books/api/v3/oauth/), [Invoices](https://www.zoho.com/books/api/v3/invoices/), [Contacts](https://www.zoho.com/books/api/v3/contacts/), [Items](https://www.zoho.com/books/api/v3/items/). API payload semantics still require a consented test-organization contract check; documentation and UI observation alone are insufficient certification.

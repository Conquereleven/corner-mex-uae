// Single source for customer-facing statements about whether online ordering is
// open. Uses the same build-time public flag as the checkout page
// (src/routes/checkout.tsx) so copy can never contradict what checkout does.
// Server-side execution is still gated independently by
// CORNERMEX_CHECKOUT_ENABLED (src/lib/commercial-config.server.ts).
//
// `import.meta.env` is undefined outside Vite (e.g. node:test), in which case
// ordering is reported as not open — the safe, non-promising default.
export const ONLINE_ORDERING_ENABLED: boolean =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_CORNERMEX_CHECKOUT_ENABLED === "true";

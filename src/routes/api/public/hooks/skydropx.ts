import { createFileRoute } from "@tanstack/react-router";

import { handleShippingWebhook, shippingWebhookSecret } from "@/lib/mx-shipping-webhooks.server";

// Carrier tracking events. Authenticated with HMAC-SHA512 over the exact raw
// body, recorded once, and applied so a shipment only ever moves forward
// (src/lib/mx-shipping-webhooks.server.ts).
export const Route = createFileRoute("/api/public/hooks/skydropx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // The exact bytes: the signature is computed over this string.
        const rawBody = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const result = await handleShippingWebhook({
          db: supabaseAdmin as never,
          provider: "skydropx",
          rawBody,
          signature: request.headers.get("authorization"),
          secret: shippingWebhookSecret("skydropx"),
        });
        return new Response(result.body, {
          status: result.status,
          headers: { "content-type": "text/plain", "cache-control": "no-store" },
        });
      },
    },
  },
});

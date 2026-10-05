import { createFileRoute } from "@tanstack/react-router";

import { handlePaymentWebhook, toWebhookRequest } from "@/lib/mx-payments.server";
import { paymentProviderById } from "@/lib/payments/providers";

// Payment events from the provider. The body is authenticated, recorded once and
// then used only as a prompt to re-read the payment from the provider
// (src/lib/mx-payments.server.ts). It never marks an order paid by itself.
export const Route = createFileRoute("/api/public/hooks/mercado-pago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const result = await handlePaymentWebhook({
          db: supabaseAdmin as never,
          provider: paymentProviderById("mercado_pago"),
          request: await toWebhookRequest(request),
        });
        return new Response(result.body, {
          status: result.status,
          headers: { "content-type": "text/plain", "cache-control": "no-store" },
        });
      },
    },
  },
});

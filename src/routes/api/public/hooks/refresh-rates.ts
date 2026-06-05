import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/refresh-rates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const quotes = ["USD", "EUR", "MXN", "SAR", "GBP"];
        try {
          const r = await fetch(`https://api.exchangerate.host/latest?base=AED&symbols=${quotes.join(",")}`);
          if (!r.ok) throw new Error(`Fetch failed ${r.status}`);
          const j: any = await r.json();
          const rates: Record<string, number> = j.rates ?? {};
          const now = new Date().toISOString();
          const rows = quotes
            .filter((q) => typeof rates[q] === "number")
            .map((q) => ({ base: "AED", quote: q, rate: rates[q], fetched_at: now }));
          if (rows.length) {
            const { error } = await supabaseAdmin.from("currency_rates").upsert(rows, { onConflict: "base,quote" });
            if (error) throw new Error(error.message);
          }
          return Response.json({ ok: true, updated: rows.length });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message }, { status: 502 });
        }
      },
    },
  },
});
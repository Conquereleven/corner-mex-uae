import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/auto-payouts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const windowDays: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30 };

        const { data: sellers, error } = await supabaseAdmin
          .from("sellers")
          .select("id, user_id, store_name, payout_schedule, min_payout_aed, last_auto_payout_at, kyc_status, commission_rate")
          .neq("payout_schedule", "manual")
          .eq("status", "active");
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const created: any[] = [];
        for (const s of (sellers ?? []) as any[]) {
          if (s.kyc_status !== "verified") continue;
          const win = windowDays[s.payout_schedule];
          if (!win) continue;
          if (s.last_auto_payout_at && (now.getTime() - new Date(s.last_auto_payout_at).getTime()) < win * 86400000) continue;

          // compute balance inline
          const [{ data: items }, { data: payouts }] = await Promise.all([
            supabaseAdmin.from("order_items").select("line_total_aed, commission_aed").eq("seller_id", s.id),
            supabaseAdmin.from("seller_payouts").select("net_aed, status").eq("seller_id", s.id),
          ]);
          const gross = (items ?? []).reduce((a: number, x: any) => a + Number(x.line_total_aed ?? 0), 0);
          const commission = (items ?? []).reduce((a: number, x: any) => a + Number(x.commission_aed ?? 0), 0);
          const reserved = (payouts ?? []).filter((p: any) => p.status !== "cancelled").reduce((a: number, p: any) => a + Number(p.net_aed ?? 0), 0);
          const available = +(gross - commission - reserved).toFixed(2);
          if (available < Number(s.min_payout_aed ?? 0) || available <= 0) continue;

          // open request?
          const open = (payouts ?? []).find((p: any) => p.status === "pending" || p.status === "processing");
          if (open) continue;

          const rate = Number(s.commission_rate ?? 0) / 100;
          const grossAmt = rate > 0 && rate < 1 ? +(available / (1 - rate)).toFixed(2) : available;
          const commAmt = +(grossAmt - available).toFixed(2);

          const { data: lastPaid } = await supabaseAdmin
            .from("seller_payouts").select("period_end").eq("seller_id", s.id).eq("status", "paid")
            .order("period_end", { ascending: false }).limit(1).maybeSingle();
          const periodStart = lastPaid?.period_end
            ? new Date(new Date(lastPaid.period_end).getTime() + 86400000).toISOString().slice(0, 10)
            : new Date(now.getTime() - win * 86400000).toISOString().slice(0, 10);
          const periodEnd = now.toISOString().slice(0, 10);

          const { data: ins, error: insErr } = await supabaseAdmin.from("seller_payouts").insert({
            seller_id: s.id, period_start: periodStart, period_end: periodEnd,
            gross_aed: grossAmt, commission_aed: commAmt, net_aed: available,
            status: "pending", requested_at: now.toISOString(),
          }).select("id").single();
          if (insErr) continue;

          await supabaseAdmin.from("sellers").update({ last_auto_payout_at: now.toISOString() }).eq("id", s.id);

          // notify admins
          const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
          if (admins?.length) {
            await supabaseAdmin.from("notifications").insert(admins.map((a: any) => ({
              user_id: a.user_id,
              kind: "payout_auto_requested",
              title: "Auto payout requested",
              body: `${s.store_name} — ${available.toFixed(2)} AED (${s.payout_schedule})`,
              link: "/admin/payouts",
            })));
          }
          await supabaseAdmin.from("notifications").insert({
            user_id: s.user_id, kind: "payout_requested",
            title: "Automatic payout scheduled",
            body: `${available.toFixed(2)} AED queued from your ${s.payout_schedule} schedule.`,
            link: "/seller/payouts",
          });
          created.push({ seller_id: s.id, amount: available, id: ins.id });
        }
        return Response.json({ ok: true, created: created.length, details: created });
      },
    },
  },
});
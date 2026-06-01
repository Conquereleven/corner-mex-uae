import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const TIERS = [
  { tier: "bronze",   threshold: 0,      perks: ["Welcome bonus", "1 pt / AED"] },
  { tier: "silver",   threshold: 5000,   perks: ["Priority support", "1.25 pts / AED", "Free shipping > 300 AED"] },
  { tier: "gold",     threshold: 25000,  perks: ["1.5 pts / AED", "Free shipping > 200 AED", "Quarterly tasting box"] },
  { tier: "platinum", threshold: 100000, perks: ["2 pts / AED", "Free shipping always", "Dedicated account manager"] },
] as const;

export type Tier = (typeof TIERS)[number]["tier"];

export function computeTier(lifetimeAed: number): Tier {
  let current: Tier = "bronze";
  for (const t of TIERS) if (lifetimeAed >= t.threshold) current = t.tier;
  return current;
}

function pointsMultiplier(tier: Tier): number {
  switch (tier) {
    case "platinum": return 2;
    case "gold": return 1.5;
    case "silver": return 1.25;
    default: return 1;
  }
}

/** Server-only helper: award points after an order is paid/placed. Best-effort. */
export async function awardOrderPoints(userId: string, orderId: string, amountAed: number) {
  try {
    const { data: acc } = await supabaseAdmin
      .from("loyalty_accounts").select("id, tier, points_balance, lifetime_spend_aed")
      .eq("user_id", userId).maybeSingle();
    const lifetime = Number(acc?.lifetime_spend_aed ?? 0) + amountAed;
    const newTier = computeTier(lifetime);
    const mult = pointsMultiplier(newTier);
    const earned = Math.round(amountAed * mult);
    const newBalance = (acc?.points_balance ?? 0) + earned;
    if (acc) {
      await supabaseAdmin.from("loyalty_accounts").update({
        tier: newTier, points_balance: newBalance, lifetime_spend_aed: lifetime,
      }).eq("id", acc.id);
    } else {
      await supabaseAdmin.from("loyalty_accounts").insert({
        user_id: userId, tier: newTier, points_balance: newBalance, lifetime_spend_aed: lifetime,
      });
    }
    await supabaseAdmin.from("loyalty_transactions").insert({
      user_id: userId, order_id: orderId, kind: "earn", points: earned,
      description: `Earned from order (${mult}× ${newTier})`,
    });
  } catch (e) {
    console.error("[loyalty] award failed", e);
  }
}

export const getMyLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: acc } = await supabaseAdmin
      .from("loyalty_accounts").select("*").eq("user_id", userId).maybeSingle();
    const { data: txns } = await supabaseAdmin
      .from("loyalty_transactions").select("id, kind, points, description, created_at, order_id")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    const lifetime = Number(acc?.lifetime_spend_aed ?? 0);
    const tier = (acc?.tier as Tier) ?? computeTier(lifetime);
    const tierIdx = TIERS.findIndex((t) => t.tier === tier);
    const next = TIERS[tierIdx + 1] ?? null;
    return {
      account: {
        tier,
        points_balance: acc?.points_balance ?? 0,
        lifetime_spend_aed: lifetime,
      },
      tiers: TIERS,
      next_tier: next ? { tier: next.tier, threshold: next.threshold, remaining: Math.max(0, next.threshold - lifetime) } : null,
      transactions: txns ?? [],
    };
  });

export const redeemPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { points: number; description?: string }) =>
    z.object({ points: z.number().int().min(50).max(100000), description: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: acc } = await supabaseAdmin
      .from("loyalty_accounts").select("id, points_balance").eq("user_id", context.userId).maybeSingle();
    if (!acc || acc.points_balance < data.points) throw new Error("Not enough points");
    await supabaseAdmin.from("loyalty_accounts").update({
      points_balance: acc.points_balance - data.points,
    }).eq("id", acc.id);
    await supabaseAdmin.from("loyalty_transactions").insert({
      user_id: context.userId, kind: "redeem", points: -data.points,
      description: data.description ?? "Points redeemed",
    });
    return { ok: true, balance: acc.points_balance - data.points };
  });

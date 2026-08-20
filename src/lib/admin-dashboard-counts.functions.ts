import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";

export type AdminDashCounts = {
  orders_pending: number;
  shipments_pending: number;
  leads_new: number;
  reviews_pending: number;
  returns_pending: number;
  low_stock: number;
};

async function exactCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const result = await query;
  if (result.error) throw new Error("CM_ADMIN_COUNT_QUERY_FAILED");
  return result.count ?? 0;
}

export const adminDashboardCountsCanonical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashCounts> => {
    await assertAdmin(context.userId);

    const [ordersPending, leadsNew, reviewsPending, lowStock] = await Promise.all([
      exactCount(
        supabaseAdmin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "confirmed", "processing"]),
      ),
      exactCount(
        supabaseAdmin
          .from("b2b_leads")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
      ),
      exactCount(
        supabaseAdmin
          .from("product_reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      exactCount(
        supabaseAdmin
          .from("product_variants")
          .select("id", { count: "exact", head: true })
          .lte("stock", 5),
      ),
    ]);

    return {
      orders_pending: ordersPending,
      shipments_pending: 0,
      leads_new: leadsNew,
      reviews_pending: reviewsPending,
      returns_pending: 0,
      low_stock: lowStock,
    };
  });

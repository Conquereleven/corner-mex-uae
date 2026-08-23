import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";
import {
  evaluateInventoryCatalog,
  type DemandAggregateRead,
  type InventoryIntelligenceReadRepository,
} from "@/lib/inventory-intelligence.service";

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type RawVariant = {
  id: string;
  product_id: string;
  sku: string | null;
  is_active: boolean;
  products?: { status?: string } | { status?: string }[] | null;
};

function productIsActive(product: RawVariant["products"]): boolean {
  const row = Array.isArray(product) ? product[0] : product;
  return row?.status === "active";
}

function windowFor(now = new Date()) {
  const end = now.toISOString();
  const start = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString();
  return { startInclusive: start, endExclusive: end };
}

function asNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function asInteger(value: unknown): number | null {
  const number = asNumber(value);
  return number !== null && Number.isSafeInteger(number) ? number : null;
}

function createReadRepository(window: { startInclusive: string; endExclusive: string }) {
  const repository: InventoryIntelligenceReadRepository = {
    async readCatalogVariants() {
      const { data, error } = await (supabaseAdmin as any)
        .from("product_variants")
        .select("id, product_id, sku, is_active, products!inner(status)")
        .order("id", { ascending: true });
      if (error) throw new Error("CM_INVENTORY_CATALOG_READ_FAILED");
      return ((data ?? []) as RawVariant[]).map((row) => ({
        variantId: row.id,
        productId: row.product_id,
        sku: row.sku,
        productActive: productIsActive(row.products),
        variantActive: row.is_active,
      }));
    },

    async readInventoryBatch(variantIds) {
      if (!variantIds.length) return [];
      const { data, error } = await (supabaseAdmin as any)
        .from("inventory")
        .select("variant_id, quantity_on_hand, quantity_reserved")
        .in("variant_id", [...variantIds]);
      if (error) throw new Error("CM_INVENTORY_STOCK_READ_FAILED");
      return (data ?? []).map((row: any) => ({
        variantId: row.variant_id,
        quantityOnHand: asInteger(row.quantity_on_hand) ?? -1,
        quantityReserved: asInteger(row.quantity_reserved) ?? -1,
      }));
    },

    async readInventoryPoliciesBatch(variantIds) {
      if (!variantIds.length) return [];
      // The private schema is intentionally reachable only from this server function.
      // If its additive migration is not applied yet, missing policies are surfaced by the engine.
      const { data, error } = await (supabaseAdmin as any)
        .schema("commerce_private")
        .from("inventory_policies")
        .select(
          "variant_id, lead_time_days, safety_stock, reorder_point, target_stock, minimum_order_quantity, case_pack",
        )
        .in("variant_id", [...variantIds]);
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") return [];
        throw new Error("CM_INVENTORY_POLICY_READ_FAILED");
      }
      return (data ?? []).map((row: any) => ({
        variantId: row.variant_id,
        leadTimeDays: asInteger(row.lead_time_days),
        safetyStock: asInteger(row.safety_stock),
        configuredReorderPoint: asInteger(row.reorder_point),
        targetStock: asInteger(row.target_stock),
        minimumOrderQuantity: asInteger(row.minimum_order_quantity),
        casePack: asInteger(row.case_pack),
      }));
    },

    async readDemandAggregatesBatch(variantIds, demandWindow) {
      if (!variantIds.length) return [];
      const { data: orders, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, status")
        .gte("created_at", demandWindow.startInclusive)
        .lt("created_at", demandWindow.endExclusive);
      if (orderError) throw new Error("CM_INVENTORY_DEMAND_READ_FAILED");
      const eligibleOrderIds = (orders ?? [])
        .filter((order: any) => !["cancelled", "failed"].includes(order.status))
        .map((order: any) => order.id);
      if (!eligibleOrderIds.length) return [];
      const { data: items, error: itemError } = await (supabaseAdmin as any)
        .from("order_items")
        .select("variant_id, qty")
        .in("order_id", eligibleOrderIds)
        .in("variant_id", [...variantIds]);
      if (itemError) throw new Error("CM_INVENTORY_DEMAND_READ_FAILED");
      const totals = new Map<string, number>();
      for (const item of items ?? []) {
        if (!item.variant_id) continue;
        const qty = asInteger(item.qty);
        if (qty === null || qty < 0) continue;
        totals.set(item.variant_id, (totals.get(item.variant_id) ?? 0) + qty);
      }
      return [...totals.entries()].map(
        ([variantId, totalDemandUnits]): DemandAggregateRead => ({
          variantId,
          totalDemandUnits,
          observedDays: WINDOW_DAYS,
          hasHistoricalDemand: totalDemandUnits > 0,
          source: totalDemandUnits > 0 ? "derived_order_history" : "no_history",
        }),
      );
    },
  };
  return repository;
}

export const inventoryControlTower = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const evaluatedAt = new Date().toISOString();
    const demandWindow = windowFor(new Date(evaluatedAt));
    const evaluation = await evaluateInventoryCatalog(createReadRepository(demandWindow), {
      evaluatedAt,
      demandWindow,
    });
    return evaluation;
  });

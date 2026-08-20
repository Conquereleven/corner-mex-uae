import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-authorization.server";

const Emirate = z.enum([
  "abu_dhabi",
  "dubai",
  "sharjah",
  "ajman",
  "umm_al_quwain",
  "ras_al_khaimah",
  "fujairah",
]);
export type EmirateCode = z.infer<typeof Emirate>;

export const EMIRATE_FORM_TO_DB: Record<string, EmirateCode> = {
  AD: "abu_dhabi",
  DU: "dubai",
  SH: "sharjah",
  AJ: "ajman",
  UQ: "umm_al_quwain",
  RK: "ras_al_khaimah",
  FU: "fujairah",
};

const SHIPPING_CAPABILITY_UNAVAILABLE = "CM_SHIPPING_CONFIGURATION_UNAVAILABLE";
const SELLER_CAPABILITY_UNAVAILABLE = "CM_SELLER_CAPABILITY_UNAVAILABLE";

export type ShippingQuoteResult = {
  zoneId: string | null;
  zoneName: string | null;
  perSeller: Array<{
    sellerId: string;
    sellerName: string;
    subtotal: number;
    weightGrams: number;
    cost: number;
    slaMin: number | null;
    slaMax: number | null;
    freeShippingApplied: boolean;
  }>;
  total: number;
  slaMin: number | null;
  slaMax: number | null;
  error: string | null;
};

export const listShippingZones = createServerFn({ method: "GET" }).handler(async () => {
  // Shipping zones are not canonical production authority. Public callers get
  // an explicit empty capability rather than a database error or fabricated zones.
  return [];
});

const QuoteInput = z.object({
  emirate: Emirate,
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: z.number().int().min(1).max(500),
      }),
    )
    .min(1)
    .max(50),
});

export const getShippingQuote = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof QuoteInput>) => QuoteInput.parse(input))
  .handler(async (): Promise<ShippingQuoteResult> => ({
    zoneId: null,
    zoneName: null,
    perSeller: [],
    total: 0,
    slaMin: null,
    slaMax: null,
    error: SHIPPING_CAPABILITY_UNAVAILABLE,
  }));

const ZoneInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  emirates: z.array(Emirate).min(1),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

const RateInput = z.object({
  id: z.string().uuid().optional(),
  seller_id: z.string().uuid().nullable(),
  zone_id: z.string().uuid(),
  base_aed: z.number().min(0).max(100000),
  per_kg_aed: z.number().min(0).max(100000),
  free_above_aed: z.number().min(0).max(1000000).nullable(),
  sla_min_days: z.number().int().min(0).max(60),
  sla_max_days: z.number().int().min(0).max(60),
  is_active: z.boolean(),
});

const SellerRateInput = RateInput.omit({ id: true, seller_id: true });

async function assertShippingAdmin(userId: string): Promise<never> {
  await assertAdmin(userId);
  throw new Error(SHIPPING_CAPABILITY_UNAVAILABLE);
}

export const adminListZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => assertShippingAdmin(context.userId));

export const adminUpsertZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof ZoneInput>) => ZoneInput.parse(input))
  .handler(async ({ context }) => assertShippingAdmin(context.userId));

export const adminDeleteZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context }) => assertShippingAdmin(context.userId));

export const adminListRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => assertShippingAdmin(context.userId));

export const adminUpsertRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof RateInput>) => RateInput.parse(input))
  .handler(async ({ context }) => assertShippingAdmin(context.userId));

export const adminDeleteRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context }) => assertShippingAdmin(context.userId));

export const sellerListMyRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  });

export const sellerUpsertMyRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof SellerRateInput>) => SellerRateInput.parse(input))
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  });

export const sellerDeleteMyOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  });

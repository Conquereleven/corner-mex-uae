import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Uuid = z.string().uuid();
const Quantity = z.number().int().min(1).max(100000);
const AccountInput = z.object({ accountId: Uuid });

const AccountSchema = z.object({
  id: Uuid,
  name: z.string(),
  role: z.enum(["buyer", "account_admin"]),
  currencyCode: z.literal("AED"),
});
const PriceStatusSchema = z.enum(["default", "special_account", "expired_override"]);
const CurrentCommercialSchema = z.object({
  catalogPriceAed: z.number().nonnegative(),
  effectivePriceAed: z.number().nonnegative(),
  priceStatus: PriceStatusSchema,
});
const VariantSchema = z
  .object({
    variantId: Uuid,
    productId: Uuid,
    name: z.string(),
    slug: z.string(),
    sku: z.string().nullable(),
    variantLabel: z.string().nullable(),
    availableStock: z.number().int().nonnegative(),
  })
  .merge(CurrentCommercialSchema);
const SavedListItemSchema = z
  .object({
    variantId: Uuid,
    desiredQuantity: Quantity,
    sortPosition: z.number().int().nonnegative(),
    name: z.string(),
    sku: z.string().nullable(),
    variantLabel: z.string().nullable(),
    availableStock: z.number().int().nonnegative(),
    sellable: z.boolean(),
  })
  .merge(CurrentCommercialSchema);
const SavedListSchema = z.object({
  id: Uuid,
  name: z.string(),
  updatedAt: z.string(),
  items: z.array(SavedListItemSchema),
});
const ReorderOrderSchema = z.object({
  id: Uuid,
  orderNumber: z.string(),
  createdAt: z.string(),
  status: z.string(),
  itemCount: z.number().int().nonnegative(),
});
const ReorderLineSchema = z.object({
  variantId: Uuid.nullable(),
  name: z.string(),
  sku: z.string().nullable(),
  variantLabel: z.string().nullable(),
  quantity: Quantity,
  availableStock: z.number().int().nonnegative(),
  eligible: z.boolean(),
  reason: z.enum(["inactive", "unavailable"]).nullable(),
  catalogPriceAed: z.number().nonnegative().nullable(),
  effectivePriceAed: z.number().nonnegative().nullable(),
  priceStatus: PriceStatusSchema.nullable(),
});

export type B2bAccount = z.infer<typeof AccountSchema>;
export type B2bVariant = z.infer<typeof VariantSchema>;
export type B2bSavedList = z.infer<typeof SavedListSchema>;
export type B2bReorderOrder = z.infer<typeof ReorderOrderSchema>;
export type B2bReorderLine = z.infer<typeof ReorderLineSchema>;

type B2bPortalClient = {
  rpc: (
    fn: "b2b_portal_v1",
    args: { p_action: string; p_account_id: string | null; p_payload: Record<string, unknown> },
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

function portalError(error: { message?: string } | null): never | void {
  if (!error) return;
  const code = /CM_B2B_[A-Z0-9_]+/.exec(error.message ?? "")?.[0];
  throw new Error(code ?? "CM_B2B_PORTAL_UNAVAILABLE");
}

async function callPortal(
  client: unknown,
  action: string,
  accountId: string | null,
  payload: Record<string, unknown> = {},
) {
  const response = await (client as B2bPortalClient).rpc("b2b_portal_v1", {
    p_action: action,
    p_account_id: accountId,
    p_payload: payload,
  });
  portalError(response.error);
  return response.data;
}

export const getB2bAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    z
      .object({ accounts: z.array(AccountSchema) })
      .parse(await callPortal(context.supabase, "accounts", null)),
  );

export const searchB2bVariants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; query: string }) =>
    AccountInput.extend({ query: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) =>
    z.object({ items: z.array(VariantSchema) }).parse(
      await callPortal(context.supabase, "search", data.accountId, {
        query: data.query,
        limit: 20,
      }),
    ),
  );

export const getB2bSavedLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => AccountInput.parse(input))
  .handler(async ({ data, context }) =>
    z
      .object({ lists: z.array(SavedListSchema) })
      .parse(await callPortal(context.supabase, "saved_lists", data.accountId)),
  );

export const createB2bSavedList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; name: string }) =>
    AccountInput.extend({ name: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(({ data, context }) =>
    callPortal(context.supabase, "create_list", data.accountId, { name: data.name }),
  );

export const renameB2bSavedList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; listId: string; name: string }) =>
    AccountInput.extend({ listId: Uuid, name: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(({ data, context }) =>
    callPortal(context.supabase, "rename_list", data.accountId, {
      listId: data.listId,
      name: data.name,
    }),
  );

export const addB2bSavedListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { accountId: string; listId: string; variantId: string; desiredQuantity: number }) =>
      AccountInput.extend({ listId: Uuid, variantId: Uuid, desiredQuantity: Quantity }).parse(
        input,
      ),
  )
  .handler(({ data, context }) => callPortal(context.supabase, "add_item", data.accountId, data));

export const setB2bSavedListQuantity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { accountId: string; listId: string; variantId: string; desiredQuantity: number }) =>
      AccountInput.extend({ listId: Uuid, variantId: Uuid, desiredQuantity: Quantity }).parse(
        input,
      ),
  )
  .handler(({ data, context }) =>
    callPortal(context.supabase, "set_quantity", data.accountId, data),
  );

export const removeB2bSavedListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; listId: string; variantId: string }) =>
    AccountInput.extend({ listId: Uuid, variantId: Uuid }).parse(input),
  )
  .handler(({ data, context }) =>
    callPortal(context.supabase, "remove_item", data.accountId, data),
  );

export const reorderB2bSavedListItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; listId: string; variantIds: string[] }) =>
    AccountInput.extend({ listId: Uuid, variantIds: z.array(Uuid).max(500) }).parse(input),
  )
  .handler(({ data, context }) =>
    callPortal(context.supabase, "reorder_items", data.accountId, data),
  );

export const getB2bReorderOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => AccountInput.parse(input))
  .handler(async ({ data, context }) =>
    z
      .object({ orders: z.array(ReorderOrderSchema) })
      .parse(await callPortal(context.supabase, "orders", data.accountId)),
  );

export const buildB2bReorderDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; orderId: string }) =>
    AccountInput.extend({ orderId: Uuid }).parse(input),
  )
  .handler(async ({ data, context }) =>
    z.object({ orderId: Uuid, lines: z.array(ReorderLineSchema), notice: z.string() }).parse(
      await callPortal(context.supabase, "reorder_draft", data.accountId, {
        orderId: data.orderId,
      }),
    ),
  );

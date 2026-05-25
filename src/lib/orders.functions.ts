import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Emirate = z.enum(["AD", "DU", "SH", "AJ", "UQ", "RK", "FU"]);
const PaymentMethod = z.enum(["card", "apple_pay", "google_pay", "tabby", "tamara", "cod", "bank_transfer"]);

const Input = z.object({
  items: z.array(z.object({
    variantId: z.string().uuid(),
    qty: z.number().int().min(1).max(500),
  })).min(1).max(50),
  payment_method: PaymentMethod,
  shipping_address: z.object({
    recipient_name: z.string().min(1).max(120),
    phone: z.string().min(5).max(30),
    emirate: Emirate,
    area: z.string().min(1).max(120),
    street: z.string().max(160).optional().nullable(),
    building: z.string().max(80).optional().nullable(),
    floor_apt: z.string().max(40).optional().nullable(),
    landmark: z.string().max(120).optional().nullable(),
  }),
  notes: z.string().max(500).optional().nullable(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof Input>) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Load variants + products + sellers with admin to compute trusted prices
    const variantIds = data.items.map((i) => i.variantId);
    const { data: variants, error: vErr } = await supabaseAdmin
      .from("product_variants")
      .select(`
        id, price_aed, stock, format_label,
        product:products!inner(id, seller_id, status,
          translations:product_translations(lang, name),
          seller:sellers!inner(id, commission_rate)
        )
      `)
      .in("id", variantIds);
    if (vErr) throw new Error(vErr.message);
    if (!variants || variants.length !== variantIds.length) throw new Error("Some products are no longer available");

    // Build order_items rows
    let subtotal = 0;
    const sellerIds = new Set<string>();
    const orderItems = data.items.map((it) => {
      const v: any = variants.find((x: any) => x.id === it.variantId);
      if (!v) throw new Error("Variant not found");
      if (v.product.status !== "active") throw new Error("Product no longer active");
      if (v.stock < it.qty) throw new Error(`Insufficient stock for ${v.format_label ?? "item"}`);
      const unit = Number(v.price_aed);
      const line = unit * it.qty;
      subtotal += line;
      sellerIds.add(v.product.seller_id);
      const tr = (v.product.translations ?? []).find((t: any) => t.lang === "en") ?? (v.product.translations ?? [])[0];
      const commissionRate = Number(v.product.seller.commission_rate ?? 12);
      return {
        variant_id: v.id,
        product_id: v.product.id,
        seller_id: v.product.seller_id,
        product_name: tr?.name ?? "Product",
        variant_label: v.format_label,
        qty: it.qty,
        unit_price_aed: unit,
        line_total_aed: line,
        commission_aed: +(line * (commissionRate / 100)).toFixed(2),
      };
    });

    const shipping = subtotal >= 150 ? 0 : sellerIds.size * 25;
    const tax = +(subtotal * 0.05).toFixed(2);
    const total = +(subtotal + shipping + tax).toFixed(2);

    // Insert order with admin (auth_id captured separately)
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        buyer_id: userId,
        status: "pending",
        subtotal_aed: subtotal,
        shipping_aed: shipping,
        tax_aed: tax,
        total_aed: total,
        payment_method: data.payment_method,
        payment_status: data.payment_method === "cod" ? "pending" : "pending",
        shipping_address: data.shipping_address,
        notes: data.notes ?? null,
      })
      .select("id, order_number")
      .single();
    if (oErr) throw new Error(oErr.message);

    const { error: oiErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));
    if (oiErr) throw new Error(oiErr.message);

    // Decrement stock
    for (const it of data.items) {
      const v: any = variants.find((x: any) => x.id === it.variantId);
      await supabaseAdmin.from("product_variants")
        .update({ stock: v.stock - it.qty })
        .eq("id", it.variantId);
    }

    return { orderId: order.id, orderNumber: order.order_number, total };
  });
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listProductReviews = createServerFn({ method: "GET" })
  .inputValidator((i: { productId: string; limit?: number }) =>
    z.object({ productId: z.string().uuid(), limit: z.number().int().min(1).max(100).optional() }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("product_reviews")
      .select("id, rating, title, body, created_at, buyer_id")
      .eq("product_id", data.productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.buyer_id)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
      for (const p of profs ?? []) names[p.id] = (p.full_name ?? "Customer").split(" ")[0];
    }
    const reviews = (rows ?? []).map((r) => ({ ...r, author: names[r.buyer_id] ?? "Customer" }));
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    return { reviews, avg: Number(avg.toFixed(2)), count: reviews.length };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { productId: string; rating: number; title?: string; body?: string }) =>
    z.object({
      productId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(120).optional(),
      body: z.string().max(2000).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Find a delivered order_item the user owns for this product, without an existing review.
    const { data: candidates } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, orders!inner(buyer_id, status, created_at)")
      .eq("product_id", data.productId)
      .eq("orders.buyer_id", userId)
      .eq("orders.status", "delivered")
      .order("created_at", { ascending: false, referencedTable: "orders" });
    const items = (candidates ?? []) as Array<{ id: string }>;
    if (items.length === 0) {
      throw new Error("Solo puedes reseñar productos que compraste.");
    }
    // Reuse the user's existing review for this product if any, else pick the newest delivered item
    const { data: existing } = await supabaseAdmin
      .from("product_reviews")
      .select("id, order_item_id")
      .eq("product_id", data.productId)
      .eq("buyer_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error: upErr } = await supabaseAdmin.rpc("update_verified_review", {
        p_review_id: existing.id,
        p_rating: data.rating,
        p_title: data.title ?? undefined,
        p_comment: data.body ?? undefined,
      });
      if (upErr) throw new Error(upErr.message);
      return { id: existing.id };
    }
    const target = items[0];
    const { data: created, error: rpcErr } = await supabaseAdmin.rpc("create_verified_review", {
      p_order_item_id: target.id,
      p_rating: data.rating,
      p_title: data.title ?? undefined,
      p_comment: data.body ?? undefined,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    return { id: (created as any)?.id ?? null };
  });

export const myReviewForProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { productId: string }) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("product_reviews")
      .select("id, rating, title, body")
      .eq("product_id", data.productId)
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row;
  });

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string }) => z.object({ status: z.string().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("product_reviews")
      .select("id, rating, title, body, status, created_at, product_id, buyer_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows } = await q;
    const pids = Array.from(new Set((rows ?? []).map((r) => r.product_id)));
    const products: Record<string, string> = {};
    if (pids.length) {
      const { data: ps } = await supabaseAdmin.from("products").select("id, slug").in("id", pids);
      for (const p of ps ?? []) products[p.id] = p.slug;
    }
    return (rows ?? []).map((r) => ({ ...r, product_slug: products[r.product_id] ?? null }));
  });

export const adminSetReviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: "pending" | "approved" | "hidden" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "approved", "hidden"]) }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("product_reviews").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

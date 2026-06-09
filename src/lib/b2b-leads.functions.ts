import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LeadInput = z.object({
  full_name: z.string().trim().min(2).max(200),
  company: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(60).optional().nullable(),
  country_city: z.string().trim().max(120).optional().nullable(),
  business_type: z.string().trim().max(120).optional().nullable(),
  products_interest: z.string().trim().max(1000).optional().nullable(),
  estimated_volume: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  contact_preference: z.string().trim().max(40).optional().nullable(),
});

export const submitB2bLead = createServerFn({ method: "POST" })
  .inputValidator((i: z.input<typeof LeadInput>) => LeadInput.parse(i))
  .handler(async ({ data }) => {
    // De-dupe: same email + same products_interest within 10 minutes
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: dup } = await supabaseAdmin
      .from("b2b_leads")
      .select("id")
      .eq("email", data.email)
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) {
      return { ok: true as const, id: dup[0].id, duplicate: true };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("b2b_leads")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: ins.id, duplicate: false };
  });

export type B2bLead = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  country_city: string | null;
  business_type: string | null;
  products_interest: string | null;
  estimated_volume: string | null;
  message: string | null;
  contact_preference: string | null;
  status: "new" | "contacted" | "quoting" | "closed" | "lost";
  admin_note: string | null;
  contacted_at: string | null;
  created_at: string;
};

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

export const adminListB2bLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string } | undefined) =>
    z
      .object({ status: z.enum(["all", "new", "contacted", "quoting", "closed", "lost"]).default("all") })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<B2bLead[]> => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("b2b_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as B2bLead[];
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "quoting", "closed", "lost"]).optional(),
  admin_note: z.string().max(4000).nullable().optional(),
});

export const adminUpdateB2bLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof UpdateInput>) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: Record<string, any> = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "contacted") patch.contacted_at = new Date().toISOString();
    }
    if (data.admin_note !== undefined) patch.admin_note = data.admin_note;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await supabaseAdmin
      .from("b2b_leads")
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
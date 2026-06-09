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
  idempotency_key: z.string().trim().min(8).max(80).optional().nullable(),
});

export const submitB2bLead = createServerFn({ method: "POST" })
  .inputValidator((i: z.input<typeof LeadInput>) => LeadInput.parse(i))
  .handler(async ({ data }) => {
    // Idempotency: if a key is provided and already exists, return the prior lead.
    if (data.idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from("b2b_leads")
        .select("id")
        .eq("idempotency_key", data.idempotency_key)
        .maybeSingle();
      if (existing) {
        return { ok: true as const, id: existing.id, duplicate: true };
      }
    }
    // Fallback de-dupe: same email within 10 minutes
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
      .insert(data as any)
      .select("id")
      .single();
    if (error) {
      // Unique violation on idempotency_key: another in-flight request won the race.
      if ((error as any).code === "23505" && data.idempotency_key) {
        const { data: existing } = await supabaseAdmin
          .from("b2b_leads")
          .select("id")
          .eq("idempotency_key", data.idempotency_key)
          .maybeSingle();
        if (existing) return { ok: true as const, id: existing.id, duplicate: true };
      }
      throw new Error(error.message);
    }
    // Fire-and-forget confirmation email (never fail the lead on email error)
    sendLeadConfirmationEmail(data).catch((e) => {
      console.warn("[b2b-lead] email send failed", e?.message ?? e);
    });
    return { ok: true as const, id: ins.id, duplicate: false };
  });

async function sendLeadConfirmationEmail(lead: z.infer<typeof LeadInput>) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.warn("[b2b-lead] Missing LOVABLE_API_KEY or RESEND_API_KEY — skipping email");
    return;
  }
  const safe = (s: string | null | undefined) =>
    (s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "amp;" }[c]!));
  const summaryRows = ([
    ["Company", lead.company],
    ["Products of interest", lead.products_interest],
    ["Estimated volume", lead.estimated_volume],
    ["Country / city", lead.country_city],
    ["Business type", lead.business_type],
    ["Preferred contact", lead.contact_preference],
    ["Message", lead.message],
  ] as Array<[string, string | null | undefined]>).filter(([, v]) => v && String(v).trim().length > 0);
  const summaryHtml = summaryRows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;">${k}</td><td style="padding:6px 0;color:#111;font-size:13px;">${safe(String(v))}</td></tr>`)
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee;">
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;">Corner Mex</p>
          <h1 style="margin:8px 0 0;font-size:24px;font-weight:600;letter-spacing:-0.01em;">Thank you, ${safe(lead.full_name)}</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151;">We received your wholesale enquiry and our team will get back to you within one business day with availability, pricing and delivery SLAs.</p>
        </td></tr>
        <tr><td style="padding:8px 32px 8px;">
          <h2 style="margin:24px 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Your request</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f3f4f6;">${summaryHtml || `<tr><td style="padding:12px 0;color:#6b7280;font-size:13px;">—</td></tr>`}</table>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">If anything is urgent you can also reach us at <a href="mailto:b2b@cornermex.ae" style="color:#111;text-decoration:underline;">b2b@cornermex.ae</a>.</p>
          <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Corner Mex · Authentic Mexican pantry, sourced for the UAE</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: "Corner Mex <onboarding@resend.dev>",
      to: [lead.email],
      subject: "We received your wholesale enquiry — Corner Mex",
      html,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Resend ${resp.status}: ${text.slice(0, 200)}`);
  }
}

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
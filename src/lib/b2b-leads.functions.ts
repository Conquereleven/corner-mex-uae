import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";
import {
  B2B_LEAD_PRIORITIES,
  B2B_LEAD_STATUSES,
  type B2bLeadPriority,
  type B2bLeadStatus,
} from "@/lib/b2b-lead-lifecycle";

type RpcError = { message?: string } | null;
type B2bRpcName =
  | "submit_b2b_lead_v1"
  | "admin_list_b2b_leads_v1"
  | "admin_get_b2b_lead_v1"
  | "admin_update_b2b_lead_v1"
  | "admin_update_b2b_lead_pipeline_v1"
  | "admin_save_b2b_quote_draft_v1"
  | "admin_add_b2b_lead_note_v1"
  | "admin_delete_b2b_lead_note_v1";

type B2bRpcClient = {
  rpc: (
    fn: B2bRpcName,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError }>;
};

const httpUrl = z
  .string()
  .trim()
  .url()
  .max(1000)
  .refine((value) => /^https?:\/\//i.test(value), "Use an http(s) URL");

const LeadInput = z.object({
  full_name: z.string().trim().min(2).max(200),
  company: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(60).optional().nullable(),
  country_city: z.string().trim().min(2).max(120),
  contact_role: z.string().trim().max(120).optional().nullable(),
  business_type: z.string().trim().min(2).max(120),
  products_interest: z.string().trim().min(1).max(1000),
  estimated_volume: z.string().trim().min(1).max(120),
  message: z.string().trim().max(2000).optional().nullable(),
  contact_preference: z.string().trim().max(40).optional().nullable(),
  idempotency_key: z.string().trim().min(8).max(80),
});

const LeadStatusSchema = z.enum(B2B_LEAD_STATUSES);
const LeadPrioritySchema = z.enum(B2B_LEAD_PRIORITIES);

export const B2bQuoteDraftSchema = z
  .object({
    items_summary: z.string().trim().max(8000).nullable(),
    delivery_fee_aed: z.number().min(0).max(999999).nullable(),
    vat_treatment: z.string().trim().max(500).nullable(),
    availability_note: z.string().trim().max(1000).nullable(),
    valid_until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    payment_terms: z.string().trim().max(1000).nullable(),
    recipient: z.string().trim().max(320).nullable(),
    notes: z.string().trim().max(4000).nullable(),
  })
  .strict();

const B2bLeadSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  company: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  country_city: z.string().nullable(),
  contact_role: z.string().nullable(),
  business_type: z.string().nullable(),
  products_interest: z.string().nullable(),
  estimated_volume: z.string().nullable(),
  message: z.string().nullable(),
  contact_preference: z.string().nullable(),
  status: LeadStatusSchema,
  admin_note: z.string().nullable(),
  contacted_at: z.string().nullable(),
  website: z.string().nullable(),
  decision_maker: z.string().nullable(),
  qualification_score: z.number().int().min(0).max(100).nullable(),
  priority: LeadPrioritySchema,
  owner: z.string().nullable(),
  source_url: z.string().nullable(),
  last_contact_at: z.string().nullable(),
  next_action: z.string().nullable(),
  next_action_at: z.string().nullable(),
  blocker: z.string().nullable(),
  first_order_id: z.string().uuid().nullable(),
  first_order_linked_at: z.string().nullable(),
  quote_draft: B2bQuoteDraftSchema.nullable(),
  quote_draft_updated_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const LeadStatusEventSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  from_status: LeadStatusSchema.nullable(),
  to_status: LeadStatusSchema,
  changed_by: z.string().uuid().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
});

const LeadNoteSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  author_id: z.string().uuid().nullable(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const LeadSubmissionResultSchema = z.object({
  id: z.string().uuid(),
  duplicate: z.boolean(),
});

const LeadDetailSchema = z.object({
  lead: B2bLeadSchema,
  history: z.array(LeadStatusEventSchema),
  notes: z.array(LeadNoteSchema),
});

export type B2bLead = z.infer<typeof B2bLeadSchema>;
export type B2bQuoteDraft = z.infer<typeof B2bQuoteDraftSchema>;
export type LeadStatusEvent = z.infer<typeof LeadStatusEventSchema>;
export type LeadNote = z.infer<typeof LeadNoteSchema>;
export type B2bLeadSubmissionResult = z.infer<typeof LeadSubmissionResultSchema>;

function rpcErrorCode(error: RpcError, fallback: string) {
  if (!error) return null;
  return /CM_[A-Z0-9_]+/.exec(error.message ?? "")?.[0] ?? fallback;
}

function userFacingError(error: RpcError, fallback: string) {
  const code = rpcErrorCode(error, fallback);
  if (code) throw new Error(code);
}

export const submitB2bLead = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof LeadInput>) => LeadInput.parse(input))
  .handler(async ({ data }): Promise<B2bLeadSubmissionResult> => {
    const { data: result, error } = await (supabaseAdmin as unknown as B2bRpcClient).rpc(
      "submit_b2b_lead_v1",
      {
        p_full_name: data.full_name,
        p_company: data.company,
        p_email: data.email,
        p_phone: data.phone ?? null,
        p_country_city: data.country_city,
        p_contact_role: data.contact_role ?? null,
        p_business_type: data.business_type,
        p_products_interest: data.products_interest,
        p_estimated_volume: data.estimated_volume,
        p_message: data.message ?? null,
        p_contact_preference: data.contact_preference ?? null,
        p_idempotency_key: data.idempotency_key,
      },
    );
    userFacingError(error, "CM_B2B_LEAD_SUBMIT_FAILED");
    return LeadSubmissionResultSchema.parse(result);
  });

export const adminListB2bLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string } | undefined) =>
    z
      .object({
        status: z.enum(["all", ...B2B_LEAD_STATUSES]).default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<B2bLead[]> => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (context.supabase as unknown as B2bRpcClient).rpc(
      "admin_list_b2b_leads_v1",
      { p_status: data.status },
    );
    userFacingError(error, "CM_B2B_LEADS_QUERY_FAILED");
    return z.array(B2bLeadSchema).parse(result);
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  status: LeadStatusSchema.optional(),
  admin_note: z.string().max(4000).nullable().optional(),
});

export const adminUpdateB2bLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof UpdateInput>) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (context.supabase as unknown as B2bRpcClient).rpc(
      "admin_update_b2b_lead_v1",
      {
        p_lead_id: data.id,
        p_status: data.status ?? null,
        p_admin_note: data.admin_note ?? null,
        p_set_admin_note: data.admin_note !== undefined,
      },
    );
    userFacingError(error, "CM_B2B_LEAD_UPDATE_FAILED");
    return z
      .object({
        ok: z.boolean(),
        status_changed: z.boolean(),
        from_status: LeadStatusSchema,
        to_status: LeadStatusSchema,
      })
      .parse(result);
  });

const PipelineInput = z.object({
  id: z.string().uuid(),
  website: httpUrl.nullable(),
  decision_maker: z.string().trim().max(200).nullable(),
  qualification_score: z.number().int().min(0).max(100).nullable(),
  priority: LeadPrioritySchema,
  owner: z.string().trim().max(160).nullable(),
  source_url: httpUrl.nullable(),
  last_contact_at: z.string().datetime({ offset: true }).nullable(),
  next_action: z.string().trim().max(1000).nullable(),
  next_action_at: z.string().datetime({ offset: true }).nullable(),
  blocker: z.string().trim().max(2000).nullable(),
  first_order_id: z.string().uuid().nullable(),
});

export type B2bLeadPipelineInput = z.infer<typeof PipelineInput>;

export const adminUpdateB2bLeadPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof PipelineInput>) => PipelineInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (context.supabase as unknown as B2bRpcClient).rpc(
      "admin_update_b2b_lead_pipeline_v1",
      {
        p_lead_id: data.id,
        p_website: data.website,
        p_decision_maker: data.decision_maker,
        p_qualification_score: data.qualification_score,
        p_priority: data.priority,
        p_owner: data.owner,
        p_source_url: data.source_url,
        p_last_contact_at: data.last_contact_at,
        p_next_action: data.next_action,
        p_next_action_at: data.next_action_at,
        p_blocker: data.blocker,
        p_first_order_id: data.first_order_id,
      },
    );
    userFacingError(error, "CM_B2B_LEAD_PIPELINE_UPDATE_FAILED");
    return z
      .object({ ok: z.boolean(), lead_id: z.string().uuid(), first_order_linked: z.boolean() })
      .parse(result);
  });

const QuoteDraftInput = z.object({
  lead_id: z.string().uuid(),
  draft: B2bQuoteDraftSchema.nullable(),
});

export const adminSaveB2bQuoteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof QuoteDraftInput>) => QuoteDraftInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (context.supabase as unknown as B2bRpcClient).rpc(
      "admin_save_b2b_quote_draft_v1",
      { p_lead_id: data.lead_id, p_quote_draft: data.draft },
    );
    userFacingError(error, "CM_B2B_QUOTE_DRAFT_SAVE_FAILED");
    return z
      .object({ ok: z.boolean(), lead_id: z.string().uuid(), draft_only: z.literal(true) })
      .parse(result);
  });

export const adminGetB2bLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (context.supabase as unknown as B2bRpcClient).rpc(
      "admin_get_b2b_lead_v1",
      { p_lead_id: data.id },
    );
    userFacingError(error, "CM_B2B_LEAD_QUERY_FAILED");
    return LeadDetailSchema.parse(result);
  });

const NoteInput = z.object({
  lead_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const adminAddLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof NoteInput>) => NoteInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (context.supabase as unknown as B2bRpcClient).rpc(
      "admin_add_b2b_lead_note_v1",
      { p_lead_id: data.lead_id, p_body: data.body },
    );
    userFacingError(error, "CM_B2B_LEAD_NOTE_CREATE_FAILED");
    return z.object({ ok: z.boolean(), id: z.string().uuid() }).parse(result);
  });

export const adminDeleteLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (context.supabase as unknown as B2bRpcClient).rpc(
      "admin_delete_b2b_lead_note_v1",
      { p_note_id: data.id },
    );
    userFacingError(error, "CM_B2B_LEAD_NOTE_DELETE_FAILED");
    return z.object({ ok: z.boolean(), lead_id: z.string().uuid() }).parse(result);
  });

export type { B2bLeadPriority, B2bLeadStatus };

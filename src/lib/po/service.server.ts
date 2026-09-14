import type { Json } from "@/integrations/supabase/types";
import { randomUUID } from "node:crypto";
import { IntakeSchema } from "./intake-schema.ts";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gatedAccountingProvider, readAccountingRuntime } from "@/lib/accounting-runtime.server";
import { safeInvoiceUrl } from "@/lib/invoice-projection";
import { composePo, PoError, MappingSchema, type ComposedPo } from "./domain.ts";
import { extractPo, hash, MAX_PO_BYTES } from "./document.server.ts";
import { processPo } from "./processor.ts";
// Separate reviewed authorization must remove this stop. No env flag can enable PO provider writes in this sprint.
export const PO_PROVIDER_EXECUTION_AUTHORIZED = false;
// Additive RPCs intentionally precede generated production schema types.
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};
export async function poAction(action: string, payload: unknown = {}, actorId?: string) {
  const { data, error } = await (supabaseAdmin as unknown as RpcClient).rpc("cm_po_action_v1", {
    p_action: action,
    p_payload: payload,
    p_actor_id: actorId ?? null,
  });
  if (error) throw new PoError("PO_STORAGE_ACTION_FAILED");
  return data as Json;
}
export async function intakePo(raw: unknown) {
  const input = IntakeSchema.parse(raw),
    bytes = Buffer.from(input.documentBase64, "base64");
  if (
    !bytes.length ||
    bytes.length > MAX_PO_BYTES ||
    bytes.toString("base64") !== input.documentBase64
  )
    throw new PoError("DOCUMENT_ENCODING_INVALID");
  const config = (await poAction("mappings", {
    mode: input.mode,
    organizationId: input.organizationId,
  })) as { revision: string; mappings: unknown } | null;
  let normalized = null,
    composed: ComposedPo | null = null,
    safeCode: string | null = null;
  try {
    normalized = await extractPo(bytes, input.mime, config?.mappings);
    if (!config) throw new PoError("MAPPINGS_REQUIRED");
    composed = composePo(normalized, config.mappings);
    if (composed.mode !== input.mode || composed.organizationId !== input.organizationId)
      throw new PoError("PO_SCOPE_MISMATCH");
  } catch (e) {
    composed = null;
    safeCode = e instanceof PoError ? e.code : "DOCUMENT_PARSE_FAILED";
  }
  return poAction("intake", {
    mode: input.mode,
    organizationId: input.organizationId,
    source: input.source,
    sourceKey: hash(input.sourceId),
    documentHash: hash(bytes),
    documentBase64: input.documentBase64,
    mime: input.mime,
    normalized,
    composed,
    safeCode,
    mappingRevision: config?.revision ?? null,
  });
}
export async function savePoMappings(input: unknown, actor: string) {
  const mappings = MappingSchema.parse(input);
  if (Date.parse(mappings.approvedAt) > Date.now() || Date.parse(mappings.validUntil) <= Date.now())
    throw new PoError("MAPPINGS_EXPIRED");
  return poAction("configure", mappings, actor);
}
export async function runPoWorker() {
  if (!PO_PROVIDER_EXECUTION_AUTHORIZED)
    return { ok: false, blocked: true, code: "PO_EXECUTION_NOT_AUTHORIZED" };
  const runtime = await readAccountingRuntime();
  if (!runtime.ready || !runtime.config || runtime.config.product !== "books" || !runtime.gate)
    return { ok: false, blocked: true, code: "ACCOUNTING_ACTIVATION_BLOCKED" };
  const workerId = `po-${randomUUID()}`;
  const { data, error } = await (supabaseAdmin as unknown as RpcClient).rpc("cm_po_claim_v1", {
    p_worker_id: workerId,
    p_mode: runtime.gate.mode,
    p_organization_id: runtime.config.organizationId,
  });
  if (error) throw new PoError("PO_CLAIM_FAILED");
  const rows = data as Array<{ id: string; composed: ComposedPo }>;
  const results = [];
  for (const row of rows ?? []) {
    const act = (action: string, payload: Record<string, unknown> = {}) =>
      poAction(action, { ...payload, id: row.id, workerId });
    const assert = async () => {
      await act("assert");
    };
    const provider = await gatedAccountingProvider(assert);
    results.push(
      await processPo(row.composed, provider, {
        assert,
        beginCreate: async () =>
          Boolean(((await act("begin_create")) as { acquired: boolean }).acquired),
        complete: async (invoice) => {
          await act("complete", {
            invoiceId: invoice.invoice_id,
            projection: {
              number: invoice.invoice_number ?? null,
              status: invoice.status,
              issuedDate: invoice.date,
              url: safeInvoiceUrl(
                invoice.invoice_url,
                (process.env.CORNERMEX_INVOICE_ALLOWED_HOSTS ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              ),
              pdfSupported: true,
            },
          });
        },
        attention: async (code) => {
          await act("attention", { code });
        },
      }),
    );
  }
  return { ok: true, results };
}

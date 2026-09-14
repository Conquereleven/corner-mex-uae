import { IntakeSchema } from "./intake-schema";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-authorization.server";
import { intakePo, poAction, savePoMappings } from "./service.server";
import { MappingSchema } from "./domain";
export const adminPoIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: z.input<typeof IntakeSchema>) => IntakeSchema.parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    return intakePo({ ...data, source: "admin" });
  });
export const adminPoQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return poAction("list", {}, context.userId);
  });
export const adminPoDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    return poAction("detail", data, context.userId);
  });
export const adminPoMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: z.input<typeof MappingSchema>) => MappingSchema.parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    return savePoMappings(data, context.userId);
  });

const RevisionSchema = z
  .object({
    id: z.string().uuid(),
    normalized: z.unknown(),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();
export const adminPoRevise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: z.input<typeof RevisionSchema>) => RevisionSchema.parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { composePo, PoSchema } = await import("./domain");
    const row = (await poAction("detail", { id: data.id }, context.userId)) as {
      mode: string;
      organization_id: string;
    } | null;
    if (!row) throw new Error("PO_NOT_FOUND");
    const config = (await poAction("mappings", {
      mode: row.mode,
      organizationId: row.organization_id,
    })) as { revision: string; mappings: unknown } | null;
    if (!config) throw new Error("MAPPINGS_REQUIRED");
    const normalized = PoSchema.parse(data.normalized),
      composed = composePo(normalized, config.mappings);
    return poAction(
      "revise",
      { id: data.id, normalized, composed, mappingRevision: config.revision, reason: data.reason },
      context.userId,
    );
  });

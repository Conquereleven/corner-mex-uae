import { timingSafeEqual } from "node:crypto";
import { IntakeSchema, type IntakeInput } from "./intake-schema.ts";
export async function handlePoIntake(
  request: Request,
  env: Record<string, string | undefined>,
  submit: (input: IntakeInput) => Promise<unknown>,
) {
  if (env.CORNERMEX_PO_INTAKE_ENABLED !== "true")
    return Response.json({ ok: false, code: "PO_INTAKE_DISABLED" }, { status: 503 });
  const expected = env.CORNERMEX_PO_INTAKE_SECRET,
    supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return Response.json({ ok: false }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ ok: false }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ ok: false }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 7_000_000) {
        await reader.cancel();
        return Response.json({ ok: false, code: "DOCUMENT_TOO_LARGE" }, { status: 413 });
      }
      chunks.push(value);
    }
    const input = IntakeSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (
      input.source === "admin" ||
      input.mode !== env.CORNERMEX_PO_MODE ||
      input.organizationId !== env.CORNERMEX_PO_ORGANIZATION_ID
    )
      return Response.json({ ok: false, code: "PO_SOURCE_SCOPE_INVALID" }, { status: 403 });
    return Response.json({ ok: true, result: await submit(input) }, { status: 202 });
  } catch {
    return Response.json({ ok: false, code: "PO_INTAKE_REJECTED" }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
}

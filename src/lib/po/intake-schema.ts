import { z } from "zod";
export const MAX_PO_BYTES = 5 * 1024 * 1024;
export const IntakeSchema = z
  .object({
    mode: z.enum(["test", "live"]),
    organizationId: z.string().min(1).max(100),
    source: z.enum(["email", "ichat", "admin"]),
    sourceId: z.string().trim().min(1).max(300),
    mime: z.enum(["application/pdf", "application/json", "text/plain"]),
    documentBase64: z
      .string()
      .min(4)
      .max(Math.ceil(MAX_PO_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  })
  .strict();
export type IntakeInput = z.infer<typeof IntakeSchema>;

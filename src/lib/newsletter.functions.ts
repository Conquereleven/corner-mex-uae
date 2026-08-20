import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-authorization.server";

const NEWSLETTER_CAPABILITY_UNAVAILABLE = "CM_NEWSLETTER_CAPABILITY_UNAVAILABLE";

const EmailSchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(["en", "es", "ar"]).default("en"),
  source: z.string().max(60).optional(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof EmailSchema>) => EmailSchema.parse(input))
  .handler(async () => {
    // Do not pretend a subscription succeeded while the canonical subscriber
    // authority is absent from production.
    throw new Error(NEWSLETTER_CAPABILITY_UNAVAILABLE);
  });

export const adminListNewsletter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    throw new Error(NEWSLETTER_CAPABILITY_UNAVAILABLE);
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EmailSchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(["en", "es", "ar"]).default("en"),
  source: z.string().max(60).optional(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((i: z.input<typeof EmailSchema>) => EmailSchema.parse(i))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert({ email, locale: data.locale, source: data.source ?? "footer", status: "subscribed" }, { onConflict: "email" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListNewsletter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, email, locale, source, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    return data ?? [];
  });
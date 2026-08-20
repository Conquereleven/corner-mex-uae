import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ADMIN_ROLE_REQUIRED = "CM_ADMIN_ROLE_REQUIRED";
export const ADMIN_ROLE_CHECK_FAILED = "CM_ADMIN_ROLE_CHECK_FAILED";

/**
 * Server-side authorization boundary for privileged CornerMex operations.
 * Route protection is UX/navigation only; every privileged server function
 * must independently enforce this guard before using service-role access.
 */
export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error(ADMIN_ROLE_CHECK_FAILED);
  if (!data) throw new Error(ADMIN_ROLE_REQUIRED);
}

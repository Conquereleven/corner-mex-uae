import { createServerFn } from "@tanstack/react-start";
import type { RouteAuthState } from "@/lib/route-auth";

async function getValidatedUserId() {
  const { createSupabaseSsrClient } = await import("@/integrations/supabase/client.ssr.server");
  const supabase = createSupabaseSsrClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? undefined : data?.claims?.sub;
}

export const getRouteAuthState = createServerFn({ method: "GET" }).handler(
  async (): Promise<RouteAuthState> => ({
    authenticated: Boolean(await getValidatedUserId()),
    admin: false,
  }),
);

export const getRouteAdminState = createServerFn({ method: "GET" }).handler(
  async (): Promise<RouteAuthState> => {
    const userId = await getValidatedUserId();
    if (!userId) return { authenticated: false, admin: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) throw new Error("Unable to verify admin role");
    return { authenticated: true, admin: Boolean(role) };
  },
);

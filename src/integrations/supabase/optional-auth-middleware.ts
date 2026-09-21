// Optional authentication for public endpoints that serve both guests and
// signed-in customers (guest checkout, founder decision 2026-09-20).
//
// The generated requireSupabaseAuth middleware rejects anonymous callers. This
// variant resolves an identity when one is presented and leaves it null
// otherwise, so ONE endpoint can serve both flows.
//
// A missing Authorization header means "guest". A malformed or invalid token is
// still rejected: a tampered session must never be silently downgraded into a
// guest order.
import { createMiddleware } from "@tanstack/start-client-core";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
    }

    const authHeader = (context as { authorization?: string | null } | undefined)?.authorization;
    if (!authHeader) {
      return next({
        context: { userId: null as string | null, claims: null as Record<string, unknown> | null },
      });
    }
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Error("Unauthorized: Invalid token");
    }
    return next({
      context: {
        userId: data.claims.sub as string | null,
        claims: data.claims as unknown as Record<string, unknown> | null,
      },
    });
  },
);

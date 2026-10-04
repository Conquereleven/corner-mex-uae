import { createClient } from "@supabase/supabase-js";

import { assertMarketDatabase } from "../../config/market-database.ts";
import type { Database } from "./types";

function createReadOnlyClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("CornerMex read-only Supabase configuration is unavailable");
  }

  // Refuse any database but the declared Mexico one (src/config/market-database.ts).
  assertMarketDatabase(process.env);

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-cornermex-access-mode": "read-only" } },
  });
}

let client: ReturnType<typeof createReadOnlyClient> | undefined;

export const supabaseReadOnly = new Proxy({} as ReturnType<typeof createReadOnlyClient>, {
  get(_, property, receiver) {
    client ??= createReadOnlyClient();
    return Reflect.get(client, property, receiver);
  },
});

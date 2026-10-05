// Market ↔ database guard.
//
// A Mexico deployment must only ever talk to the Mexico database. Any other
// CornerMex-family project would look compatible — same schema — and the damage
// would be silent: AED prices rendered as pesos, Mexican orders written into
// someone else's tables.
//
// The UAE canonical instance was deleted on 2026-10-04 (its code, migrations and
// history stay in Git). Its ref remains on the deny-list on purpose: a stale
// environment variable must fail here with a clear reason, not as a DNS error,
// and a ref restored from backup must still be refused.
//
// Three independent checks, all fail-closed:
//   1. CORNERMEX_MARKET must name the market this build was made for.
//   2. The Supabase project must not be one of the known non-Mexico projects
//      (UAE, CornerOps), and must
//      be the project the deployment explicitly declares
//      (CORNERMEX_MX_SUPABASE_PROJECT_REF) — on the server URL and on the URL
//      baked into the browser bundle alike.
//   3. At runtime the database itself must answer that it is Mexico / MXN
//      (public.cm_market_identity_v1, created by the Mexico migrations). No
//      other project has that function.
//
// No imports beyond market.ts: this runs in the browser, on the server and
// under node:test.

import { ACTIVE_MARKET } from "./market.ts";

/**
 * Supabase projects CornerMex Mexico must never connect to, refused by ref:
 * the two UAE projects (both gone; kept so a stale variable is named, not
 * guessed) and CornerOps, which is a separate live product.
 */
export const NON_MX_SUPABASE_PROJECTS: Readonly<Record<string, string>> = Object.freeze({
  wlrfknmrhowldygmvtvn: "UAE canonical database (deleted 2026-10-04)",
  ywyiejqnbyzjfatojvkh: "UAE legacy database (obsolete)",
  nhxpujypqxbjiqqddxqt: "CornerOps database (separate product)",
});

/** The project ref of a `https://<ref>.supabase.co` URL, or null. */
export function supabaseProjectRef(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const match = /^([a-z0-9]{15,40})\.supabase\.(co|in|net)$/.exec(host);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export type MarketDatabaseEvaluation = {
  ok: boolean;
  reasons: string[];
  projectRef: string | null;
};

type Environment = Record<string, string | undefined>;

export function evaluateMarketDatabase(environment: Environment): MarketDatabaseEvaluation {
  const reasons: string[] = [];

  const market = (environment.CORNERMEX_MARKET ?? "").trim();
  if (market !== ACTIVE_MARKET.code) reasons.push(`CORNERMEX_MARKET_must_be_${ACTIVE_MARKET.code}`);

  const declared = (environment.CORNERMEX_MX_SUPABASE_PROJECT_REF ?? "").trim().toLowerCase();
  if (!declared) reasons.push("missing_CORNERMEX_MX_SUPABASE_PROJECT_REF");
  else if (declared in NON_MX_SUPABASE_PROJECTS) {
    reasons.push("CORNERMEX_MX_SUPABASE_PROJECT_REF_names_a_non_mexico_database");
  }

  const serverRef = supabaseProjectRef(environment.SUPABASE_URL);
  for (const [name, raw] of [
    ["SUPABASE_URL", environment.SUPABASE_URL],
    ["VITE_SUPABASE_URL", environment.VITE_SUPABASE_URL],
  ] as const) {
    // The browser URL is optional on the server; when present it must agree.
    if (name === "VITE_SUPABASE_URL" && !raw) continue;
    const ref = supabaseProjectRef(raw);
    if (!ref) {
      reasons.push(`${name}_project_unreadable`);
      continue;
    }
    if (ref in NON_MX_SUPABASE_PROJECTS) reasons.push(`${name}_points_at_a_non_mexico_database`);
    else if (declared && ref !== declared)
      reasons.push(`${name}_is_not_the_declared_mexico_project`);
  }

  return { ok: reasons.length === 0, reasons, projectRef: serverRef };
}

export const MARKET_DATABASE_MISMATCH = "CM_MARKET_DATABASE_MISMATCH";

/** Throws unless the environment points at the declared Mexico database. */
export function assertMarketDatabase(environment: Environment): void {
  const evaluation = evaluateMarketDatabase(environment);
  if (!evaluation.ok) {
    throw new Error(`${MARKET_DATABASE_MISMATCH}: ${evaluation.reasons.join(",")}`);
  }
}

/**
 * Browser-side check on the URL baked into the bundle. The browser has no
 * access to server variables, so it can only refuse the known foreign projects.
 */
export function assertBrowserDatabase(url: string | undefined): void {
  const ref = supabaseProjectRef(url);
  if (ref && ref in NON_MX_SUPABASE_PROJECTS) {
    throw new Error(`${MARKET_DATABASE_MISMATCH}: browser_bundle_points_at_a_non_mexico_database`);
  }
}

/** What the database must answer for this market. */
export function isExpectedMarketIdentity(value: unknown): boolean {
  const identity = value as { market?: unknown; currency?: unknown } | null;
  return identity?.market === ACTIVE_MARKET.code && identity?.currency === ACTIVE_MARKET.currency;
}

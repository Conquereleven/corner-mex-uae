import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hashB2bIntakeAbuseKey,
  selectTrustedClientIp,
} from "../../src/lib/b2b-intake-abuse.server.ts";

const read = (path) => readFile(path, "utf8");
const migrationPath =
  "supabase/migrations/20260821023000_cm_launch_1_l5r_b2b_intake_anti_abuse.sql";

test("Railway runtime trusts proxy-owned X-Real-IP and rejects missing or invalid identity", () => {
  assert.equal(
    selectTrustedClientIp({
      realIp: "198.51.100.24",
      directIp: "10.0.0.4",
      railwayRuntime: true,
    }),
    "198.51.100.24",
  );
  assert.equal(
    selectTrustedClientIp({
      realIp: undefined,
      directIp: "10.0.0.4",
      railwayRuntime: true,
    }),
    null,
  );
  assert.equal(
    selectTrustedClientIp({
      realIp: "spoofed",
      directIp: "10.0.0.4",
      railwayRuntime: true,
    }),
    null,
  );
});

test("non-Railway runtime uses transport IP", () => {
  assert.equal(
    selectTrustedClientIp({
      realIp: "192.0.2.50",
      directIp: "127.0.0.1",
      railwayRuntime: false,
    }),
    "127.0.0.1",
  );
});

test("Railway abuse identity does not depend on forwarded-for chains", async () => {
  const abuse = await read("src/lib/b2b-intake-abuse.server.ts");

  assert.match(abuse, /getRequestHeader\("x-real-ip"\)/);
  assert.doesNotMatch(abuse, /x-forwarded-for/i);
});

test("abuse identity is deterministic pseudonymous HMAC rather than retained IP", () => {
  const first = hashB2bIntakeAbuseKey("198.51.100.24", "test-pepper");
  const retry = hashB2bIntakeAbuseKey("198.51.100.24", "test-pepper");
  const other = hashB2bIntakeAbuseKey("198.51.100.25", "test-pepper");

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, retry);
  assert.notEqual(first, other);
  assert.doesNotMatch(first, /198\.51\.100\.24/);
});

test("B2B limiter has separate bounded burst and sustained windows with reset behavior", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /v_burst_limit constant integer := 5/);
  assert.match(migration, /v_burst_window constant interval := interval '10 minutes'/);
  assert.match(migration, /v_sustained_limit constant integer := 20/);
  assert.match(migration, /v_sustained_window constant interval := interval '24 hours'/);
  assert.match(migration, /p_now >= v_row\.burst_window_started_at \+ v_burst_window/);
  assert.match(migration, /v_row\.burst_count := 0/);
  assert.match(migration, /p_now >= v_row\.sustained_window_started_at \+ v_sustained_window/);
  assert.match(migration, /v_row\.sustained_count := 0/);
});

test("legitimate idempotent retry resolves before anti-abuse budget consumption", async () => {
  const migration = await read(migrationPath);
  const duplicateLookup = migration.indexOf("where idempotency_key = v_idempotency_key");
  const limiterConsume = migration.indexOf("consume_b2b_intake_budget_v1(p_abuse_key, now())");

  assert.notEqual(duplicateLookup, -1);
  assert.notEqual(limiterConsume, -1);
  assert.ok(duplicateLookup < limiterConsume);
  assert.match(migration, /'duplicate', true, 'rate_limited', false/);
});

test("distinct idempotency keys cannot bypass the server-side abuse key budget", async () => {
  const [server, migration] = await Promise.all([
    read("src/lib/b2b-leads.functions.ts"),
    read(migrationPath),
  ]);

  assert.match(server, /getB2bIntakeAbuseKey\(\)/);
  assert.match(server, /"submit_b2b_lead_v2"/);
  assert.match(server, /p_abuse_key: abuseKey/);
  assert.match(migration, /abuse_key text primary key/);
  assert.match(migration, /burst_count = v_row\.burst_count \+ 1/);
  assert.match(migration, /sustained_count = v_row\.sustained_count \+ 1/);
});

test("guarded v2 is the only service-role public intake RPC", async () => {
  const migration = await read(migrationPath);

  assert.match(
    migration,
    /revoke all on function public\.submit_b2b_lead_v1[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /grant execute on function public\.submit_b2b_lead_v2[\s\S]*to service_role/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.submit_b2b_lead_v2[\s\S]*to anon/,
  );
});

test("limiter backend failure and missing trusted identity fail closed before persistence", async () => {
  const [server, abuse, migration] = await Promise.all([
    read("src/lib/b2b-leads.functions.ts"),
    read("src/lib/b2b-intake-abuse.server.ts"),
    read(migrationPath),
  ]);

  assert.match(abuse, /CM_B2B_ABUSE_IDENTITY_UNAVAILABLE/);
  assert.match(abuse, /CM_B2B_ABUSE_BACKEND_UNAVAILABLE/);
  assert.match(server, /if \(error\) throwPublicIntakeUnavailable\(\)/);
  assert.match(server, /setResponseStatus\(503\)/);

  const rpcStart = server.indexOf('rpc("submit_b2b_lead_v2"');
  const rpcCatch = server.indexOf("catch {", rpcStart);
  assert.ok(rpcStart >= 0 && rpcCatch > rpcStart);
  assert.ok(server.indexOf("throwPublicIntakeUnavailable();", rpcCatch) > rpcCatch);
  assert.ok(
    migration.indexOf("consume_b2b_intake_budget_v1(p_abuse_key, now())") <
      migration.indexOf("v_result := public.submit_b2b_lead_v1"),
  );
});

test("throttling is safe to users and observable without lead PII", async () => {
  const [server, migration] = await Promise.all([
    read("src/lib/b2b-leads.functions.ts"),
    read(migrationPath),
  ]);

  assert.match(server, /setResponseStatus\(429\)/);
  assert.match(server, /setResponseHeader\("Retry-After"/);
  assert.match(server, /Too many enquiry attempts\. Please try again later\./);
  assert.match(server, /\[B2B intake\] request throttled/);
  assert.doesNotMatch(
    server,
    /console\.(?:warn|error)\([^\n]*(?:data\.email|data\.phone|abuseKey)/,
  );
  assert.match(migration, /allowed_count bigint/);
  assert.match(migration, /blocked_count bigint/);
  assert.match(migration, /last_seen_at < p_now - interval '7 days'/);
});

test("throttled path cannot mutate commerce or external messaging", async () => {
  const migration = await read(migrationPath);

  assert.doesNotMatch(
    migration,
    /insert into public\.orders|update public\.orders|delete from public\.orders/i,
  );
  assert.doesNotMatch(migration, /inventory_movements|payments|payment_intents|send.*email/i);
  assert.doesNotMatch(migration, /insert into public\.b2b_leads/i);
});

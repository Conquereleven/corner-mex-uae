import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateProductionActivationReadiness } from "../../scripts/a3/validate-production-activation-readiness.mjs";
import { verifyProductionActivationReadiness } from "../../scripts/a3/verify-production-activation-readiness.mjs";

const readContract = async () =>
  JSON.parse(await readFile("contracts/cornermex-production-activation-readiness-v1.json", "utf8"));
const fixedNow = new Date("2026-07-15T15:00:00-06:00");

test("committed readiness is valid but blocked by documented decisions", async () => {
  const result = await validateProductionActivationReadiness(await readContract(), {
    now: fixedNow,
  });
  assert.equal(result.status, "a3_2a_valid_but_blocked");
  assert.equal(result.readyForA3_2bReview, false);
  assert.ok(result.blockers.includes("founder_decisions_unresolved"));
});

test("approved Railway execution remains future-only with commerce disabled", async () => {
  const contract = await readContract();
  assert.equal(contract.railway.productionEnvironmentDecision, "approved_for_a3_2b_execution_only");
  assert.equal(contract.railway.productionEnvironmentExecutionOccurred, false);
  assert.equal(contract.railway.productionEnvironmentExists, false);
  assert.equal(contract.runtimeFlags.productionActivated, false);
  assert.equal(contract.runtimeFlags.checkoutEnabled, false);
  assert.equal(contract.runtimeFlags.paymentsEnabled, false);
});

test("approved Lovable rollback window is 14 days and has not started", async () => {
  const contract = await readContract();
  assert.equal(contract.rollback.approvedWindowDays, 14);
  assert.equal(contract.rollback.cutoverExecuted, false);
  assert.equal(contract.rollback.windowStarted, false);
  assert.equal(contract.rollback.lovableRetired, false);
});

const mutations = [
  ["wrong project", (v) => (v.canonicalProjectRef = "wrong")],
  ["wrong Railway project", (v) => (v.railwayProjectId = "wrong")],
  ["wrong service", (v) => (v.railwayService = "wrong")],
  ["missing observation", (v) => delete v.observedAt],
  ["RLS incomplete", (v) => (v.database.rlsTables = 19)],
  ["Auth user", (v) => (v.auth.users = 1)],
  ["Storage bucket", (v) => (v.storage.buckets = 1)],
  ["product row", (v) => (v.database.zeroState.products = 1)],
  ["inventory row", (v) => (v.database.zeroState.inventory = 1)],
  ["order row", (v) => (v.database.zeroState.orders = 1)],
  ["payment row", (v) => (v.database.zeroState.payments = 1)],
  ["review row", (v) => (v.database.zeroState.reviews = 1)],
  ["checkout enabled", (v) => (v.runtimeFlags.checkoutEnabled = true)],
  ["payments enabled", (v) => (v.runtimeFlags.paymentsEnabled = true)],
  ["automatic import", (v) => (v.runtimeFlags.automaticImportEnabled = true)],
  ["inventory sync", (v) => (v.runtimeFlags.automaticInventorySyncEnabled = true)],
  ["DNS changed", (v) => (v.dns.changed = true)],
  ["production activated", (v) => (v.runtimeFlags.productionActivated = true)],
  ["rollback anchor missing", (v) => (v.rollback.anchor = "")],
  ["schema drift", (v) => (v.database.schemaFingerprint = "wrong")],
  ["fake readiness", (v) => (v.readyForA3_2bReview = true)],
  ["Railway execution claimed", (v) => (v.railway.productionEnvironmentExecutionOccurred = true)],
  ["wrong Lovable window", (v) => (v.rollback.approvedWindowDays = 13)],
  ["Lovable window started", (v) => (v.rollback.windowStarted = true)],
  ["Lovable retired", (v) => (v.rollback.lovableRetired = true)],
];

for (const [name, mutate] of mutations) {
  test(`${name} fails closed`, async () => {
    const contract = await readContract();
    mutate(contract);
    await assert.rejects(validateProductionActivationReadiness(contract, { now: fixedNow }));
  });
}

test("expired evidence fails closed", async () => {
  await assert.rejects(
    validateProductionActivationReadiness(await readContract(), {
      now: new Date("2026-07-17T00:00:00-06:00"),
    }),
    /EXPIRED/,
  );
});

test("static mode performs no live collection and says so", async () => {
  let called = false;
  const result = await verifyProductionActivationReadiness({
    env: {},
    now: fixedNow,
    liveCollector: async () => {
      called = true;
    },
  });
  assert.equal(called, false);
  assert.equal(result.liveQueryPerformed, false);
  assert.match(result.message, /No live platform query was performed/);
});

test("live mode requires an explicit adapter and never falls back", async () => {
  await assert.rejects(
    verifyProductionActivationReadiness({ env: { A3_LIVE_READ_ONLY: "true" }, now: fixedNow }),
    /ADAPTER_REQUIRED/,
  );
});

test("live mode accepts exact safe evidence and rejects contradictions", async () => {
  const contract = await readContract();
  const live = {
    canonicalProjectRef: contract.canonicalProjectRef,
    railwayProjectId: contract.railwayProjectId,
    railwayEnvironment: contract.railwayEnvironment,
    railwayService: contract.railwayService,
    database: contract.database,
    auth: contract.auth,
    storage: contract.storage,
    railway: contract.railway,
  };
  const result = await verifyProductionActivationReadiness({
    env: { A3_LIVE_READ_ONLY: "true" },
    now: fixedNow,
    liveCollector: async () => live,
  });
  assert.equal(result.liveQueryPerformed, true);
  await assert.rejects(
    verifyProductionActivationReadiness({
      env: { A3_LIVE_READ_ONLY: "true" },
      now: fixedNow,
      liveCollector: async () => ({ ...live, canonicalProjectRef: "wrong" }),
    }),
    /CONTRADICTS/,
  );
});

// Mexico database isolation: the deployment must be a Mexico deployment, on the
// declared Mexico Supabase project, and the UAE path must be inert.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const guard = await import("../../src/config/market-database.ts");
const market = await import("../../src/config/market.ts");
const gate = await import("../../src/lib/uae-market-gate.ts");
const execution = await import("../../src/lib/checkout-execution.server.ts");
const { getReadinessResponse } = await import("../../src/routes/api/ready.ts");

const MX_REF = "mexicoprojectref0001";
const good = {
  CORNERMEX_MARKET: "MX",
  CORNERMEX_MX_SUPABASE_PROJECT_REF: MX_REF,
  SUPABASE_URL: `https://${MX_REF}.supabase.co`,
  VITE_SUPABASE_URL: `https://${MX_REF}.supabase.co`,
};

test("market config is MX", () => {
  assert.deepEqual(
    [market.ACTIVE_MARKET.code, market.ACTIVE_MARKET.currency, market.ACTIVE_MARKET.status],
    ["MX", "MXN", "ACTIVE"],
  );
});

test("MX-only environment guard: a correctly declared Mexico deployment passes", () => {
  assert.deepEqual(guard.evaluateMarketDatabase(good), {
    ok: true,
    reasons: [],
    projectRef: MX_REF,
  });
  assert.doesNotThrow(() => guard.assertMarketDatabase(good));
});

test("an environment that does not declare the Mexico market fails closed", () => {
  for (const value of [undefined, "", "AE", "UAE", "mx"]) {
    const result = guard.evaluateMarketDatabase({ ...good, CORNERMEX_MARKET: value });
    assert.deepEqual(result.reasons, ["CORNERMEX_MARKET_must_be_MX"], String(value));
  }
  assert.deepEqual(guard.evaluateMarketDatabase({}).reasons, [
    "CORNERMEX_MARKET_must_be_MX",
    "missing_CORNERMEX_MX_SUPABASE_PROJECT_REF",
    "SUPABASE_URL_project_unreadable",
  ]);
});

test("wrong Supabase project fails closed: both UAE databases are refused by name", () => {
  for (const ref of Object.keys(guard.NON_MX_SUPABASE_PROJECTS)) {
    const server = guard.evaluateMarketDatabase({
      ...good,
      SUPABASE_URL: `https://${ref}.supabase.co`,
    });
    assert.equal(server.ok, false);
    assert.ok(server.reasons.includes("SUPABASE_URL_points_at_a_non_mexico_database"), ref);

    const browser = guard.evaluateMarketDatabase({
      ...good,
      VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
    });
    assert.ok(browser.reasons.includes("VITE_SUPABASE_URL_points_at_a_non_mexico_database"), ref);

    // Declaring the UAE project as "the Mexico project" does not get around it.
    const declared = guard.evaluateMarketDatabase({
      ...good,
      CORNERMEX_MX_SUPABASE_PROJECT_REF: ref,
      SUPABASE_URL: `https://${ref}.supabase.co`,
      VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
    });
    assert.ok(
      declared.reasons.includes("CORNERMEX_MX_SUPABASE_PROJECT_REF_names_a_non_mexico_database"),
      ref,
    );
    assert.throws(
      () => guard.assertBrowserDatabase(`https://${ref}.supabase.co`),
      /CM_MARKET_DATABASE_MISMATCH/,
    );
  }
  assert.deepEqual(Object.keys(guard.NON_MX_SUPABASE_PROJECTS).sort(), [
    "nhxpujypqxbjiqqddxqt",
    "wlrfknmrhowldygmvtvn",
    "ywyiejqnbyzjfatojvkh",
  ]);
});

test("a project other than the declared one fails closed, as does an unreadable URL", () => {
  const other = guard.evaluateMarketDatabase({
    ...good,
    SUPABASE_URL: "https://someotherproject0002.supabase.co",
  });
  assert.deepEqual(other.reasons, ["SUPABASE_URL_is_not_the_declared_mexico_project"]);
  const split = guard.evaluateMarketDatabase({
    ...good,
    VITE_SUPABASE_URL: "https://someotherproject0002.supabase.co",
  });
  assert.deepEqual(split.reasons, ["VITE_SUPABASE_URL_is_not_the_declared_mexico_project"]);
  assert.deepEqual(guard.evaluateMarketDatabase({ ...good, SUPABASE_URL: "not a url" }).reasons, [
    "SUPABASE_URL_project_unreadable",
  ]);
  assert.throws(
    () => guard.assertMarketDatabase({ ...good, SUPABASE_URL: undefined }),
    /CM_MARKET_DATABASE_MISMATCH/,
  );
  assert.doesNotThrow(() => guard.assertBrowserDatabase(good.VITE_SUPABASE_URL));
});

test("the database must itself answer that it is Mexico / MXN", () => {
  assert.equal(guard.isExpectedMarketIdentity({ market: "MX", currency: "MXN" }), true);
  assert.equal(guard.isExpectedMarketIdentity({ market: "AE", currency: "AED" }), false);
  assert.equal(guard.isExpectedMarketIdentity({ market: "MX", currency: "AED" }), false);
  // The UAE database has no identity function: the call fails and yields nothing.
  assert.equal(guard.isExpectedMarketIdentity(null), false);
  assert.equal(guard.isExpectedMarketIdentity(undefined), false);
});

test("every server-side Supabase client refuses the wrong database before connecting", async () => {
  for (const file of [
    "src/integrations/supabase/client.server.ts",
    "src/integrations/supabase/client.readonly.server.ts",
  ]) {
    const source = await readFile(file, "utf8");
    const guardAt = source.indexOf("assertMarketDatabase(process.env)");
    const connectAt = source.indexOf("return createClient<Database>(");
    assert.ok(guardAt > 0 && guardAt < connectAt, `${file} must guard before createClient`);
  }
  const browser = await readFile("src/integrations/supabase/client.ts", "utf8");
  assert.ok(
    browser.indexOf("assertBrowserDatabase(SUPABASE_URL)") <
      browser.indexOf("return createBrowserClient<Database>("),
  );
  assert.ok(browser.includes("assertBrowserDatabase(SUPABASE_URL)"));
});

test("readiness is refused, without touching the network, when the database is wrong", async () => {
  const response = await getReadinessResponse(
    {
      SUPABASE_URL: "https://wlrfknmrhowldygmvtvn.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "public-key",
      CORNERMEX_MARKET: "MX",
      CORNERMEX_MX_SUPABASE_PROJECT_REF: MX_REF,
    },
    async () => {
      throw new Error("must not call the UAE database");
    },
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual([body.status, body.target, body.market.code], ["degraded", "refused", "MX"]);
  assert.ok(body.marketDatabase.reasons.includes("SUPABASE_URL_points_at_a_non_mexico_database"));
});

test("no AED catalog seed: the Mexico bootstrap ships no prices, products or orders", async () => {
  const dir = "supabase/mx/migrations";
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql"));
  assert.ok(files.length >= 1);
  for (const name of files) {
    const sql = (await readFile(`${dir}/${name}`, "utf8")).replace(/--.*$/gm, "");
    assert.doesNotMatch(
      sql,
      /insert\s+into\s+public\.(products|product_variants|product_translations|product_images|orders|order_items|inventory)\b/i,
      name,
    );
    assert.doesNotMatch(sql, /'AED'|'aed'/, `${name} must not carry an AED value`);
    // The only seeded row is the market identity.
    const inserts = sql.match(/insert\s+into\s+[a-z_.]+/gi) ?? [];
    for (const insert of inserts) {
      assert.match(
        insert,
        /commerce_private\.(market_identity|variant_launch_profiles|mx_payment_attempts|integration_webhook_events|shipments|shipment_events)/i,
        `${name}: unexpected seed ${insert}`,
      );
    }
    assert.match(sql, /MX_BOOTSTRAP_REFUSES_NON_EMPTY_DATABASE/);
    assert.match(sql, /MX_BOOTSTRAP_REFUSES_EXISTING_CATALOGUE/);
  }
  // Mexico migrations live apart from the canonical ones, so the canonical
  // replay — which the UAE database shares — never picks them up.
  const canonical = await readdir("supabase/migrations");
  assert.ok(!canonical.some((name) => /cm_mx_/.test(name)));
  // No seed file copies the UAE catalogue.
  const snapshot = JSON.parse(
    await readFile("docs/cornermex-mx/catalog/catalog-snapshot.json", "utf8"),
  );
  assert.ok(Array.isArray(snapshot.rows), "the snapshot is a classification input, not a seed");
  const scripts = await readdir("scripts/cornermex-mx");
  assert.ok(
    !scripts.some((name) => /seed|import|load/i.test(name)),
    "no loader may exist for the UAE snapshot",
  );
});

test("the UAE market is deferred: its order and payment entry points are inert in this build", async () => {
  assert.equal(gate.isUaeMarketActive(), false);
  assert.throws(() => gate.assertUaeMarketActive(), /UAE_MARKET_DEFERRED/);
  assert.throws(
    () => execution.assertCheckoutExecutionEnabled("false"),
    /CHECKOUT_EXECUTION_DISABLED/,
  );
  // Every UAE WRITE entry point is gated on the market right after the checkout
  // gate, so switching checkout on for Mexico cannot wake any of them.
  for (const [file, count] of [
    ["src/lib/orders.functions.ts", 1],
    ["src/lib/payments.functions.ts", 2],
  ]) {
    const source = await readFile(file, "utf8");
    const gated =
      source.match(
        /assertCheckoutExecutionEnabled\(\);\s+(?:\/\/[^\n]*\n\s+)?assertUaeMarketActive\(\);/g,
      ) ?? [];
    assert.equal(gated.length, count, `${file}: UAE write paths must be market-gated`);
  }

  for (const [file, pattern] of [
    ["src/lib/cod-order.functions.ts", /assertUaeMarketActive\(\);/g],
    ["src/lib/card-checkout.functions.ts", /assertUaeMarketActive\(\);/g],
  ]) {
    const source = await readFile(file, "utf8");
    assert.ok((source.match(pattern) ?? []).length >= 1, `${file} must refuse outside a UAE build`);
  }
  const cod = await readFile("src/lib/cod-order.functions.ts", "utf8");
  assert.equal(
    (cod.match(/assertUaeMarketActive\(\);/g) ?? []).length,
    2,
    "order and preview are both gated",
  );
  const stripe = await readFile("src/routes/api/public/stripe-webhook.ts", "utf8");
  assert.match(
    stripe,
    /if \(!isUaeMarketActive\(\)\) return new Response\("Gone", \{ status: 410 \}\);/,
  );
  // History is kept: nothing was deleted.
  for (const file of [
    "src/lib/orders.functions.ts",
    "src/lib/payments.functions.ts",
    "src/lib/legal-docs.ts",
  ]) {
    assert.ok((await readFile(file, "utf8")).length > 0, file);
  }
});

test("the Mexico types are the pinned output of the Mexico project", async () => {
  const { createHash } = await import("node:crypto");
  const contract = JSON.parse(
    await readFile("contracts/cornermex-mx-supabase-types-v1.json", "utf8"),
  );
  const types = await readFile(contract.typesFile, "utf8");
  assert.equal(createHash("sha256").update(types).digest("hex"), contract.typesSha256);
  assert.equal(contract.market, "MX");
  assert.equal(contract.currency, "MXN");
  assert.ok(!(contract.projectRef in guard.NON_MX_SUPABASE_PROJECTS));
  assert.equal(contract.publicTables.length, 22);
  for (const name of [
    "cm_market_identity_v1",
    "cm_mx_create_order_v1",
    "cm_mx_apply_payment_state_v1",
    "cm_mx_reserve_label_v1",
  ]) {
    assert.ok(contract.generatedTypeFunctions.includes(name), name);
    assert.match(types, new RegExp(`^      ${name}: `, "m"));
  }
  // Every Supabase client is typed from the Mexico project, none from the
  // frozen UAE artefact.
  for (const file of [
    "client.ts",
    "client.server.ts",
    "client.readonly.server.ts",
    "client.ssr.server.ts",
    "auth-middleware.ts",
    "optional-auth-middleware.ts",
  ]) {
    const source = await readFile(`src/integrations/supabase/${file}`, "utf8");
    assert.match(source, /import type \{ Database \} from ['"]\.\/types\.mx['"]/, file);
  }
});

test("the bootstrap that built the Mexico database is recorded and self-limiting", async () => {
  const prelude = await readFile("supabase/mx/bootstrap/00_platform_prelude.sql", "utf8");
  const finalize = await readFile("supabase/mx/bootstrap/02_finalize.sql", "utf8");
  assert.match(prelude, /BOOTSTRAP_HASH_MISMATCH/);
  assert.match(prelude, /revoke all on schema cm_mx_bootstrap from public, anon, authenticated/);
  assert.match(finalize, /drop function if exists cm_mx_bootstrap\.apply_file/);
  assert.match(finalize, /force row level security/);
  // Reference data only: no price, product or customer is seeded.
  assert.doesNotMatch(finalize, /insert into public\.(?!categories)/);
  assert.doesNotMatch(finalize, /_aed|product_variants|public\.orders|auth\.users/i);
});

test("CornerOps is refused exactly like a UAE project", () => {
  const cornerOps = "nhxpujypqxbjiqqddxqt";
  assert.throws(
    () => guard.assertBrowserDatabase(`https://${cornerOps}.supabase.co`),
    /CM_MARKET_DATABASE_MISMATCH/,
  );
  const evaluation = guard.evaluateMarketDatabase({
    CORNERMEX_MARKET: "MX",
    CORNERMEX_MX_SUPABASE_PROJECT_REF: cornerOps,
    SUPABASE_URL: `https://${cornerOps}.supabase.co`,
  });
  assert.equal(evaluation.ok, false);
});

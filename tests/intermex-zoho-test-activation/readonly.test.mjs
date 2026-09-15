import test from "node:test";
import assert from "node:assert/strict";
import {
  createZohoReadOnlyProvider,
  reconcileExistingPo,
} from "../../src/lib/zoho-readonly.server.ts";
import { composePo, parsePoText } from "../../src/lib/po/domain.ts";
import { mappings, source, invoice } from "../intermex-po-automation-1/fixture.mjs";
const env = { CORNERMEX_ZOHO_MODE: "test", CORNERMEX_ZOHO_LIVE_WRITES_ENABLED: "false" };
const config = {
  product: "books",
  organizationId: "773588238",
  apiBaseUrl: "https://www.zohoapis.com",
  accessToken: "synthetic",
  vatTaxId: "3142388000000075192",
};
test("read capability has no mutation methods and scopes every GET", async () => {
  const calls = [];
  const provider = createZohoReadOnlyProvider(config, env, async (url, init) => {
    calls.push([url, init]);
    return Response.json({ code: 0, invoice: { invoice_id: "3142388000023527010" } });
  });
  assert.deepEqual(Object.keys(provider), ["findByPo", "getPoInvoice"]);
  await provider.getPoInvoice("3142388000023527010");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].searchParams.get("organization_id"), "773588238");
  assert.equal(calls[0][1].method, "GET");
  assert.equal(calls[0][1].redirect, "error");
});
test("requires explicit false and test; rejects unsafe host before HTTP", () => {
  for (const patch of [
    { CORNERMEX_ZOHO_MODE: "live" },
    { CORNERMEX_ZOHO_LIVE_WRITES_ENABLED: "true" },
    { CORNERMEX_ZOHO_LIVE_WRITES_ENABLED: undefined },
  ])
    assert.throws(
      () => createZohoReadOnlyProvider(config, { ...env, ...patch }),
      /READ_ONLY_CONFIGURATION_REQUIRED/,
    );
  assert.throws(
    () => createZohoReadOnlyProvider({ ...config, apiBaseUrl: "https://example.com" }, env),
    /READ_ONLY_CONFIGURATION_REQUIRED/,
  );
});
test("401 never exchanges or refreshes credentials on read-only path", async () => {
  let count = 0;
  const provider = createZohoReadOnlyProvider(
    {
      ...config,
      refresh: {
        accountsUrl: "https://accounts.zoho.com",
        clientId: "synthetic",
        clientSecret: "synthetic",
        refreshToken: "synthetic",
      },
    },
    env,
    async () => {
      count++;
      return new Response("", { status: 401 });
    },
  );
  await assert.rejects(provider.getPoInvoice("123"), /ZOHO_REFRESH_NOT_CONFIGURED/);
  assert.equal(count, 1);
});
test("absent or duplicate invoice stops without a create fallback", async () => {
  const po = composePo(parsePoText(source), mappings());
  for (const matches of [[], [invoice(po), invoice(po)]]) {
    const result = await reconcileExistingPo(po, {
      findByPo: async () => matches,
      getPoInvoice: async () => {
        throw Error("unexpected GET");
      },
    });
    assert.equal(result.ok, false);
  }
});
test("offline full reconciliation passes and mismatched VAT stops", async () => {
  const po = composePo(parsePoText(source), mappings());
  const actual = invoice(po);
  const provider = { findByPo: async () => [actual], getPoInvoice: async () => actual };
  assert.equal((await reconcileExistingPo(po, provider)).ok, true);
  actual.tax_total = 5.87;
  assert.equal((await reconcileExistingPo(po, provider)).ok, false);
});
test("production organization cannot be relabelled as a test organization", () => {
  assert.throws(
    () => composePo(parsePoText(source), { ...mappings(), organizationId: "773588238" }),
    /TEST_ORGANIZATION_UNVERIFIED/,
  );
});

test("Books tax_reg_no is reconciled and conflicting TRN aliases fail closed", async () => {
  const po = composePo(parsePoText(source), mappings());
  const actual = invoice(po);
  actual.tax_reg_no = actual.vat_reg_no;
  delete actual.vat_reg_no;
  const provider = { findByPo: async () => [actual], getPoInvoice: async () => actual };
  assert.equal((await reconcileExistingPo(po, provider)).ok, true);
  actual.vat_reg_no = "conflict";
  assert.equal((await reconcileExistingPo(po, provider)).ok, false);
  delete actual.vat_reg_no;
  delete actual.tax_reg_no;
  assert.equal((await reconcileExistingPo(po, provider)).ok, false);
});

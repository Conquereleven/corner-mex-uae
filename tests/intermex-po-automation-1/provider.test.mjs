import test from "node:test";
import assert from "node:assert/strict";
import { ZohoAccountingProvider } from "../../src/lib/zoho-accounting.server.ts";
import { handlePoIntake } from "../../src/lib/po/intake-handler.server.ts";
import { composePo, parsePoText } from "../../src/lib/po/domain.ts";
import { source, mappings, invoice } from "./fixture.mjs";
const po = () => composePo(parsePoText(source), mappings());
const config = {
  product: "books",
  organizationId: "offline-fixture-org",
  apiBaseUrl: "https://www.zohoapis.com",
  accessToken: "offline",
  vatTaxId: "fixture-vat",
};
const response = (b) => Response.json({ code: 0, ...b });
test("Books paginates before deciding absence and recognizes historical store typo", async () => {
  const p = po(),
    seen = [];
  const provider = new ZohoAccountingProvider(config, async (url) => {
    seen.push(url.href);
    assert.equal(url.searchParams.get("organization_id"), config.organizationId);
    if (url.pathname.endsWith("fixture-invoice"))
      return response({
        invoice: {
          ...invoice(p),
          reference_number: "B202609-37789 AJMAN CITY CENTRE CINEME STORE",
        },
      });
    assert.equal(url.searchParams.get("customer_id"), p.payload.customer_id);
    return url.searchParams.get("page") === "1"
      ? response({ invoices: [], page_context: { has_more_page: true } })
      : response({
          invoices: [
            {
              invoice_id: "fixture-invoice",
              customer_id: p.payload.customer_id,
              reference_number: "B202609-37789 AJMAN CITY CENTRE CINEME STORE",
            },
          ],
          page_context: { has_more_page: false },
        });
  });
  assert.equal((await provider.findByPo(p)).length, 1);
  assert.equal(seen.length, 3);
});
test("Books rejects incomplete pagination and scope mismatch without POST", async () => {
  let calls = 0;
  const provider = new ZohoAccountingProvider(config, async () => {
    calls++;
    return response({ invoices: [] });
  });
  await assert.rejects(provider.findByPo(po()), { code: "INVOICE_SEARCH_INCOMPLETE" });
  await assert.rejects(provider.findByPo({ ...po(), organizationId: "wrong" }), {
    code: "ZOHO_PO_SCOPE_MISMATCH",
  });
  assert.equal(calls, 1);
});
test("composer POST is unsent and leaves invoice numbering to Books", async () => {
  const p = po();
  const provider = new ZohoAccountingProvider(config, async (url, init) => {
    assert.equal(init.method, "POST");
    assert.equal(url.searchParams.get("send"), "false");
    const payload = JSON.parse(init.body);
    assert.deepEqual(payload, p.payload);
    assert.equal(payload.invoice_number, undefined);
    return response({ invoice: invoice(p) });
  });
  assert.equal((await provider.createPoInvoice(p)).invoice_id, "fixture-invoice");
});
test("intake endpoint rejects disabled, unauthorized, cross-mode and malformed requests", async () => {
  let calls = 0;
  const submit = async () => {
    calls++;
    return { id: "offline" };
  };
  const env = {
    CORNERMEX_PO_INTAKE_ENABLED: "true",
    CORNERMEX_PO_INTAKE_SECRET: "offline",
    CORNERMEX_PO_MODE: "test",
    CORNERMEX_PO_ORGANIZATION_ID: "offline-fixture-org",
  };
  const body = {
    mode: "test",
    organizationId: "offline-fixture-org",
    source: "email",
    sourceId: "message:part1",
    mime: "text/plain",
    documentBase64: Buffer.from(source).toString("base64"),
  };
  const req = (patch = {}, token = "offline") =>
    new Request("https://example.test/intake", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ...body, ...patch }),
    });
  assert.equal((await handlePoIntake(req(), {}, submit)).status, 503);
  assert.equal((await handlePoIntake(req({}, "bad"), env, submit)).status, 401);
  assert.equal((await handlePoIntake(req({ mode: "live" }), env, submit)).status, 403);
  assert.equal((await handlePoIntake(req({ source: "admin" }), env, submit)).status, 403);
  assert.equal((await handlePoIntake(req({ mime: "image/png" }), env, submit)).status, 400);
  assert.equal(calls, 0);
  assert.equal((await handlePoIntake(req(), env, submit)).status, 202);
  assert.equal(calls, 1);
});

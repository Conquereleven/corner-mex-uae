import test from "node:test";
import assert from "node:assert/strict";
import {
  cardCapability,
  cumulativeRefund,
  attemptAnomalies,
  stripeKeyMatchesMode,
} from "../../src/lib/operational-payments.ts";
import { safeInvoiceUrl, sanitizeInvoice } from "../../src/lib/invoice-projection.ts";
import { ZohoTokenSource } from "../../src/lib/zoho-token.server.ts";
import { ZohoAccountingProvider } from "../../src/lib/zoho-accounting.server.ts";
const refresh = {
  accountsUrl: "https://accounts.zoho.com",
  clientId: "offline",
  clientSecret: "offline",
  refreshToken: "offline",
};
const config = {
  product: "books",
  organizationId: "offline",
  apiBaseUrl: "https://www.zohoapis.com",
  accessToken: "expired",
  vatTaxId: "offline",
  refresh,
};
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
test("capability requires schema, fresh gate, explicit same mode and server readiness", () => {
  const value = {
    schemaVersion: 2,
    gate: {
      enabled: true,
      mode: "test",
      generation: "offline",
      validUntil: "2030-01-01",
      eligibleAfter: "2026-01-01",
    },
    mode: "test",
    secretMatches: true,
    webhookConfigured: true,
    enabled: true,
    now: Date.parse("2026-09-12"),
  };
  assert.equal(cardCapability(value), true);
  for (const patch of [
    { schemaVersion: 1 },
    { gate: undefined },
    { mode: "live" },
    { secretMatches: false },
    { webhookConfigured: false },
    { enabled: false },
    { now: Date.parse("2031-01-01") },
  ])
    assert.equal(Boolean(cardCapability({ ...value, ...patch })), false);
  assert.equal(stripeKeyMatchesMode(["sk", "test", "offline"].join("_"), "live"), false);
});
test("partial refund cumulative arithmetic is monotonic and rejects invalid bounds", () => {
  assert.deepEqual(cumulativeRefund(4200, 1000, 2000), { refunded: 2000, kind: "partial" });
  assert.deepEqual(cumulativeRefund(4200, 2000, 1000), { refunded: 2000, kind: "partial" });
  assert.deepEqual(cumulativeRefund(4200, 4200, 4200), { refunded: 4200, kind: "full" });
  for (const amount of [-1, 4201, 1.5, NaN]) assert.throws(() => cumulativeRefund(4200, 0, amount));
  assert.deepEqual(
    attemptAnomalies(
      [
        { mode: "test", captured: 42, refunded: 0 },
        { mode: "live", captured: 42, refunded: 0 },
      ],
      "test",
    ),
    ["provider_mode_mismatch", "multiple_successful_attempts"],
  );
});
test("invoice URLs fail closed without an explicit safe host and never project credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://evil.invalid/a",
    ["https://user:secret", "invoice.invalid/a"].join("@"),
    "https://invoice.invalid/a?access_token=x",
  ])
    assert.equal(safeInvoiceUrl(url, ["invoice.invalid"]), null);
  assert.equal(safeInvoiceUrl("https://invoice.invalid/document", []), null);
  assert.equal(
    safeInvoiceUrl("https://invoice.invalid/document", ["invoice.invalid"]),
    "https://invoice.invalid/document",
  );
  const projected = sanitizeInvoice(
    {
      reference: "order",
      number: "1",
      status: "issued",
      issuedDate: "bad",
      url: null,
      pdfSupported: false,
      accessToken: "hidden",
    },
    [],
  );
  assert.equal(projected.issuedDate, null);
  assert.equal("accessToken" in projected, false);
});
test("concurrent token refresh uses one request and revoked credentials require attention", async () => {
  let calls = 0;
  const token = new ZohoTokenSource("expired", refresh, async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return response({ access_token: "fresh" });
  });
  assert.deepEqual(await Promise.all([token.refresh("expired"), token.refresh("expired")]), [
    "fresh",
    "fresh",
  ]);
  assert.equal(calls, 1);
  for (const [status, body, category, retryable] of [
    [400, { error: "invalid_grant" }, "auth", false],
    [429, {}, "rate_limit", true],
    [503, {}, "provider_unavailable", true],
  ]) {
    const bad = new ZohoTokenSource("expired", refresh, async () => response(body, status));
    await assert.rejects(
      bad.refresh("expired"),
      (e) => e.category === category && e.retryable === retryable,
    );
  }
});
test("provider refresh is bounded and retries an expired access token without duplicate creation", async () => {
  const calls = [];
  const provider = new ZohoAccountingProvider(config, async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    if (String(url).includes("/oauth/")) return response({ access_token: "fresh" });
    if (new Headers(init.headers).get("Authorization").endsWith("expired"))
      return response({}, 401);
    return response({ code: 0, contact: { contact_id: "one" } });
  });
  assert.deepEqual(
    await provider.createCustomer({
      localId: "local",
      displayName: "Offline",
      email: ["fixture", "example.invalid"].join("@"),
    }),
    { id: "one" },
  );
  assert.equal(calls.length, 3);
  let count = 0;
  const rejected = new ZohoAccountingProvider(config, async (url) => {
    count++;
    return String(url).includes("/oauth/")
      ? response({ access_token: "still-rejected" })
      : response({}, 401);
  });
  await assert.rejects(rejected.getInvoice("one"), (e) => e.category === "auth" && !e.retryable);
  assert.equal(count, 3);
});
test("provider unavailability and rate limits preserve retry classification", async () => {
  for (const status of [429, 503]) {
    const provider = new ZohoAccountingProvider(config, async () => response({}, status));
    await assert.rejects(
      provider.getInvoice("offline"),
      (e) => e.retryable && e.category === (status === 429 ? "rate_limit" : "provider_unavailable"),
    );
  }
});

test("ambiguous customer create never duplicates while provider lookup is inconclusive", async () => {
  const { processOrderToInvoice } = await import("../../src/lib/accounting-integration.ts");
  const order = {
    orderId: "order",
    orderNumber: "offline",
    orderStatus: "confirmed",
    paymentStatus: "pending",
    paymentProvider: null,
    paymentReference: null,
    paymentPaidAt: null,
    customer: {
      localId: "buyer",
      displayName: "Offline",
      email: ["fixture", "example.invalid"].join("@"),
    },
    lines: [{ localId: "line", name: "Fixture", quantity: 1, unitPriceAed: 42, lineTotalAed: 42 }],
    subtotalAed: 42,
    shippingAed: 0,
    discountAed: 0,
    taxAed: 0,
    totalAed: 42,
    currency: "AED",
    createdAt: "2026-09-12T00:00:00Z",
  };
  const intents = new Set();
  let creates = 0;
  const store = {
    getMapping: async () => null,
    saveMapping: async () => {},
    audit: async () => {},
    beginProviderCreate: async (key) => {
      if (intents.has(key)) return false;
      intents.add(key);
      return true;
    },
  };
  const provider = {
    findCustomer: async () => [],
    createCustomer: async () => {
      creates++;
      throw new Error("remote create succeeded but response was lost");
    },
  };
  await assert.rejects(processOrderToInvoice({ correlationId: "offline", order, provider, store }));
  await assert.rejects(
    processOrderToInvoice({ correlationId: "offline", order, provider, store }),
    (e) => e.safeCode === "CUSTOMER_CREATE_OUTCOME_UNCERTAIN" && !e.retryable,
  );
  assert.equal(creates, 1);
});

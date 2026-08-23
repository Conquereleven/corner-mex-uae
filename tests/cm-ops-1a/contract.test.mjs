import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { INVENTORY_REASON_CODES } from "../../src/lib/inventory-intelligence.ts";

test("the durable contract records exact formulas, read-only behavior, and no migration", async () => {
  const contract = JSON.parse(
    await readFile("contracts/cm-ops-1a-inventory-intelligence-v1.json", "utf8"),
  );
  assert.equal(contract.contractVersion, "cm-inventory-intelligence-v1");
  assert.equal(contract.formulas.availableStock, "quantityOnHand - quantityReserved");
  assert.equal(contract.formulas.reorderPoint, "demandDuringLeadTime + safetyStock");
  assert.equal(contract.readIntegration.mode, "server-side batch repository");
  assert.equal(contract.readIntegration.browserPrivatePolicyExposure, false);
  assert.deepEqual(contract.reasonCodes, INVENTORY_REASON_CODES);
  assert.equal(contract.migration, null);
  assert.ok(Object.values(contract.sideEffects).every((value) => value === false));
});

test("CM-OPS-1A source contains no write path or purchase-order creation", async () => {
  const sources = await Promise.all(
    ["src/lib/inventory-intelligence.ts", "src/lib/inventory-intelligence.service.ts"].map((path) =>
      readFile(path, "utf8"),
    ),
  );
  const source = sources.join("\n");
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|createPurchaseOrder/i);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY|oauth|railway/i);
  assert.match(source, /createsPurchaseOrder: false/);
});

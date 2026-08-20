import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260820214500_cm_launch_1_l5r_quote_draft_integrity.sql";

test("L5R quote drafts are shape-locked at storage", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const requiredKeys = [
    "items_summary",
    "delivery_fee_aed",
    "vat_treatment",
    "availability_note",
    "valid_until",
    "payment_terms",
    "recipient",
    "notes",
  ];

  assert.match(migration, /b2b_leads_quote_draft_object_check/);
  assert.match(migration, /quote_draft \?& array/);
  assert.match(migration, /quote_draft - array/);
  assert.match(migration, /jsonb_typeof\(quote_draft\) = 'object'/);
  assert.match(migration, /delivery_fee_aed'[\s\S]*between 0 and 999999/);
  assert.match(migration, /items_summary'[\s\S]*<= 8000/);
  assert.match(migration, /valid_until'[\s\S]*\\d\{4\}-\\d\{2\}-\\d\{2\}/);

  for (const key of requiredKeys) {
    assert.match(migration, new RegExp(`'${key}'`));
  }
});

test("L5R quote integrity migration stays unapplied and Founder-gated", async () => {
  const extension = JSON.parse(
    await readFile("contracts/canonical-active-migration-extensions-v1.json", "utf8"),
  );
  const entry = extension.migrations.find(
    ({ filename }) => filename === "20260820214500_cm_launch_1_l5r_quote_draft_integrity.sql",
  );

  assert.ok(entry);
  assert.equal(entry.owner, "canonical_cornermex");
  assert.equal(entry.productionApplied, false);
  assert.equal(entry.requiresFounderProductionGate, true);
});

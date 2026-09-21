// Legal review is complete (FD-CM-LEGAL-REVIEW-001, Founder-attested
// 2026-09-20). Customer-facing documents must not present themselves as
// unreviewed templates, and the still-unfinished Seller Agreement must not
// claim approval it does not have.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(p, "utf8");

test("the customer-facing documents are approved and the Phase 2 draft is not", async () => {
  // Parsed from source: the module uses "@/" import aliases that plain node
  // cannot resolve, and every other suite here reads these files as text.
  const source = await read("src/lib/legal-docs.ts");
  const entries = [
    ...source.matchAll(/slug: "([a-z-]+)",[\s\S]{0,600}?reviewStatus: "([A-Za-z ]+)"/g),
  ].map((m) => ({ slug: m[1], status: m[2] }));
  assert.ok(entries.length >= 10, `found ${entries.length} documents`);
  for (const { slug, status } of entries) {
    if (slug === "seller-agreement") {
      assert.equal(status, "Draft", "a Phase 2 marketplace draft is not approved");
    } else {
      assert.equal(status, "Approved", `${slug} must be approved`);
    }
  }
  assert.match(source, /legalReviewStatus: "Approved" as ReviewStatus/);
});

test("no customer-facing surface still claims the documents are unreviewed", async () => {
  for (const path of [
    "src/lib/legal-docs.ts",
    "src/components/site/LegalDocPage.tsx",
    "src/routes/terms.tsx",
    "src/routes/legal.index.tsx",
    "src/routes/privacy.tsx",
    "src/routes/returns.tsx",
    "src/routes/_authenticated/admin.legal.tsx",
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /working template/i, path);
    assert.doesNotMatch(source, /must be reviewed by qualified/i, path);
    assert.doesNotMatch(source, /pending review by qualified/i, path);
    // The string may still appear as a type member in legal-docs.ts.
    if (path !== "src/lib/legal-docs.ts") {
      assert.doesNotMatch(source, /Legal Review Required/i, path);
    }
  }
});

test("the founder decision record states its evidence limits and invents nothing", async () => {
  const record = await read(
    "docs/engineering-playbook/founder-decisions/FD-CM-LEGAL-REVIEW-001.md",
  );
  assert.match(record, /FOUNDER-ATTESTED/);
  assert.match(record, /does \*\*not\*\* name counsel/i);
  assert.match(record, /Seller Agreement stays `Draft`/);
  // No fabricated approval evidence.
  assert.doesNotMatch(record, /law firm|advocates|reviewed by [A-Z][a-z]+ [A-Z]/);
});

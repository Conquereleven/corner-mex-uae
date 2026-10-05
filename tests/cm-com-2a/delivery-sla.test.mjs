// The storefront may only show delivery timeframes the Terms already promise.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sla = await import("../../src/lib/delivery-sla.ts");

test("displayed delivery windows match the Terms & Conditions", async () => {
  const legal = await readFile("src/lib/legal-docs.ts", "utf8");
  const line = legal.split("\n").find((l) => /"Delivery: express/.test(l));
  assert.ok(line, "Terms delivery service-level sentence must exist");
  const standard = line.match(/standard UAE (\d+)-(\d+) business days/);
  const remote = line.match(/remote areas \+(\d+)-(\d+) business days/);
  assert.ok(standard && remote, line);
  assert.deepEqual(
    { ...sla.STANDARD_DELIVERY_BUSINESS_DAYS },
    { min: +standard[1], max: +standard[2] },
  );
  assert.deepEqual(
    { ...sla.REMOTE_AREA_EXTRA_BUSINESS_DAYS },
    { min: +remote[1], max: +remote[2] },
  );
  assert.match(line, /subject to courier capacity/);
});

test("the estimate is worded as an estimate, never a guarantee, and omits express", () => {
  const text = sla.deliveryEstimateText();
  assert.match(
    text,
    /^Estimated delivery: 2–5 business days \(remote areas \+1–3\), subject to courier capacity\.$/,
  );
  assert.doesNotMatch(text, /guarantee|express|same[- ]day/i);
});

// The 2–5 business day window above is the UAE Terms' promise (deferred market).
// In Mexico the estimate is per shipping option and comes from the carrier
// quote, so no active surface may show the UAE window.
test("no active surface shows the UAE delivery window", async () => {
  for (const path of [
    "src/routes/checkout.tsx",
    "src/routes/order-confirmed.tsx",
    "src/routes/delivery.tsx",
  ]) {
    assert.doesNotMatch(await readFile(path, "utf8"), /deliveryEstimateText|delivery-sla/, path);
  }
  const checkout = await readFile("src/routes/checkout.tsx", "utf8");
  assert.match(checkout, /option\.deliveryEstimate/, "the estimate is the selected option's own");
});

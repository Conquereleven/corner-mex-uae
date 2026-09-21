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

test("checkout, order confirmation and the delivery page show the estimate", async () => {
  for (const path of [
    "src/routes/checkout.tsx",
    "src/routes/order-confirmed.tsx",
    "src/routes/delivery.tsx",
  ]) {
    assert.match(await readFile(path, "utf8"), /deliveryEstimateText\(\)/, path);
  }
  const delivery = await readFile("src/routes/delivery.tsx", "utf8");
  const live = delivery.slice(
    delivery.indexOf("ONLINE_ORDERING_ENABLED ?"),
    delivery.indexOf(") : ("),
  );
  assert.match(
    live,
    /deliveryEstimateText\(\)/,
    "the delivery page shows it only when ordering is open",
  );
});

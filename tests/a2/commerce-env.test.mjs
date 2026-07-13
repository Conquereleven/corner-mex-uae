import assert from "node:assert/strict";
import test from "node:test";

import { getCommerceSafetyStatus, validateCommerceEnvironment } from "../../src/config/commerce-env.ts";

test("commerce capabilities fail closed", () => {
  const status = getCommerceSafetyStatus({});
  assert.equal(status.commerceModel, "single_merchant");
  assert.equal(status.marketplaceEnabled, false);
  assert.equal(status.sellerAuthEnabled, false);
  assert.equal(status.sellerPayoutsEnabled, false);
  assert.equal(status.commissionsEnabled, false);
  assert.equal(status.checkoutEnabled, false);
  assert.equal(status.externalEmailEnabled, false);
  assert.equal(status.realPaymentExecutionEnabled, false);
});

test("target configuration is required and client secrets are rejected", () => {
  const missing = validateCommerceEnvironment({});
  assert.equal(missing.valid, false);
  assert.deepEqual(missing.missing, ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]);

  const leaked = validateCommerceEnvironment({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public-key",
    VITE_SUPABASE_SERVICE_ROLE_KEY: "forbidden",
  });
  assert.equal(leaked.valid, false);
  assert.match(leaked.errors[0], /server_secret_exposed/);
});

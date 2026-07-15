import { assert, readJson, stableStringify } from "./lib.mjs";

export const REQUIRED_CALLBACKS = Object.freeze([
  "auth_site_url",
  "auth_redirect_allowlist",
  "password_reset_callback",
  "oauth_callbacks",
  "stripe_webhook",
  "payment_success_url",
  "payment_cancel_url",
  "email_confirmation_url",
  "railway_public_url",
  "future_custom_domain",
  "api_health_readiness",
  "lovable_callback_dependency",
]);

const SECRET_PATTERN =
  /(?:sk_(?:live|test)|whsec|sb_secret|service_role|Bearer\s|postgres(?:ql)?:\/\/)/i;

export async function validateCallbackInventory(inventory) {
  inventory ??= await readJson("contracts/cornermex-callback-inventory-v1.json");
  assert(
    inventory.contractVersion === "cornermex-callback-inventory-v1",
    "CALLBACK_CONTRACT_MISMATCH",
  );
  assert(inventory.containsSecretValues === false, "CALLBACK_CONTRACT_CONTAINS_SECRETS");
  const ids = inventory.entries.map(({ id }) => id);
  assert(new Set(ids).size === ids.length, "DUPLICATE_CALLBACK_ENTRY");
  for (const id of REQUIRED_CALLBACKS) assert(ids.includes(id), `MISSING_CALLBACK_${id}`);
  assert(
    ids.every((id) => REQUIRED_CALLBACKS.includes(id)),
    "UNEXPECTED_CALLBACK_ENTRY",
  );
  for (const entry of inventory.entries) {
    for (const field of [
      "owner",
      "classification",
      "futureTarget",
      "status",
      "validationMethod",
      "cutoverStep",
      "rollbackStep",
      "blocker",
    ]) {
      assert(
        typeof entry[field] === "string" && entry[field].length > 0,
        `CALLBACK_${entry.id}_${field}_MISSING`,
      );
    }
    assert(
      typeof entry.founderDecisionRequired === "boolean",
      `CALLBACK_${entry.id}_DECISION_INVALID`,
    );
  }
  assert(!SECRET_PATTERN.test(stableStringify(inventory)), "CALLBACK_SECRET_VALUE_DETECTED");
  return { status: "a3_2a_callback_inventory_valid", entries: ids.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateCallbackInventory()));
}

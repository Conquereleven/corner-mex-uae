import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
test("actual checkout handler recovers a created session after response loss using the same durable attempt", async () => {
  const order = {
    id: "11111111-1111-4111-8111-111111111111",
    buyer_id: "buyer",
    payment_method: "card",
    status: "pending",
    payment_status: "pending",
    total_aed: 42,
  };
  const attempt = {
    payment_id: "22222222-2222-4222-8222-222222222222",
    order_id: order.id,
    order_number: "offline",
    amount_aed: 42,
    provider_reference: "stripe-attempt:offline",
    provider_mode: "test",
    created_at: new Date().toISOString(),
  };
  let remote = null,
    creates = 0,
    requests = 0,
    binds = 0;
  const db = {
    from() {
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    single: async () => ({ data: order }),
    async rpc(name, args) {
      if (name === "cm_pay_create_stripe_attempt_v2") return { data: { ...attempt } };
      if (name === "cm_pay_bind_stripe_session_v2") {
        binds++;
        attempt.provider_reference = args.p_session_id;
      }
      return { data: {}, error: null };
    },
  };
  class Unavailable extends Error {}
  const deps = {
    "@tanstack/react-start": {
      createServerFn: () => ({
        middleware() {
          return this;
        },
        inputValidator() {
          return this;
        },
        handler(fn) {
          return fn;
        },
      }),
    },
    "@/integrations/supabase/auth-middleware": { requireSupabaseAuth: {} },
    "@/integrations/supabase/client.server": { supabaseAdmin: db },
    "@/lib/stripe-checkout-provider.server": {
      PaymentProviderUnavailableError: Unavailable,
      createStripeClient: async () => ({
        mode: "test",
        applicationUrl: "https://example.invalid",
        stripe: {
          checkout: {
            sessions: {
              async create(payload, options) {
                requests++;
                assert.equal(options.idempotencyKey, `cm-pay-stripe-attempt-${attempt.payment_id}`);
                if (!remote) {
                  creates++;
                  remote = {
                    id: "cs_offline",
                    url: "https://checkout.stripe.com/offline",
                    status: "open",
                    livemode: false,
                    currency: "aed",
                    amount_total: 4200,
                    metadata: payload.metadata,
                    payment_intent: null,
                  };
                  throw new Error("response lost");
                }
                return remote;
              },
              async retrieve() {
                return remote;
              },
            },
          },
        },
      }),
    },
    "@/lib/card-capability.server": { readCardCapability: async () => ({ available: true }) },
    "@/lib/operational-payments": {},
    "@/lib/payment-state": {},
    "@/lib/checkout-execution.server": { assertCheckoutExecutionEnabled() {} },
  };
  const compiled = ts.transpileModule(readFileSync("src/lib/payments.functions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, (name) => deps[name] ?? require(name));
  const call = () =>
    exports.createStripeSession({ data: { orderId: order.id }, context: { userId: "buyer" } });
  await assert.rejects(call(), Unavailable);
  assert.equal(binds, 0);
  assert.equal((await call()).url, remote.url);
  assert.equal(creates, 1);
  assert.equal(requests, 2);
  assert.equal(binds, 1);
  assert.equal((await call()).url, remote.url);
  assert.equal(requests, 2);
  assert.equal(creates, 1);
  remote = { ...remote, livemode: true };
  await assert.rejects(call(), Unavailable);
  assert.equal(binds, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import Stripe from "stripe";
import { verifyStripeWebhookEvent } from "../../src/lib/stripe-webhook-verification.ts";
import * as operationalPayments from "../../src/lib/operational-payments.ts";
const require = createRequire(import.meta.url);

test("actual webhook handler reads environment and verifies raw signature before database persistence", async () => {
  const calls = [];
  const source = readFileSync("src/routes/api/public/stripe-webhook.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  const database = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { error: null };
    },
  };
  const dependencies = {
    "@/lib/operational-payments": operationalPayments,
    "@tanstack/react-router": { createFileRoute: () => (config) => config },
    "@/integrations/supabase/client.server": { supabaseAdmin: database },
    "@/lib/stripe-webhook-verification": { verifyStripeWebhookEvent },
  };
  new Function("exports", "require", compiled)(
    exports,
    (name) => dependencies[name] ?? require(name),
  );
  const handler = exports.Route.server.handlers.POST;
  const modePrior = process.env.CORNERMEX_STRIPE_MODE;
  process.env.CORNERMEX_STRIPE_MODE = "test";
  const prior = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "offline-route-signing-key";
  try {
    const stripe = new Stripe("sk_webhook_verification_only");
    const body = JSON.stringify({
      id: "evt_route",
      livemode: false,
      type: "checkout.session.completed",
      created: 1789171200,
      data: {
        object: {
          object: "checkout.session",
          id: "cs_test_route",
          currency: "aed",
          amount_total: 4200,
          payment_status: "paid",
          payment_intent: "pi_route",
          metadata: {
            order_id: "11111111-1111-4111-8111-111111111111",
            payment_attempt_id: "22222222-2222-4222-8222-222222222222",
          },
        },
      },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    const request = (payload, sig) =>
      new Request("https://example.invalid/api/public/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": sig },
        body: payload,
      });
    assert.equal((await handler({ request: request(body, "invalid") })).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await handler({ request: request(body, signature) })).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "cm_pay_process_stripe_webhook_v2");
    assert.equal(calls[0].args.p_amount_aed, 42);
    database.rpc = async () => ({ error: { message: "offline failure" } });
    assert.equal((await handler({ request: request(body, signature) })).status, 500);
  } finally {
    if (modePrior === undefined) delete process.env.CORNERMEX_STRIPE_MODE;
    else process.env.CORNERMEX_STRIPE_MODE = modePrior;
    if (prior === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prior;
  }
});

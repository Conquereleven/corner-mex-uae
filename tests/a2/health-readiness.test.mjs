import assert from "node:assert/strict";
import test from "node:test";

import { getHealthPayload } from "../../src/routes/api/health.ts";
import { getReadinessResponse } from "../../src/routes/api/ready.ts";

test("health is side-effect free and contains no environment values", () => {
  const payload = getHealthPayload({ RAILWAY_GIT_COMMIT_SHA: "1234567890abcdef", SECRET: "never" });
  assert.equal(payload.status, "ok");
  assert.equal(payload.commit, "1234567890ab");
  assert.doesNotMatch(JSON.stringify(payload), /never/);
});

test("readiness fails safely when configuration is absent", async () => {
  const response = await getReadinessResponse({}, async () => {
    throw new Error("must not call network");
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(body.missing, ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]);
});

test("readiness reports ready for a bounded successful target check", async () => {
  const response = await getReadinessResponse(
    { SUPABASE_URL: "https://target.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" },
    async () => new Response("[]", { status: 200 }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ready");
});

test("readiness sanitizes target failures", async () => {
  const response = await getReadinessResponse(
    { SUPABASE_URL: "https://target.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" },
    async () => {
      throw new Error("raw database failure with secret material");
    },
  );
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /raw database|secret material/);
});

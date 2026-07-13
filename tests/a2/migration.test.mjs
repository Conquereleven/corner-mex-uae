import test from "node:test";
import { execFileSync } from "node:child_process";

test("A2 migration passes the deterministic safety validator", () => {
  execFileSync(process.execPath, ["scripts/validate-commerce-foundation-a2.mjs"], { stdio: "pipe" });
});

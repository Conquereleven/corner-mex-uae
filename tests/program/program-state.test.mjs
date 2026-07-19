import test from "node:test";
import assert from "node:assert/strict";
import { validateProgramState } from "../../scripts/program/validate-program-state.mjs";

test("durable program state is internally consistent and fail-closed", () => {
  const result = validateProgramState();
  assert.equal(result.status, "program_state_valid");
  assert.equal(result.railwayContexts, 2);
  assert.equal(result.productionWrites, 0);
});

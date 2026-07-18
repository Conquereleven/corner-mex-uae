import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { buildRollbackPreview, verifyEphemeralRollback } from "./rollback.mjs";
const command = process.argv[2],
  target = process.env.CATALOG_ROLLBACK_TARGET_PROJECT,
  executionId = process.env.CATALOG_IMPORT_EXECUTION_ID;
if (!executionId) throw new Error("ROLLBACK_EXECUTION_ID_REQUIRED");
if (command === "preview") {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.resolve(
        process.env.CATALOG_ROLLBACK_FIXTURE || "tests/fixtures/catalog/rollback.synthetic.json",
      ),
    ),
  );
  process.stdout.write(
    `${JSON.stringify(buildRollbackPreview({ executionId, targetProject: target, ...fixture }), null, 2)}\n`,
  );
} else if (command === "verify") {
  if (process.env.CATALOG_ROLLBACK_TEST_MODE !== "ephemeral")
    throw new Error("PRODUCTION_ROLLBACK_ADAPTER_NOT_CONFIGURED");
  if (!process.env.TEST_DATABASE_URL) throw new Error("EPHEMERAL_DATABASE_REQUIRED");
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    process.stdout.write(
      `${JSON.stringify(await verifyEphemeralRollback(client, { executionId, targetProject: target }), null, 2)}\n`,
    );
  } finally {
    await client.end();
  }
} else throw new Error("UNKNOWN_ROLLBACK_COMMAND");

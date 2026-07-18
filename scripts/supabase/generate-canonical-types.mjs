import { createHash } from "node:crypto";
import { copyFile, readFile } from "node:fs/promises";

const expectedRef = "wlrfknmrhowldygmvtvn";
const suppliedRef = process.env.CANONICAL_SUPABASE_PROJECT_REF ?? expectedRef;
if (suppliedRef !== expectedRef)
  throw new Error("Refusing type generation for a non-canonical project");

const inputIndex = process.argv.indexOf("--input");
if (inputIndex < 0 || !process.argv[inputIndex + 1]) {
  throw new Error(
    "Provide read-only generated output with --input <path>; this script never reads database credentials",
  );
}
const input = process.argv[inputIndex + 1];
const generated = await readFile(input, "utf8");
if (!generated.includes("export type Database"))
  throw new Error("Input is not Supabase TypeScript output");
await copyFile(input, "src/integrations/supabase/types.ts");
console.log(
  `canonical types installed: project=${expectedRef}, sha256=${createHash("sha256").update(generated).digest("hex")}`,
);

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = ".output/public";
const files = [];
const walk = async (target) => {
  const info = await stat(target);
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) await walk(path.join(target, entry));
  } else files.push(target);
};
await walk(root);

const errors = [];
let publicAnonJwtCount = 0;
for (const file of files) {
  let source;
  try {
    source = await readFile(file, "utf8");
  } catch {
    continue;
  }
  if (/sb_secret_[A-Za-z0-9_-]{12,}/.test(source))
    errors.push(`Supabase secret key in browser bundle: ${file}`);
  for (const match of source.matchAll(
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  )) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split(".")[1], "base64url").toString("utf8"));
      if (payload.role === "anon") publicAnonJwtCount += 1;
      else errors.push(`non-anon JWT in browser bundle: ${file}`);
    } catch {
      errors.push(`unclassifiable JWT-like value in browser bundle: ${file}`);
    }
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `browser secret scan valid: files=${files.length}, publicAnonJwt=${publicAnonJwtCount}, serviceRoleSecrets=0`,
);

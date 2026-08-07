import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const source = (file) => readFileSync(resolve(root, file), "utf8");
const requireMatch = (file, pattern, message) => {
  if (!pattern.test(source(file))) failures.push(`${file}: ${message}`);
};
const rejectMatch = (file, pattern, message) => {
  if (pattern.test(source(file))) failures.push(`${file}: ${message}`);
};

const vite = "vite.config.ts";
requireMatch(vite, /this\.environment\.name === "client"/, "async-hooks shim must be client-only");
requireMatch(
  vite,
  /configEnvironment\(environmentName\)[\s\S]*environmentName !== "client"[\s\S]*resolve:[\s\S]*["']node:async_hooks["']:[\s\S]*optimizeDeps:[\s\S]*@tanstack\/start-client-core/,
  "async-hooks resolution and dependency optimization must be client-scoped",
);
rejectMatch(
  vite,
  /vite:\s*\{\s*resolve:\s*\{[\s\S]{0,300}["']node:async_hooks["']/,
  "global async-hooks alias is forbidden",
);

const shop = "src/routes/shop.tsx";
requireMatch(
  shop,
  /products\.isError[\s\S]*catalogue is temporarily unavailable/i,
  "Shop error state missing",
);
requireMatch(shop, /products\.refetch\(\)/, "product Retry must refetch");
requireMatch(
  shop,
  /products\.isSuccess && productItems\.length === 0/,
  "empty state must require success",
);
requireMatch(
  shop,
  /cats\.isError \|\| facets\.isError/,
  "category and facet failures must be handled",
);
rejectMatch(shop, /mock product|fallback catalog/i, "mock or fallback catalogue data is forbidden");

const login = "src/routes/login.tsx";
requireMatch(login, /signInWithPassword/, "email and password login must remain");
requireMatch(login, /supabase\.auth\.signInWithOAuth/, "direct Supabase OAuth is required");
requireMatch(login, /provider: "google"/, "Google OAuth provider is required");
requireMatch(login, /new URL\("\/auth\/callback"/, "internal callback URL is required");
rejectMatch(login, /lovableAuth|integrations\/lovable/i, "Lovable OAuth is forbidden");

const callback = "src/routes/auth.callback.tsx";
requireMatch(callback, /exchangeCodeForSession\(search\.code\)/, "PKCE code exchange is required");
requireMatch(
  callback,
  /safeInternalRedirect\(search\.redirect/,
  "callback redirect must fail closed",
);
rejectMatch(
  callback,
  /access_token|refresh_token|provider_token/,
  "callback must not render tokens",
);

const checkout = "src/routes/checkout.tsx";
for (const field of [
  "recipient-name",
  "phone",
  "emirate",
  "area",
  "street",
  "building",
  "floor-apartment",
  "landmark",
  "notes",
]) {
  requireMatch(checkout, new RegExp(`id="checkout-${field}"`), `${field} needs a stable id`);
}
for (const name of [
  "recipient_name",
  "phone",
  "emirate",
  "area",
  "street",
  "building",
  "floor_apt",
  "landmark",
  "notes",
]) {
  requireMatch(checkout, new RegExp(`name="${name}"`), `${name} needs a form name`);
}
requireMatch(checkout, /htmlFor=\{id\}/, "delivery labels must target their controls");
requireMatch(
  checkout,
  /aria-labelledby="checkout-emirate-label"/,
  "custom Select needs an accessible label",
);
requireMatch(checkout, /grid min-w-0 max-w-full/, "checkout grid needs a bounded mobile width");
requireMatch(
  checkout,
  /VITE_CORNERMEX_CHECKOUT_ENABLED === "true"/,
  "client gate must remain exact",
);

const b2bActions = "src/components/b2b/ManualContactActions.tsx";
requireMatch(b2bActions, /role="status" aria-live="polite"/, "copy feedback must be announced");
requireMatch(
  b2bActions,
  /copied locally — not submitted or sent/i,
  "copy feedback must remain truthful",
);
const b2bNav = "src/components/b2b/B2bCategoryNav.tsx";
requireMatch(b2bNav, /min-h-12/, "catalogue category targets must be at least 48px high");

const packageJson = source("package.json");
for (const script of ["validate:cm-com-1c-r2", "test:cm-com-1c-r2", "validate:ssr-async-context"]) {
  if (!packageJson.includes(`"${script}"`)) failures.push(`package.json: missing ${script}`);
}
for (const integration of [".github/workflows/ci.yml", "scripts/ci/validate-merged-tree.sh"]) {
  const text = source(integration);
  for (const command of [
    "validate:cm-com-1c-r2",
    "test:cm-com-1c-r2",
    "validate:ssr-async-context",
  ]) {
    if (!text.includes(command)) failures.push(`${integration}: missing ${command}`);
  }
}

if (failures.length) {
  console.error(
    `CM-COM-1C-R2 validation failed:\n${failures.map((item) => `- ${item}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(
  "CM-COM-1C-R2 validation passed: runtime, Shop, OAuth, checkout and B2B contracts are intact.",
);

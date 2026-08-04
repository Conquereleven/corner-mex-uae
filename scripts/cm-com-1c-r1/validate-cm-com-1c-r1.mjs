import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

function source(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function requireMatch(path, pattern, message) {
  if (!pattern.test(source(path))) failures.push(`${path}: ${message}`);
}

function rejectMatch(path, pattern, message) {
  if (pattern.test(source(path))) failures.push(`${path}: ${message}`);
}

const login = "src/routes/login.tsx";
requireMatch(login, /signInWithPassword/, "email/password sign-in is required");
requireMatch(login, /safeInternalRedirect\(redirect\)/, "post-login redirect must use the safe helper");
rejectMatch(login, /signInWithOAuth|lovable|google/i, "OAuth must not be restored");
rejectMatch(login, /Accounts unavailable|LoginUnavailable/, "login must render the account form");

const redirect = "src/lib/safe-internal-redirect.ts";
requireMatch(redirect, /value\.startsWith\("\/\/"\)/, "protocol-relative redirects must fail closed");
requireMatch(redirect, /target\.origin !== INTERNAL_ORIGIN/, "redirect origin must be checked");

const protectedRoute = "src/routes/_authenticated.tsx";
requireMatch(protectedRoute, /supabase\.auth\.getUser\(\)/, "protected routes must verify the user");
requireMatch(protectedRoute, /redirect\(\{ to: "\/login"/, "unauthenticated users must go to login");

const adminRoute = "src/routes/_authenticated/admin.tsx";
requireMatch(adminRoute, /await isAdmin\(\{\}\)/, "admin route must invoke isAdmin");
requireMatch(adminRoute, /if \(!r\.admin\) throw redirect/, "non-admin access must fail closed");

const account = "src/routes/_authenticated/account.tsx";
requireMatch(account, /admin\.data\?\.admin &&[\s\S]*to="\/admin"/, "Admin link must be role-conditional");
requireMatch(account, /supabase\.auth\.signOut\(\)/, "sign-out must remain available");
rejectMatch(account, /AdminBootstrapCard|adminBootstrap|Claim admin/i, "admin bootstrap UI is forbidden");

const product = "src/routes/product.$slug.tsx";
requireMatch(product, /setVariantId/, "variant selection is required");
requireMatch(product, /setQuantity/, "quantity controls are required");
requireMatch(product, /Add to cart/, "Add to cart is required");
rejectMatch(product, /Only \{?\w+|left in stock|guaranteed delivery/i, "unsupported stock or delivery claims are forbidden");

const cart = "src/lib/cart.ts";
requireMatch(cart, /B2C_CART_STORAGE_KEY = "cornermex-cart-v1"/, "B2C storage key drift");
rejectMatch(cart, /shipping\s*=.*25|\*\s*25/, "hard-coded AED 25 shipping is forbidden");

const cartRoute = "src/routes/cart.tsx";
requireMatch(cartRoute, /setQty/, "cart quantity updates are required");
requireMatch(cartRoute, /remove/, "cart removal is required");
requireMatch(cartRoute, /Pending destination check/, "shipping must remain pending");

const checkout = "src/routes/checkout.tsx";
requireMatch(checkout, /VITE_CORNERMEX_CHECKOUT_ENABLED === "true"/, "client gate must be exact");
requireMatch(checkout, /disabled=\{!canExecute \|\| submitting\}/, "final action must fail closed");
rejectMatch(checkout, /quote-selection|useQuoteSelection|cm\.quoteSelection/, "checkout must not read B2B state");

const serverGate = "src/lib/checkout-execution.server.ts";
requireMatch(serverGate, /value === "true"/, "server gate must accept only exact true");
requireMatch(serverGate, /CHECKOUT_EXECUTION_DISABLED/, "server gate must expose a stable failure");

const orders = "src/lib/orders.functions.ts";
requireMatch(orders, /\.handler\(async \(\{ data, context \}\) => \{\s*assertCheckoutExecutionEnabled\(\);/, "placeOrder gate must be the first handler statement");
rejectMatch(orders, /:\s*25\b|size \* 25/, "fallback AED 25 shipping is forbidden");

const payments = "src/lib/payments.functions.ts";
const paymentGates = source(payments).match(/assertCheckoutExecutionEnabled\(\);/g)?.length ?? 0;
if (paymentGates < 3) failures.push(`${payments}: every reachable payment/confirmation function must fail closed`);

const quote = "src/routes/b2b_.quote.tsx";
rejectMatch(quote, /placeOrder|createStripeSession|useCart|cornermex-cart-v1/, "B2B quote must not enter B2C execution");

const boundaries = "src/lib/commerce-flow-boundaries.ts";
requireMatch(boundaries, /storage: "localStorage"[\s\S]*storage: "sessionStorage"/, "storage types must remain independent");
requireMatch(boundaries, /execution: null/, "B2B must have no execution path");

const packageJson = source("package.json");
for (const script of ["validate:cm-com-1c-r1", "test:cm-com-1c-r1"]) {
  if (!packageJson.includes(`"${script}"`)) failures.push(`package.json: missing ${script}`);
}

for (const integration of [".github/workflows/ci.yml", "scripts/ci/validate-merged-tree.sh"]) {
  const text = source(integration);
  for (const command of ["validate:cm-com-1c-r1", "test:cm-com-1c-r1"]) {
    if (!text.includes(command)) failures.push(`${integration}: missing ${command}`);
  }
}

if (failures.length) {
  console.error("CM-COM-1C-R1 validation failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("CM-COM-1C-R1 validation passed: auth/admin, B2C fail-closed checkout, and B2B isolation are intact.");

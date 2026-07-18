export const DB1_CUSTODY_FACTS = Object.freeze([
  ["status", /live_legacy_production/i],
  ["custodian", /Joel\s*\/\s*Founder/i],
  ["products", /150 products/i],
  ["orders", /4 orders/i],
  ["auth users", /7 Auth users/i],
  ["seller", /1 seller/i],
  ["final disposition", /Final disposition(?: remains| is|:)\s*(?:is\s*)?deferred/i],
  [
    "destructive action prohibition",
    /(?:No destructive action (?:is )?authorized|Destructive action:\s*not authorized|destructive cleanup|does not authorize[\s\S]*deletion)/i,
  ],
]);

export function validateDb1CustodyText(text, label = "document") {
  return DB1_CUSTODY_FACTS.filter(([, pattern]) => !pattern.test(text)).map(
    ([fact]) => `${label}: missing ${fact}`,
  );
}

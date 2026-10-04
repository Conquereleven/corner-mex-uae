// Mexico market configuration: currency, locale, address model and the rule that
// nothing unconfirmed is presented as a fact.
import assert from "node:assert/strict";
import test from "node:test";

const market = await import("../../src/config/market.ts");
const address = await import("../../src/lib/mx-address.ts");

const valid = {
  recipient_name: "María López",
  phone: "55 1234 5678",
  street: "Av. Mexiquense",
  exterior_number: "12",
  interior_number: "",
  colonia: "Los Héroes Tecámac",
  municipality: "Tecámac",
  state: "MEX",
  postal_code: "55764",
  references: "Portón negro",
};

test("the active market is Mexico: MXN, es-MX, Mexico City time, metric", () => {
  const active = market.ACTIVE_MARKET;
  assert.equal(active.code, "MX");
  assert.equal(active.status, "ACTIVE");
  assert.equal(active.country, "MX");
  assert.equal(active.currency, "MXN");
  assert.equal(active.locale, "es-MX");
  assert.equal(active.timezone, "America/Mexico_City");
  assert.equal(active.defaultLanguage, "es");
  assert.equal(active.measurements, "metric");
  assert.equal(active.address.model, "mx");
});

test("the UAE market is retained but deferred, never active", () => {
  assert.equal(market.AE_MARKET.status, "DEFERRED");
  assert.notEqual(market.ACTIVE_MARKET, market.AE_MARKET);
  const active = Object.values(market.MARKETS).filter((entry) => entry.status === "ACTIVE");
  assert.deepEqual(active.map((entry) => entry.code), ["MX"]);
});

test("money is formatted as Mexican pesos in es-MX", () => {
  assert.equal(market.formatMoney(1234.5), "$1,234.50");
  assert.equal(market.formatMoney("89"), "$89.00");
  assert.equal(market.formatMoneyWithCode(1234.5), "$1,234.50 MXN");
  assert.equal(market.formatMoney(Number.NaN), "$0.00");
  assert.doesNotMatch(market.formatMoneyWithCode(10), /AED/);
});

test("unconfirmed legal and tax facts are null, not invented", () => {
  const { legal, tax } = market.ACTIVE_MARKET;
  assert.equal(legal.sellerEntity, null);
  assert.equal(legal.taxId, null);
  assert.equal(legal.fiscalAddress, null);
  assert.equal(tax.priceModel, "UNDETERMINED");
  // No tax line may be shown while the model is undetermined, whatever the rate.
  assert.equal(market.taxLineLabel(0.16), null);
  assert.equal(market.taxLineLabel(0.05, market.AE_MARKET), "VAT (5%)");
});

test("a Mexico address validates and normalises the phone", () => {
  const parsed = address.MxAddress.parse(valid);
  assert.equal(parsed.phone, "5512345678");
  assert.equal(parsed.interior_number, null);
  assert.equal(parsed.state, "MEX");
});

test("phone accepts +52 and the retired 521 mobile prefix, rejects short numbers", () => {
  assert.equal(address.normalizeMxPhone("+52 55 1234 5678"), "5512345678");
  assert.equal(address.normalizeMxPhone("5215512345678"), "5512345678");
  assert.equal(address.normalizeMxPhone("(55) 1234-5678"), "5512345678");
  assert.equal(address.normalizeMxPhone("1234567"), null);
  assert.equal(address.normalizeMxPhone("+971 50 123 4567"), null);
  assert.equal(address.mxPhoneE164("5512345678"), "+525512345678");
});

test("postal code must be five digits and belong to the selected state", () => {
  const codes = (input) =>
    address.MxAddress.safeParse(input).error?.issues.map((issue) => issue.message) ?? [];
  assert.deepEqual(codes({ ...valid, postal_code: "5576" }), ["MX_ADDRESS_POSTAL_CODE_INVALID"]);
  assert.deepEqual(codes({ ...valid, state: "JAL" }), ["MX_ADDRESS_POSTAL_CODE_STATE_MISMATCH"]);
  assert.deepEqual(codes({ ...valid, postal_code: "17000" }), ["MX_ADDRESS_POSTAL_CODE_INVALID"]);
  assert.equal(address.stateForPostalCode("55764"), "MEX");
  assert.equal(address.stateForPostalCode("06600"), "CMX");
  assert.equal(address.stateForPostalCode("64000"), "NLE");
});

test("all 32 federal entities are present and every postal prefix maps to one", () => {
  assert.equal(address.MX_STATE_CODES.length, 32);
  assert.equal(address.MX_STATE_OPTIONS.length, 32);
  const assigned = new Set();
  for (let prefix = 1; prefix <= 99; prefix += 1) {
    const state = address.stateForPostalCode(`${String(prefix).padStart(2, "0")}000`);
    if (state) assigned.add(state);
  }
  assert.equal(assigned.size, 32);
});

test("the address has no emirate and the order snapshot is tagged as Mexican", () => {
  const snapshot = address.toAddressSnapshot(address.MxAddress.parse(valid));
  assert.equal(snapshot.address_model, "mx-1");
  assert.equal(snapshot.country, "MX");
  assert.equal(snapshot.state_name, "Estado de México");
  assert.ok(address.isMxAddressSnapshot(snapshot));
  for (const key of ["emirate", "area", "building", "floor_apartment", "landmark"]) {
    assert.ok(!(key in snapshot), `${key} is a UAE field`);
  }
  // A historical UAE snapshot is recognisably not a Mexico one.
  assert.equal(address.isMxAddressSnapshot({ emirate: "DU", area: "Marina" }), false);
  assert.deepEqual(address.formatMxAddressLines(snapshot), [
    "Av. Mexiquense 12",
    "Col. Los Héroes Tecámac",
    "55764 Tecámac, Estado de México",
  ]);
});

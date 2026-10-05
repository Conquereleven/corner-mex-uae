// Shared fixtures for the shipping adapter tests.
//
// Response shapes follow the published Skydropx / Solo Envíos API references
// (read 2026-10-04). No network is touched: `fakeTransport` stands in for fetch.

export const origin = {
  country: "MX",
  postalCode: "55740",
  state: "Estado de México",
  municipality: "Tecámac",
  colonia: "Tecámac de Felipe Villanueva Centro",
};

export const destination = {
  country: "MX",
  postalCode: "64000",
  state: "Nuevo León",
  municipality: "Monterrey",
  colonia: "Monterrey Centro",
};

export const parcels = [{ lengthCm: 30, widthCm: 20, heightCm: 15, weightKg: 2.4 }];

export const person = (base) => ({
  ...base,
  name: "CornerMex Almacén",
  company: "CornerMex",
  phone: "5512345678",
  email: ["envios", "example.test"].join("@"),
  street: "Calle Ejemplo 10",
  reference: "Bodega",
});

export const tokenResponse = (overrides = {}) => ({
  access_token: "test-access-token",
  token_type: "Bearer",
  expires_in: 7200,
  scope: "default orders.create",
  created_at: 1_760_000_000,
  ...overrides,
});

export const rate = (overrides = {}) => ({
  id: "rate-1",
  success: true,
  provider_name: "fedex",
  provider_display_name: "FedEx",
  provider_service_name: "Standard Overnight",
  provider_service_code: "standard_overnight",
  status: "pending",
  currency_code: "MXN",
  total: 150.0,
  days: 2,
  insurable: true,
  error_messages: [],
  pickup: true,
  pickup_automatic: false,
  ...overrides,
});

export const quotation = (rates, overrides = {}) => ({
  id: "quotation-1",
  is_completed: true,
  quotation_scope: {},
  rates,
  ...overrides,
});

export const shipment = (overrides = {}) => ({
  data: {
    id: "shipment-1",
    type: "shipments",
    attributes: {
      id: "shipment-1",
      carrier_name: "fedex",
      workflow_status: "success",
      payment_status: "paid",
      total: "150.00",
      master_tracking_number: "794874381730",
      ...overrides,
    },
  },
  included: [
    {
      id: "package-1",
      type: "packages",
      attributes: {
        tracking_url_provider: "https://carrier.example.test/track/794874381730",
        tracking_status: "created",
        tracking_number: 794874381730,
        label_url: "https://labels.example.test/794874381730.pdf",
      },
    },
    {
      id: "address-1",
      type: "addresses",
      attributes: { address_type: "to", postal_code: "64000", name: "Juan" },
    },
  ],
});

/**
 * A scripted fetch. `routes` maps "METHOD /path" to a handler (or a list of
 * handlers consumed in order) returning {status, body} or throwing to simulate
 * a network failure.
 */
export function fakeTransport(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const { pathname, search } = new URL(url);
    const key = `${init.method ?? "GET"} ${pathname}`;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ key, url, search, body, headers: init.headers ?? {} });
    let handler = routes[key];
    if (Array.isArray(handler)) handler = handler.length > 1 ? handler.shift() : handler[0];
    if (!handler) throw new Error(`unexpected request: ${key}`);
    const result = await handler({ url, body, headers: init.headers ?? {} });
    return {
      status: result.status,
      text: async () => (result.body === undefined ? "" : JSON.stringify(result.body)),
    };
  };
  return { fetchImpl, calls, count: (key) => calls.filter((call) => call.key === key).length };
}

/** A controllable clock whose sleep advances time instead of waiting. */
export function fakeClock(start = 1_760_000_000_000) {
  let current = start;
  return {
    now: () => current,
    sleep: async (ms) => {
      current += ms;
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

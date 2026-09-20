// Local storage of guest order capability tokens.
//
// The token is returned exactly once, when the order is created. It is kept in
// this browser so the confirmation and tracking views work across reloads, and
// is deliberately NOT placed in the URL: a link in a browser history, referrer
// header or shared screenshot would be a capability leak.
const KEY = "cornermex-guest-orders-v1";

type Store = Record<string, string>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

export function rememberGuestOrderToken(orderId: string, token: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [orderId]: token }));
  } catch {
    /* storage unavailable: the confirmation still renders from the response */
  }
}

export function guestOrderToken(orderId: string): string | null {
  return read()[orderId] ?? null;
}

export function forgetGuestOrderToken(orderId: string): void {
  try {
    const store = read();
    delete store[orderId];
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* nothing to clean up */
  }
}

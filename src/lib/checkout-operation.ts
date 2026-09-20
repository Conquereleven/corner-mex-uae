/** Persist before network I/O. A changed checkout cannot silently abandon an ambiguous order. */
export async function checkoutOperation(buyerId: string, payload: unknown): Promise<string> {
  if (!navigator.locks) throw new Error("CHECKOUT_OPERATION_STORAGE_UNAVAILABLE");
  return navigator.locks.request(`intermex-checkout:${buyerId}`, async () => {
    const key = `intermex-card-operation:${buyerId}`;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const existing = localStorage.getItem(key);
    if (existing) {
      const operation = JSON.parse(existing) as { id: string; fingerprint: string };
      if (operation.fingerprint !== fingerprint) throw new Error("CHECKOUT_OPERATION_PENDING");
      return operation.id;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(key, JSON.stringify({ id, fingerprint }));
    return id;
  });
}

// COD checkout operation id. Kept in its own key namespace so it can never
// collide with the card key, whose name is a persisted compatibility
// identifier that must not be renamed (docs/cornermex-2/LEGAL-IDENTITY.md §3).
//
// Unlike the card flow, a changed cart mints a NEW id instead of refusing.
// COD returns its result immediately, so there is no provider round trip to
// protect, and refusing would strand the customer after an abandoned attempt.
// Replay safety still holds: the server fingerprints the request, so the same
// id with a different cart is rejected rather than silently reused.
const COD_OPERATION_KEY = (buyerId: string) => `cornermex-cod-operation:${buyerId}`;

export async function codCheckoutOperation(buyerId: string, payload: unknown): Promise<string> {
  if (!navigator.locks) throw new Error("CHECKOUT_OPERATION_STORAGE_UNAVAILABLE");
  return navigator.locks.request(`cornermex-cod-checkout:${buyerId}`, async () => {
    const key = COD_OPERATION_KEY(buyerId);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const existing = localStorage.getItem(key);
    if (existing) {
      const operation = JSON.parse(existing) as { id: string; fingerprint: string };
      if (operation.fingerprint === fingerprint) return operation.id;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(key, JSON.stringify({ id, fingerprint }));
    return id;
  });
}

/** Called once the order exists, so the next order starts a new operation. */
export function clearCodCheckoutOperation(buyerId: string): void {
  try {
    localStorage.removeItem(COD_OPERATION_KEY(buyerId));
  } catch {
    /* storage unavailable: the fingerprint check still prevents a wrong replay */
  }
}

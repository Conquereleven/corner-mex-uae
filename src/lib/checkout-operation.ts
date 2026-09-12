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

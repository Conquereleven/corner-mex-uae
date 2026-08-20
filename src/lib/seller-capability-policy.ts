export const SELLER_CAPABILITY_UNAVAILABLE = "CM_SELLER_CAPABILITY_UNAVAILABLE";

/**
 * CM-LAUNCH-1-L4R
 *
 * Seller capability is intentionally disabled for launch. Activation requires a
 * deliberate code change to this authority constant plus its own review/gate;
 * database schema presence and environment variables cannot enable it.
 */
export const SELLER_CAPABILITY_ENABLED = false as const;

type ServerFnMetaLike = {
  id?: string;
  name?: string;
  filename?: string;
};

function normalizeFilename(filename: string): string {
  return filename.replaceAll("\\", "/").toLowerCase();
}

/**
 * Classifies server functions that belong to the dormant Seller capability.
 *
 * The filename rule contains the entire legacy seller.functions module,
 * including exports whose names are generic (for example setOrderItemStatus),
 * while the name rules contain Seller entry points that live in shared modules
 * such as account and shipment functions.
 */
export function isSellerCapabilityServerFn(meta: ServerFnMetaLike | undefined): boolean {
  if (!meta) return false;

  const filename = normalizeFilename(meta.filename ?? "");
  const name = meta.name ?? "";

  if (filename.endsWith("/seller.functions.ts") || filename.endsWith("/seller.functions.js")) {
    return true;
  }

  if (name === "becomeSeller") {
    return true;
  }

  return /^seller[A-Z0-9_]/.test(name);
}

export function assertSellerCapabilityServerFnAllowed(meta: ServerFnMetaLike | undefined): void {
  if (SELLER_CAPABILITY_ENABLED) return;
  if (isSellerCapabilityServerFn(meta)) {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  }
}

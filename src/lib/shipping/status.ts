// Provider status → CornerMex shipment status.
//
// Source: the published API references of Skydropx (pro.skydropx.com/es-MX/api-docs)
// and Solo Envíos (app.soloenvios.com/es-MX/api-docs), read 2026-10-04. Both
// document the same package tracking vocabulary:
//   created, picked_up, in_transit, last_mile, delivery_attempt,
//   delivered_to_branch, delivered, exception, in_return, canceled, destroyed,
//   retained
// and a shipment `workflow_status` whose documented examples are `pending` and
// `success`.
//
// An unrecognised status maps to null — the caller keeps the last known
// CornerMex status and stores the raw value, rather than guessing.

import type { ShipmentStatus } from "./types.ts";

const TRACKING: Readonly<Record<string, ShipmentStatus>> = Object.freeze({
  created: "LABEL_CREATED",
  picked_up: "IN_TRANSIT",
  in_transit: "IN_TRANSIT",
  last_mile: "OUT_FOR_DELIVERY",
  // The carrier tried and failed; a person has to look at it.
  delivery_attempt: "EXCEPTION",
  // Waiting at a carrier branch for the recipient to collect.
  delivered_to_branch: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  exception: "EXCEPTION",
  retained: "EXCEPTION",
  destroyed: "EXCEPTION",
  in_return: "RETURNED",
  canceled: "CANCELLED",
  cancelled: "CANCELLED",
});

const WORKFLOW: Readonly<Record<string, ShipmentStatus>> = Object.freeze({
  pending: "LABEL_PENDING",
  in_progress: "LABEL_PENDING",
  success: "LABEL_CREATED",
  canceled: "CANCELLED",
  cancelled: "CANCELLED",
  failed: "EXCEPTION",
  error: "EXCEPTION",
});

const key = (raw: unknown): string => (typeof raw === "string" ? raw.trim().toLowerCase() : "");

/** Maps a package tracking status. Null when the provider value is unknown. */
export function mapTrackingStatus(raw: unknown): ShipmentStatus | null {
  return TRACKING[key(raw)] ?? null;
}

/** Maps a shipment workflow status. Null when the provider value is unknown. */
export function mapWorkflowStatus(raw: unknown): ShipmentStatus | null {
  return WORKFLOW[key(raw)] ?? null;
}

/**
 * Order of progress, used so a late or replayed event can never move a shipment
 * backwards. Terminal states are never left.
 */
const RANK: Readonly<Record<ShipmentStatus, number>> = Object.freeze({
  QUOTE_CREATED: 0,
  LABEL_PENDING: 1,
  LABEL_CREATED: 2,
  READY_FOR_PICKUP: 3,
  IN_TRANSIT: 4,
  OUT_FOR_DELIVERY: 5,
  EXCEPTION: 5,
  DELIVERED: 9,
  RETURNED: 9,
  CANCELLED: 9,
});

const TERMINAL: ReadonlySet<ShipmentStatus> = new Set(["DELIVERED", "RETURNED", "CANCELLED"]);

/**
 * The status a shipment should hold after an incoming status. Returns the
 * current status when the incoming one is stale, unknown or would leave a
 * terminal state.
 */
export function nextShipmentStatus(
  current: ShipmentStatus,
  incoming: ShipmentStatus | null,
): ShipmentStatus {
  if (incoming === null || incoming === current) return current;
  if (TERMINAL.has(current)) return current;
  // An exception can resolve back into normal transit, and is itself allowed to
  // interrupt any non-terminal state.
  if (current === "EXCEPTION" || incoming === "EXCEPTION") return incoming;
  return RANK[incoming] >= RANK[current] ? incoming : current;
}

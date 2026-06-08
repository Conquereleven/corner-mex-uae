// Centralized color tokens for dashboard status badges & chart slices.
// Uses oklch values aligned with the project's earthy palette.

export const STATUS_COLOR: Record<string, string> = {
  pending: "oklch(0.78 0.14 80)", // amber
  confirmed: "oklch(0.65 0.12 235)", // sky
  preparing: "oklch(0.65 0.12 235)", // sky
  authorized: "oklch(0.65 0.12 235)", // sky
  shipped: "oklch(0.62 0.16 285)", // violet
  delivered: "oklch(0.62 0.13 150)", // green
  cancelled: "oklch(0.58 0.20 28)", // red
  refunded: "oklch(0.65 0.14 50)", // orange
  paid: "oklch(0.62 0.13 150)", // green
  failed: "oklch(0.58 0.20 28)", // red
  active: "oklch(0.62 0.13 150)",
  suspended: "oklch(0.58 0.20 28)",
  rejected: "oklch(0.58 0.20 28)",
  draft: "oklch(0.65 0.02 80)",
  archived: "oklch(0.50 0.02 80)",
  unknown: "oklch(0.65 0.02 80)",
};

export function statusColor(status?: string | null) {
  if (!status) return STATUS_COLOR.unknown;
  return STATUS_COLOR[status] ?? STATUS_COLOR.unknown;
}

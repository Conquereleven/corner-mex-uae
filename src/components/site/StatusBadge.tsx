import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Centralised status → tone mapping. Add new statuses here so every
 * surface (admin tables, seller dashboard, order pages) renders the
 * same colour for the same status.
 */
const STATUS_TONE: Record<string, string> = {
  // Generic
  pending: "bg-warning/15 text-warning border-warning/30",
  processing: "bg-info/15 text-info border-info/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
  active: "bg-success/15 text-success border-success/30",
  // Orders
  paid: "bg-success/15 text-success border-success/30",
  unpaid: "bg-warning/15 text-warning border-warning/30",
  refunded: "bg-info/15 text-info border-info/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  shipped: "bg-info/15 text-info border-info/30",
  delivered: "bg-success/15 text-success border-success/30",
  confirmed: "bg-success/15 text-success border-success/30",
  // CRM
  new: "bg-info/15 text-info border-info/30",
  contacted: "bg-warning/15 text-warning border-warning/30",
  quoted: "bg-info/15 text-info border-info/30",
  negotiating: "bg-warning/15 text-warning border-warning/30",
  won: "bg-success/15 text-success border-success/30",
  lost: "bg-muted text-muted-foreground border-border",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const tone = STATUS_TONE[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("capitalize", tone, className)}>
      {label ?? status}
    </Badge>
  );
}
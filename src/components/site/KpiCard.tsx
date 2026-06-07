import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "info" | "destructive";

const TONE_BORDER: Record<Tone, string> = {
  default: "",
  success: "border-success/40",
  warning: "border-warning/50",
  info: "border-info/40",
  destructive: "border-destructive/40",
};

const TONE_ICON: Record<Tone, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
};

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  className?: string;
}

/**
 * Shared KPI tile used across admin + seller dashboards.
 */
export function KpiCard({ label, value, hint, icon: Icon, tone = "default", className }: KpiCardProps) {
  return (
    <Card className={cn(TONE_BORDER[tone], className)}>
      <CardContent className="py-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          {Icon && <Icon className={cn("h-4 w-4", TONE_ICON[tone])} />}
        </div>
        <p className="mt-2 font-display text-2xl tracking-tight text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
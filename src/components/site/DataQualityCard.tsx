import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import type { LiveView } from "@/lib/live-view.functions";

type Level = "complete" | "partial" | "unavailable" | "connected" | "missing" | "placeholder" | "yes";

const LEVEL_META: Record<Level, { icon: any; tone: string; label: string }> = {
  complete:    { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", label: "complete" },
  connected:   { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", label: "connected" },
  yes:         { icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", label: "yes" },
  partial:     { icon: AlertCircle,  tone: "text-amber-600 dark:text-amber-400",    label: "partial" },
  placeholder: { icon: AlertCircle,  tone: "text-amber-600 dark:text-amber-400",    label: "placeholder" },
  missing:     { icon: MinusCircle,  tone: "text-muted-foreground",                 label: "missing" },
  unavailable: { icon: MinusCircle,  tone: "text-muted-foreground",                 label: "unavailable" },
};

function Row({ label, level }: { label: string; level: string }) {
  const meta = LEVEL_META[(level as Level) ?? "missing"] ?? LEVEL_META.missing;
  const Icon = meta.icon;
  return (
    <li className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 font-medium ${meta.tone}`}>
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    </li>
  );
}

export function DataQualityCard({ d }: { d?: LiveView }) {
  const dq = d?.dataQuality;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          Data quality
        </CardTitle>
        <Badge variant="outline" className="text-[10px] font-normal">Transparency</Badge>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          <Row label="Location data" level={dq?.locationData ?? "unavailable"} />
          <Row label="Paid orders only" level={dq?.paidOrdersOnly ? "yes" : "missing"} />
          <Row label="Session location attribution" level={dq?.sessionLocationAttribution ?? "missing"} />
          <Row label="Delivery SLA data" level={dq?.deliverySlaData ?? "placeholder"} />
          <Row label="Product heat data" level={dq?.productHeatData ?? "unavailable"} />
          <Row label="Traffic source by emirate" level={dq?.trafficSourceByEmirate ?? "missing"} />
          <Row label="Anomaly persistence" level={dq?.anomalyPersistence ?? "connected"} />
        </ul>
      </CardContent>
    </Card>
  );
}
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GO_LIVE_AUDITED_AT, GO_LIVE_BASELINE, goLiveReadiness } from "@/lib/go-live-readiness";

export function GoLiveReadiness() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Intermex go-live readiness — NOT_READY</CardTitle>
        <p className="text-sm text-muted-foreground">
          Repository audit dated {GO_LIVE_AUDITED_AT}, main {GO_LIVE_BASELINE.slice(0, 12)}. This is
          an activation checklist, not live telemetry. NOT CONFIGURED means validated configuration
          evidence is missing. Refresh the production ledger and evidence before any activation.
          READY_FOR_OPERATIONS=false.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {goLiveReadiness.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{item.label}</h3>
              <Badge variant="outline">{item.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

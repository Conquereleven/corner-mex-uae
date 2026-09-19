import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOperationalStatus } from "@/lib/operational-status.functions";
export function GoLiveReadiness() {
  const load = useServerFn(getOperationalStatus);
  const { data } = useQuery({
    queryKey: ["operational-readiness-v2"],
    queryFn: () => load({}),
    refetchInterval: 60_000,
  });
  const schema = data?.schemaAvailable;
  const rows = [
    [
      "Card checkout, idempotency and verified lifecycle",
      data?.cardReady ? "READY" : schema ? "BLOCKED" : "NOT_CONFIGURED",
      `Mode: ${data?.cardMode ?? "unknown"}. Requires current database gate and server configuration.`,
    ],
    [
      "Payment reconciliation",
      data?.paymentAnomalies ? "REQUIRES_ATTENTION" : schema ? "READY" : "NOT_CONFIGURED",
      `Multiple captures / payment anomalies: ${data?.paymentAnomalies ?? "unavailable"}.`,
    ],
    [
      "Accounting worker",
      data?.jobsRequiringAttention ? "REQUIRES_ATTENTION" : data?.workerReady ? "READY" : "BLOCKED",
      `Mode: ${data?.workerMode ?? "unknown"}. Authenticated scheduler deployment must be verified separately.`,
    ],
    [
      "Historical queue containment",
      schema ? "READY" : "NOT_CONFIGURED",
      `Jobs outside the current generation: ${data?.historicalJobs ?? "unavailable"}. These cannot be claimed.`,
    ],
    [
      "Invoice projection",
      schema ? "READY" : "NOT_CONFIGURED",
      "Owner/account/admin authorization; artifacts appear only after mapping. URLs require explicit allowed hosts.",
    ],
    [
      "Refund accounting policy",
      data?.refundActions ? "REQUIRES_ATTENTION" : schema ? "READY" : "NOT_CONFIGURED",
      `Open accounting corrections: ${data?.refundActions ?? "unavailable"}. Provider-specific documents require the approved refund policy.`,
    ],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>CornerMex operational readiness</CardTitle>
        <p className="text-sm text-muted-foreground">
          Runtime evidence is read from the current database. READY means the boundary is available;
          production activation and controlled E2E evidence remain separate gates. No provider is
          marked ACTIVE by configuration alone.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {rows.map(([label, status, reason]) => (
          <div key={label} className="rounded-lg border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-medium">{label}</h3>
              <Badge variant="outline">{status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

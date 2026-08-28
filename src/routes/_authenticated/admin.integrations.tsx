import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, RefreshCw, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/site/PageHeader";
import { AdminCapabilityUnavailable } from "@/components/site/AdminCapabilityUnavailable";
import {
  adminAccountingControlCenter,
  adminRetryAccountingJob,
} from "@/lib/accounting-control-center.functions";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({ meta: [{ title: "Admin — Integration Control Center" }] }),
  component: IntegrationControlCenter,
});

function IntegrationControlCenter() {
  const load = useServerFn(adminAccountingControlCenter);
  const retry = useServerFn(adminRetryAccountingJob);
  const query = useQuery({
    queryKey: ["accounting-control-center"],
    queryFn: () => load({}),
    refetchInterval: 60_000,
  });
  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading integration status…</p>;
  if (query.isError || !query.data)
    return (
      <AdminCapabilityUnavailable
        title="Integration status unavailable"
        description="The control center could not read canonical integration state. No provider call was made."
      />
    );
  const state = query.data;
  if (!state.available)
    return (
      <AdminCapabilityUnavailable
        title="Accounting integration is not activated"
        description="The reviewed database migration is still unapplied. Zoho live writes remain blocked."
      />
    );

  const statusIcon =
    state.providerHealth === "available"
      ? CheckCircle2
      : state.providerHealth === "degraded"
        ? AlertTriangle
        : Unplug;
  const StatusIcon = statusIcon;
  return (
    <div className="space-y-6">
      <PageHeader
        icon={RefreshCw}
        title="Integration Control Center"
        description="Replay-safe CornerMex → Zoho invoice operations, reconciliation and exception recovery."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Provider posture</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5" />
            <Badge variant="outline">{state.providerHealth}</Badge>
          </CardContent>
        </Card>
        {(["pending", "retry_scheduled", "requires_attention"] as const).map((status) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle className="text-sm">{status.replaceAll("_", " ")}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl tabular-nums">{state.counts[status] ?? 0}</CardContent>
          </Card>
        ))}
      </div>
      {!state.activation.ready && (
        <Card className="border-amber-500/30">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium">Live activation blocked</p>
            <p className="mt-1 text-muted-foreground">
              {state.activation.reasons.join(" · ")}. Product evidence, organization/data center,
              VAT mapping, credentials and a separate exact-head authorization are required.
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Failure</TableHead>
                <TableHead>Correlation</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.orderNumber ?? job.orderId.slice(0, 8)}</TableCell>
                  <TableCell>{job.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{job.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {job.attempts}/{job.maxAttempts}
                  </TableCell>
                  <TableCell>{job.failureCategory ?? job.safeCode ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.correlationId.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {job.status === "requires_attention" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await retry({ data: { jobId: job.id } });
                          await query.refetch();
                        }}
                      >
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

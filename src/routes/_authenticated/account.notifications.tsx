import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCheck } from "lucide-react";
import { listMyNotifications, markRead, markAllRead } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/account/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Corner Mex" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyNotifications);
  const doMarkRead = useServerFn(markRead);
  const doMarkAll = useServerFn(markAllRead);

  const list = useQuery({
    queryKey: ["notifs", "all"],
    queryFn: () => fetchList({ data: { limit: 200 } }),
  });
  const mRead = useMutation({
    mutationFn: (id: string) => doMarkRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifs"] }),
  });
  const mAll = useMutation({
    mutationFn: () => doMarkAll({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifs"] }),
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your order and shipment activity.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/account"><Button variant="outline" className="rounded-full">← Account</Button></Link>
            <Button variant="outline" onClick={() => mAll.mutate()} disabled={mAll.isPending}>
              <CheckCheck className="me-2 h-4 w-4" /> Mark all read
            </Button>
          </div>
        </div>

        <Card className="mt-8">
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent>
            {list.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (list.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(list.data ?? []).map((n: any) => (
                  <li key={n.id} className={`flex items-start justify-between gap-3 py-3 ${!n.read_at ? "bg-muted/20 -mx-2 px-2 rounded-md" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!n.read_at ? "font-semibold" : ""}`}>{n.title}</p>
                        <Badge variant="outline" className="text-[10px]">{n.kind.replace(/_/g, " ")}</Badge>
                        {!n.read_at && <Badge className="text-[10px]">New</Badge>}
                      </div>
                      {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      {n.link && <Link to={n.link}><Button size="sm" variant="ghost">Open</Button></Link>}
                      {!n.read_at && (
                        <Button size="sm" variant="outline" onClick={() => mRead.mutate(n.id)}>Mark read</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </SiteLayout>
  );
}
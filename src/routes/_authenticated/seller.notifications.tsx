import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCheck } from "lucide-react";
import { listMyNotifications, markRead, markAllRead } from "@/lib/notifications.functions";
import { getNotificationsQueryState } from "@/lib/notifications-query-state";

export const Route = createFileRoute("/_authenticated/seller/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Seller Studio" }] }),
  component: SellerNotifications,
});

function SellerNotifications() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyNotifications);
  const doMarkRead = useServerFn(markRead);
  const doMarkAll = useServerFn(markAllRead);

  const list = useQuery({
    queryKey: ["notifs", "all"],
    queryFn: () => fetchList({ data: { limit: 200 } }),
    retry: false,
  });
  const mRead = useMutation({
    mutationFn: (id: string) => doMarkRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifs"] }),
  });
  const mAll = useMutation({
    mutationFn: () => doMarkAll({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifs"] }),
  });
  const view = getNotificationsQueryState({
    data: list.data,
    isError: list.isError,
    isPending: list.isPending,
  });
  const hasUnread =
    view.status === "success" &&
    view.notifications.some((notification: any) => !notification.read_at);

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Sales, shipments and account events.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => mAll.mutate()}
          disabled={mAll.isPending || !hasUnread}
        >
          <CheckCheck className="me-2 h-4 w-4" /> Mark all read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {view.status === "loading" ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : view.status === "error" ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Unable to load notifications.</p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => void list.refetch()}
                disabled={list.isFetching}
              >
                {list.isFetching ? "Retrying…" : "Retry"}
              </Button>
            </div>
          ) : view.status === "empty" ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {view.notifications.map((n: any) => (
                <li
                  key={n.id}
                  className={`flex items-start justify-between gap-3 py-3 ${!n.read_at ? "bg-muted/20 -mx-2 px-2 rounded-md" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!n.read_at ? "font-semibold" : ""}`}>{n.title}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {n.kind.replace(/_/g, " ")}
                      </Badge>
                      {!n.read_at && <Badge className="text-[10px]">New</Badge>}
                    </div>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    {n.link && (
                      <Link to={n.link}>
                        <Button size="sm" variant="ghost">
                          Open
                        </Button>
                      </Link>
                    )}
                    {!n.read_at && (
                      <Button size="sm" variant="outline" onClick={() => mRead.mutate(n.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

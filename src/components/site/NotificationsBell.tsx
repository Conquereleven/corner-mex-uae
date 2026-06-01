import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listMyNotifications, unreadCount, markRead, markAllRead } from "@/lib/notifications.functions";
import { useSession } from "@/lib/use-session";

export function NotificationsBell({ accountHref = "/account/notifications" }: { accountHref?: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyNotifications);
  const fetchCount = useServerFn(unreadCount);
  const doMarkRead = useServerFn(markRead);
  const doMarkAll = useServerFn(markAllRead);

  const enabled = !!user;
  const count = useQuery({
    queryKey: ["notifs", "unread", user?.id ?? "anon"],
    queryFn: () => fetchCount({}),
    enabled,
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ["notifs", "recent", user?.id ?? "anon"],
    queryFn: () => fetchList({ data: { limit: 12 } }),
    enabled,
    refetchInterval: 60_000,
  });

  const mRead = useMutation({
    mutationFn: (id: string) => doMarkRead({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
    },
  });
  const mAll = useMutation({
    mutationFn: () => doMarkAll({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifs"] }),
  });

  if (!user) return null;
  const unread = count.data?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-medium">Notifications</p>
          <Button
            variant="ghost" size="sm" className="h-7 text-xs"
            disabled={!unread || mAll.isPending}
            onClick={() => mAll.mutate()}
          >
            <CheckCheck className="me-1 h-3.5 w-3.5" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[420px]">
          {list.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : (list.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(list.data ?? []).map((n: any) => {
                const isUnread = !n.read_at;
                const content = (
                  <div className="flex-1">
                    <p className={`text-sm ${isUnread ? "font-medium" : ""}`}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id} className={`flex items-start gap-2 p-3 ${isUnread ? "bg-muted/30" : ""}`}>
                    {n.link ? (
                      <Link to={n.link} className="flex-1 hover:opacity-80" onClick={() => isUnread && mRead.mutate(n.id)}>
                        {content}
                      </Link>
                    ) : content}
                    {isUnread && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => mRead.mutate(n.id)} aria-label="Mark read">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border p-2 text-center">
          <Link to={accountHref} className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
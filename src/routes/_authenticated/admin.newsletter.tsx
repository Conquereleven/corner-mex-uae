import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminListNewsletter } from "@/lib/newsletter.functions";

export const Route = createFileRoute("/_authenticated/admin/newsletter")({
  component: NewsletterAdmin,
});

function NewsletterAdmin() {
  const fn = useServerFn(adminListNewsletter);
  const q = useQuery({ queryKey: ["admin-newsletter"], queryFn: () => fn({}) });
  const rows = (q.data ?? []) as any[];
  return (
    <Card>
      <CardHeader><CardTitle>Newsletter subscribers ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
         rows.length === 0 ? <p className="text-sm text-muted-foreground">No subscribers yet.</p> : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-mono">{r.email}</span>
                <span className="text-xs text-muted-foreground">{r.locale} · {r.source ?? "—"} · {new Date(r.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
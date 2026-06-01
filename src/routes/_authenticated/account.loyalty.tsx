import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getMyLoyalty } from "@/lib/loyalty.functions";

export const Route = createFileRoute("/_authenticated/account/loyalty")({
  head: () => ({ meta: [{ title: "Loyalty — Corner Mex" }] }),
  component: LoyaltyPage,
});

function LoyaltyPage() {
  const fn = useServerFn(getMyLoyalty);
  const q = useQuery({ queryKey: ["loyalty"], queryFn: () => fn({}) });
  const d = q.data;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Loyalty program</h1>
            <p className="mt-1 text-sm text-muted-foreground">Earn points on every order and unlock perks as you grow.</p>
          </div>
          <Link to="/account"><Button variant="outline" className="rounded-full">← Account</Button></Link>
        </div>

        {q.isLoading || !d ? <p className="mt-8 text-sm text-muted-foreground">Loading…</p> : (
          <>
            <Card className="mt-8">
              <CardContent className="grid gap-6 p-6 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Tier</p>
                  <p className="mt-1 font-display text-3xl capitalize">{d.account.tier}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Points</p>
                  <p className="mt-1 font-display text-3xl tabular-nums">{d.account.points_balance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Lifetime spend</p>
                  <p className="mt-1 font-display text-3xl tabular-nums">AED {Number(d.account.lifetime_spend_aed).toLocaleString()}</p>
                </div>
                {d.next_tier && (
                  <div className="md:col-span-3">
                    <p className="text-xs text-muted-foreground">
                      AED {Number(d.next_tier.remaining).toLocaleString()} to <span className="capitalize">{d.next_tier.tier}</span>
                    </p>
                    <Progress className="mt-2" value={Math.min(100, 100 - (d.next_tier.remaining / d.next_tier.threshold) * 100)} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {d.tiers.map((t: any) => (
                <Card key={t.tier} className={t.tier === d.account.tier ? "border-primary" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base capitalize">
                      {t.tier}
                      {t.tier === d.account.tier && <Badge>Current</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Spend AED {t.threshold.toLocaleString()}+ lifetime</p>
                    <ul className="mt-3 space-y-1 text-xs">
                      {t.perks.map((p: string) => <li key={p}>· {p}</li>)}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-8">
              <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
              <CardContent>
                {d.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet — place your first order to earn points.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {d.transactions.map((t: any) => (
                      <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p>{t.description}</p>
                          <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.kind}</p>
                        </div>
                        <span className={`tabular-nums font-medium ${t.points >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {t.points >= 0 ? "+" : ""}{t.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </SiteLayout>
  );
}

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Radio, ShoppingCart, CreditCard, Truck, Flame, Compass, Activity } from "lucide-react";
import type { LocationSummary } from "@/lib/live-view.functions";

export type EmirateStat = {
  code: string;
  name: string;
  x: number; // % left
  y: number; // % top
  orders: number;
  sales: number;
  loc?: LocationSummary;
};

// UAE emirate anchors (approx, stylized — not geographic accuracy)
const EMIRATES: Array<{ code: string; name: string; x: number; y: number }> = [
  { code: "AD", name: "Abu Dhabi", x: 22, y: 74 },
  { code: "DU", name: "Dubai", x: 55, y: 55 },
  { code: "SH", name: "Sharjah", x: 62, y: 49 },
  { code: "AJ", name: "Ajman", x: 66, y: 44 },
  { code: "UQ", name: "Umm Al Quwain", x: 71, y: 38 },
  { code: "RK", name: "Ras Al Khaimah", x: 79, y: 24 },
  { code: "FU", name: "Fujairah", x: 86, y: 44 },
];

export type MapLayer =
  | "orders"
  | "sessions"
  | "carts"
  | "checkout"
  | "delivery"
  | "heat"
  | "source";

const LAYERS: Array<{ id: MapLayer; label: string; icon: any; live: boolean }> = [
  { id: "orders", label: "Orders", icon: MapPin, live: true },
  { id: "sessions", label: "Sessions", icon: Radio, live: false },
  { id: "carts", label: "Active carts", icon: ShoppingCart, live: false },
  { id: "checkout", label: "Checkout", icon: CreditCard, live: false },
  { id: "delivery", label: "Delivery risk", icon: Truck, live: false },
  { id: "heat", label: "Product heat", icon: Flame, live: false },
  { id: "source", label: "Traffic source", icon: Compass, live: false },
];

export function LiveUaeMap({
  topLocations,
  lastLabel,
  streamer,
  money,
  locationSummary,
}: {
  topLocations: Array<{ label: string; orders: number; sales: number }>;
  lastLabel?: string;
  streamer: boolean;
  money: (n: number) => string;
  locationSummary?: LocationSummary[];
}) {
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({
    orders: true, sessions: false, carts: false, checkout: false,
    delivery: false, heat: false, source: false,
  });
  const [selected, setSelected] = useState<string | null>(null);

  const stats: EmirateStat[] = useMemo(() => {
    const byName = new Map(topLocations.map((l) => [l.label, l]));
    const byCode = new Map((locationSummary ?? []).map((l) => [l.emirateCode, l]));
    return EMIRATES.map((e) => {
      const s = byName.get(e.name);
      const loc = byCode.get(e.code);
      return {
        ...e,
        orders: loc?.orders ?? s?.orders ?? 0,
        sales: loc?.salesAed ?? s?.sales ?? 0,
        loc,
      };
    });
  }, [topLocations, locationSummary]);

  const anyProductHeat = stats.some((s) => s.loc?.topProductName);
  // Which layers are functionally live given current data availability.
  const layerCaps: Record<MapLayer, { live: boolean; reason?: string }> = {
    orders: { live: true },
    sessions: { live: false, reason: "Needs session location data" },
    carts: { live: false, reason: "Needs session location data" },
    checkout: { live: false, reason: "Needs session location data" },
    delivery: { live: false, reason: "Courier SLA not connected" },
    heat: { live: anyProductHeat, reason: anyProductHeat ? undefined : "No paid orders with product attribution yet" },
    source: { live: false, reason: "Needs per-emirate traffic source" },
  };

  const maxOrders = Math.max(1, ...stats.map((s) => s.orders));
  const activeEmirates = stats.filter((s) => s.orders > 0).length;
  const totalOrders = stats.reduce((a, b) => a + b.orders, 0);
  const totalSales = stats.reduce((a, b) => a + b.sales, 0);
  const hq = stats.find((s) => s.code === "DU")!;
  const activeStats = stats.filter((s) => s.orders > 0);
  const sel = selected ? stats.find((s) => s.code === selected) ?? null : null;

  const toggle = (id: MapLayer) =>
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm">Live UAE demand map</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            First-party e-commerce · signals across the seven emirates
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="gap-1 font-normal">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {activeEmirates} active
          </Badge>
          <Badge variant="outline" className="font-normal">{totalOrders} orders</Badge>
          {!streamer && (
            <Badge variant="outline" className="font-normal">{money(totalSales)}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Layer toggles */}
        <div className="flex flex-wrap gap-1.5">
          {LAYERS.map((l) => {
            const cap = layerCaps[l.id];
            const active = layers[l.id];
            const Icon = l.icon;
            return (
              <button
                key={l.id}
                onClick={() => cap.live && toggle(l.id)}
                disabled={!cap.live}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                } ${!cap.live ? "cursor-not-allowed opacity-60" : ""}`}
                title={cap.live ? l.label : `${l.label} · ${cap.reason ?? "coming soon"}`}
              >
                <Icon className="h-3 w-3" />
                {l.label}
                {!cap.live && (
                  <span className="ml-0.5 text-[9px] uppercase tracking-wide">
                    {cap.reason?.startsWith("Needs") ? "needs data" : "soon"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Map surface */}
        <div
          className="relative w-full overflow-hidden rounded-xl border border-border"
          style={{
            aspectRatio: "16 / 10",
            background:
              "radial-gradient(circle at 30% 20%, oklch(0.96 0.02 90 / 0.9), transparent 55%), radial-gradient(circle at 80% 90%, oklch(0.92 0.04 60 / 0.7), transparent 60%), linear-gradient(180deg, oklch(0.98 0.01 90), oklch(0.94 0.02 80))",
          }}
        >
          {/* Subtle grid */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <pattern id="uae-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.85 0.02 80)" strokeWidth="0.5" opacity="0.4" />
              </pattern>
              <linearGradient id="uae-arc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="oklch(0.65 0.14 30)" stopOpacity="0.9" />
                <stop offset="1" stopColor="oklch(0.75 0.12 220)" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#uae-grid)" />

            {/* Arcs from HQ (Dubai) to active emirates */}
            {layers.orders && activeStats
              .filter((s) => s.code !== "DU")
              .map((s) => {
                const x1 = hq.x, y1 = hq.y, x2 = s.x, y2 = s.y;
                const mx = (x1 + x2) / 2;
                const my = Math.min(y1, y2) - 8;
                return (
                  <path
                    key={s.code}
                    d={`M ${x1}% ${y1}% Q ${mx}% ${my}% ${x2}% ${y2}%`}
                    fill="none"
                    stroke="url(#uae-arc)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeDasharray="4 3"
                    opacity={0.75}
                  />
                );
              })}
          </svg>

          {/* Emirate nodes */}
          {stats.map((s) => {
            const isSel = selected === s.code;
            const isActive = s.orders > 0;
            const intensity = isActive ? 0.35 + 0.6 * (s.orders / maxOrders) : 0;
            const size = 10 + intensity * 22;
            return (
              <button
                key={s.code}
                onClick={() => setSelected(isSel ? null : s.code)}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                aria-label={`${s.name} — ${s.orders} orders`}
              >
                {isActive && layers.orders && (
                  <span
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/30"
                    style={{
                      width: size * 2.2,
                      height: size * 2.2,
                      animation: "ping 2.5s cubic-bezier(0,0,0.2,1) infinite",
                    }}
                  />
                )}
                <span
                  className={`relative block rounded-full border-2 transition ${
                    isActive
                      ? "border-white bg-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.35)]"
                      : "border-white/70 bg-muted-foreground/50"
                  } ${isSel ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : ""}`}
                  style={{ width: size, height: size }}
                />
                <span
                  className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-background/90 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur transition ${
                    isSel || isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                  }`}
                >
                  {s.name}
                  {isActive && <span className="ml-1 text-muted-foreground">· {s.orders}</span>}
                </span>
              </button>
            );
          })}

          {/* Overlay: empty state */}
          {totalOrders === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-xl border border-border bg-background/80 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur">
                <div className="font-medium text-foreground">Waiting for paid orders across the UAE…</div>
                <div className="mt-0.5">Signals will pulse on each emirate as orders come in.</div>
              </div>
            </div>
          )}

          {/* Overlay: last order */}
          {lastLabel && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Last order · <span className="font-medium text-foreground">{lastLabel}</span>
            </div>
          )}
        </div>

        {/* Selected emirate panel */}
        {sel && (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold">{sel.name}</span>
                  {sel.orders > 0 ? (
                    <Badge variant="secondary" className="text-[10px]">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Quiet</Badge>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {sel.orders > 0
                    ? "Demand signal detected in the last 24h."
                    : "No paid orders in this window. Consider a targeted campaign."}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)} className="h-7 text-xs">
                Close
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <SelStat label="Orders" value={String(sel.orders)} />
              <SelStat label="Sales" value={sel.orders && !streamer ? money(sel.sales) : sel.orders ? money(sel.sales) : "—"} />
              <SelStat
                label="Conversion"
                value={sel.loc?.conversionRate != null ? `${(sel.loc.conversionRate * 100).toFixed(1)}%` : "—"}
                hint={sel.loc?.conversionRate == null ? "needs data" : undefined}
              />
              <SelStat
                label="Sessions"
                value={sel.loc?.sessions != null ? String(sel.loc.sessions) : "—"}
                hint={sel.loc?.sessions == null ? "needs data" : undefined}
              />
              <SelStat
                label="Active carts"
                value={sel.loc?.activeCarts != null ? String(sel.loc.activeCarts) : "—"}
                hint={sel.loc?.activeCarts == null ? "needs data" : undefined}
              />
              <SelStat
                label="Delivery risk"
                value={sel.loc?.deliveryRisk ?? "—"}
                hint={sel.loc?.deliveryRisk == null ? "placeholder" : undefined}
              />
            </div>
            {sel.loc?.topProductName && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-[11px]">
                <span className="text-muted-foreground">Top product</span>
                <span className="truncate font-medium">{sel.loc.topProductName}</span>
                {sel.loc.topProductRevenueAed != null && !streamer && (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {money(sel.loc.topProductRevenueAed)}
                  </span>
                )}
              </div>
            )}
            {sel.loc?.lastOrderAt && (
              <div className="mt-1.5 text-[10px] text-muted-foreground">
                Last order · {new Date(sel.loc.lastOrderAt).toLocaleTimeString()}
              </div>
            )}
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Activity className="h-3 w-3" />
              Recommended: {recommendation(sel)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function recommendation(s: EmirateStat): string {
  if (s.orders === 0) return "Needs more location data · consider a targeted campaign.";
  if (s.loc?.checkoutAbandonment != null && s.loc.checkoutAbandonment > 0.5) return "Monitor checkout drop-off.";
  if (s.loc?.topProductName) return `Review inventory for ${s.loc.topProductName}.`;
  return "Check courier SLA and stock availability.";
}

function SelStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">
        {value}
        {hint && <span className="ml-1 text-[9px] font-normal uppercase text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
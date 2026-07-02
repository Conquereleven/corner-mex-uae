import { useEffect, useRef, useState } from "react";

type Point = { lat: number; lng: number; label: string; total?: number };
type Arc = { startLat: number; startLng: number; endLat: number; endLng: number; label?: string };

export function LiveGlobe({
  points,
  arcs,
  height = 520,
  stats,
}: {
  points: Point[];
  arcs: Arc[];
  height?: number;
  stats?: { orders: number; emirates: number; lastLabel?: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [Globe, setGlobe] = useState<any>(null);
  const [size, setSize] = useState({ w: 800, h: height });

  useEffect(() => {
    let mounted = true;
    import("react-globe.gl").then((m) => {
      if (mounted) setGlobe(() => m.default);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      if (ref.current) setSize({ w: ref.current.clientWidth, h: height });
    });
    ro.observe(ref.current);
    setSize({ w: ref.current.clientWidth, h: height });
    return () => ro.disconnect();
  }, [height]);

  return (
    <div ref={ref} style={{ height }} className="relative w-full overflow-hidden rounded-2xl border border-border bg-[oklch(0.18_0.02_240)]">
      {Globe ? (
        <Globe
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          // TODO: Replace external texture with local asset for offline resilience
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          atmosphereColor="#7dd3fc"
          atmosphereAltitude={0.18}
          pointsData={points}
          pointLat={(d: any) => d.lat}
          pointLng={(d: any) => d.lng}
          pointColor={() => "#34d399"}
          pointAltitude={(d: any) => Math.min(0.25, 0.02 + (d.total ?? 0) / 5000)}
          pointRadius={0.35}
          pointLabel={(d: any) => `<div style="padding:6px 10px;border-radius:6px;background:#0f172a;color:#fff;font-size:12px">${d.label}${d.total ? ` · AED ${d.total.toFixed(2)}` : ""}</div>`}
          arcsData={arcs}
          arcColor={() => ["rgba(125,211,252,0.6)", "rgba(167,139,250,0.6)"]}
          arcStroke={0.4}
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2200}
          arcAltitudeAutoScale={0.3}
          arcLabel={(d: any) => d.label}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading globe…</div>
      )}

      {stats && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>{stats.orders} paid orders</span>
            <span className="text-white/40">·</span>
            <span>{stats.emirates} emirates</span>
          </div>
          {stats.lastLabel && (
            <div className="mt-0.5 text-white/60">Last: {stats.lastLabel}</div>
          )}
        </div>
      )}

      {Globe && points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-xs text-white/70 backdrop-blur-sm">
            <div className="font-medium text-white/90">Waiting for paid orders…</div>
            <div className="mt-1 text-[11px] text-white/50">New orders appear here in real time.</div>
          </div>
        </div>
      )}
    </div>
  );
}
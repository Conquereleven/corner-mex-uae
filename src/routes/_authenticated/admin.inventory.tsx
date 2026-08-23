import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowDown, ArrowUp, Info, PackageSearch, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryControlTower } from "@/lib/inventory-intelligence.functions";
import {
  aggregateInventoryKpis,
  filterAndSortInventoryResults,
  formatPosture,
  posturePriority,
  primaryException,
  type InventoryTowerFilter,
  type InventoryTowerSort,
  type InventoryTowerSortKey,
} from "@/lib/inventory-control-tower";
import type { InventoryIntelligenceResult } from "@/lib/inventory-intelligence";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  head: () => ({ meta: [{ title: "Admin — Inventory control tower" }] }),
  component: InventoryControlTower,
});

const number = (value: number | null, digits = 0) =>
  value === null ? "—" : value.toLocaleString("en-AE", { maximumFractionDigits: digits });

const statusTone = (result: InventoryIntelligenceResult) => {
  if (result.posture === "stockout" || result.posture === "invalid_inventory")
    return "destructive" as const;
  if (result.status === "insufficient_data" || result.posture === "low_cover")
    return "secondary" as const;
  if (result.posture === "reorder_needed" || result.posture === "overstock")
    return "outline" as const;
  return "default" as const;
};

const STATUS_OPTIONS: Array<InventoryTowerFilter["status"]> = [
  "all",
  "stockout",
  "invalid_inventory",
  "insufficient_data",
  "low_cover",
  "reorder_needed",
  "overstock",
  "no_demand",
  "healthy",
  "inactive",
];
const EXCEPTION_OPTIONS: Array<InventoryTowerFilter["exception"]> = [
  "all",
  "STOCKOUT",
  "STOCKOUT_RISK",
  "LOW_COVER",
  "REORDER_NEEDED",
  "OVERSTOCK",
  "NO_DEMAND_SIGNAL",
  "MISSING_POLICY",
];

function InventoryControlTower() {
  const fetchTower = useServerFn(inventoryControlTower);
  const query = useQuery({
    queryKey: ["inventory-control-tower"],
    queryFn: () => fetchTower({}),
    refetchInterval: 60_000,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InventoryTowerFilter>({
    status: "all",
    exception: "all",
    quality: "all",
  });
  const [sort, setSort] = useState<InventoryTowerSort>({ key: "availableStock", direction: "asc" });
  const [sortTouched, setSortTouched] = useState(false);
  const [selected, setSelected] = useState<InventoryIntelligenceResult | null>(null);

  const results = query.data?.results ?? [];
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = filterAndSortInventoryResults(results, filter, sort).filter(
      (result) =>
        !needle || `${result.sku ?? ""} ${result.variantId}`.toLowerCase().includes(needle),
    );
    return sortTouched
      ? sorted
      : sorted.sort((a, b) => posturePriority(a.posture) - posturePriority(b.posture));
  }, [filter, results, search, sort, sortTouched]);
  const kpis = aggregateInventoryKpis(results);

  const sortBy = (key: InventoryTowerSortKey) => {
    setSortTouched(true);
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Inventory Control Tower</h1>
          <p className="text-sm text-muted-foreground">
            Evaluating deterministic inventory posture…
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton className="h-24" key={i} />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Card>
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">Inventory intelligence is unavailable</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The read-only inventory posture could not be loaded. No inventory or supplier state was
            changed.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metricCards = [
    ["Active SKUs evaluated", kpis.activeSkusEvaluated],
    ["Stockout", kpis.stockout],
    ["Stockout risk", kpis.stockoutRisk],
    ["Low cover", kpis.lowCover],
    ["Reorder needed", kpis.reorderNeeded],
    ["Overstock", kpis.overstock],
    ["Missing / insufficient data", kpis.insufficientData + kpis.invalidData],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Inventory Control Tower</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Exception-first view of deterministic inventory posture. Recommendations are advisory
            only and never create purchase orders.
          </p>
        </div>
        <Badge variant="outline">
          Read-only · {new Date(query.data.evaluatedAt).toLocaleTimeString()}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {metricCards.map(([label, value]) => (
          <Card key={label as string}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label as string}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl tabular-nums">{number(value as number)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Inventory posture</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Rows with the most urgent exceptions stay at the top.
              </p>
            </div>
            <Badge variant="secondary">Advisory recommendations</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU or variant ID"
              aria-label="Search SKU or variant ID"
            />
            <Select
              value={filter.status}
              onValueChange={(value) =>
                setFilter((current) => ({
                  ...current,
                  status: value as InventoryTowerFilter["status"],
                }))
              }
            >
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all" ? "All statuses" : formatPosture(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.exception}
              onValueChange={(value) =>
                setFilter((current) => ({
                  ...current,
                  exception: value as InventoryTowerFilter["exception"],
                }))
              }
            >
              <SelectTrigger aria-label="Filter by exception">
                <SelectValue placeholder="All exceptions" />
              </SelectTrigger>
              <SelectContent>
                {EXCEPTION_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all" ? "All exceptions" : value.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.quality}
              onValueChange={(value) =>
                setFilter((current) => ({
                  ...current,
                  quality: value as InventoryTowerFilter["quality"],
                }))
              }
            >
              <SelectTrigger aria-label="Filter by data quality">
                <SelectValue placeholder="All data quality" />
              </SelectTrigger>
              <SelectContent>
                {["all", "complete", "degraded", "insufficient"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all"
                      ? "All data quality"
                      : `${value[0].toUpperCase()}${value.slice(1)} data`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {visible.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
              <PackageSearch className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No inventory rows match these filters</p>
              <p className="text-sm text-muted-foreground">
                Try clearing the search or selecting all statuses.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU / product</TableHead>
                    <TableHead>
                      <SortButton
                        label="On hand"
                        sortKey="availableStock"
                        sort={sort}
                        onClick={sortBy}
                      />
                    </TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>
                      <SortButton
                        label="Avg daily demand"
                        sortKey="avgDailyDemand"
                        sort={sort}
                        onClick={sortBy}
                      />
                    </TableHead>
                    <TableHead>
                      <SortButton
                        label="Days of cover"
                        sortKey="daysOfCover"
                        sort={sort}
                        onClick={sortBy}
                      />
                    </TableHead>
                    <TableHead>
                      <SortButton
                        label="Reorder point"
                        sortKey="reorderPoint"
                        sort={sort}
                        onClick={sortBy}
                      />
                    </TableHead>
                    <TableHead>
                      <SortButton
                        label="Target stock"
                        sortKey="targetStock"
                        sort={sort}
                        onClick={sortBy}
                      />
                    </TableHead>
                    <TableHead>
                      <SortButton
                        label="Recommended qty"
                        sortKey="recommendedQuantity"
                        sort={sort}
                        onClick={sortBy}
                      />
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((result) => (
                    <TableRow
                      key={result.variantId}
                      className="cursor-pointer"
                      onClick={() => setSelected(result)}
                    >
                      <TableCell>
                        <div className="font-medium">{result.sku ?? "SKU unavailable"}</div>
                        <div className="text-xs text-muted-foreground">{result.variantId}</div>
                      </TableCell>
                      <TableCell>{number(result.metrics.quantityOnHand)}</TableCell>
                      <TableCell>{number(result.metrics.quantityReserved)}</TableCell>
                      <TableCell>{number(result.metrics.availableStock)}</TableCell>
                      <TableCell>{number(result.metrics.avgDailyDemand, 2)}</TableCell>
                      <TableCell>{number(result.metrics.daysOfCover, 1)}</TableCell>
                      <TableCell>{number(result.metrics.calculatedReorderPoint)}</TableCell>
                      <TableCell>{number(result.metrics.targetStock)}</TableCell>
                      <TableCell>
                        {number(result.recommendation.roundedSuggestedQuantity)}{" "}
                        <span className="text-[11px] text-muted-foreground">advisory</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusTone(result)}>{primaryException(result)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {selected ? <InventoryDetail result={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function SortButton({
  label,
  sortKey,
  sort,
  onClick,
}: {
  label: string;
  sortKey: InventoryTowerSortKey;
  sort: InventoryTowerSort;
  onClick: (key: InventoryTowerSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onClick(sortKey)}
    >
      {label}
      {active ? (
        sort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );
}

function InventoryDetail({
  result,
  onClose,
}: {
  result: InventoryIntelligenceResult;
  onClose: () => void;
}) {
  const metricRows: Array<[string, string]> = [
    ["On hand", number(result.metrics.quantityOnHand)],
    ["Reserved", number(result.metrics.quantityReserved)],
    ["Available", number(result.metrics.availableStock)],
    ["Average daily demand", number(result.metrics.avgDailyDemand, 2)],
    ["Demand source", result.metrics.demandSource.replaceAll("_", " ")],
    [
      "Observation window",
      result.metrics.demandObservationDays ? `${result.metrics.demandObservationDays} days` : "—",
    ],
    ["Days of cover", number(result.metrics.daysOfCover, 1)],
    ["Lead time", number(result.metrics.leadTimeDays)],
    ["Demand during lead time", number(result.metrics.demandDuringLeadTime, 2)],
    ["Safety stock", number(result.metrics.safetyStock)],
    ["Calculated reorder point", number(result.metrics.calculatedReorderPoint)],
    ["Configured reorder point", number(result.metrics.configuredReorderPoint)],
    ["Target stock", number(result.metrics.targetStock)],
    [
      "MOQ / case pack",
      `${number(result.metrics.minimumOrderQuantity)} / ${number(result.metrics.casePack)}`,
    ],
  ];
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inventory detail"
        className="absolute inset-0 h-full w-full cursor-default bg-black/30"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">SKU detail</p>
            <h2 className="mt-1 text-xl font-semibold">{result.sku ?? "SKU unavailable"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{result.variantId}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge variant={statusTone(result)}>{primaryException(result)}</Badge>
          <Badge variant="outline">Data quality: {result.quality.level}</Badge>
          <Badge variant="secondary">Advisory only</Badge>
        </div>
        <div className="mt-5 rounded-lg border bg-muted/20 p-3 text-sm">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>
              Recommended quantity is an explanation for operator review.{" "}
              <strong>createsPurchaseOrder = false</strong>; this surface has no inventory or
              supplier write action.
            </p>
          </div>
        </div>
        <section className="mt-6">
          <h3 className="font-semibold">Inputs and formula outputs</h3>
          <dl className="mt-3 divide-y rounded-lg border">
            {metricRows.map(([label, value]) => (
              <div className="flex justify-between gap-4 px-3 py-2 text-sm" key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="mt-6">
          <h3 className="font-semibold">Reason codes</h3>
          <div className="mt-3 space-y-2">
            {result.reasons.length ? (
              result.reasons.map((reason) => (
                <div className="rounded-lg border p-3" key={reason.code}>
                  <p className="text-sm font-medium">{reason.code.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{reason.explanation}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No exceptions detected.</p>
            )}
          </div>
        </section>
        <section className="mt-6">
          <h3 className="font-semibold">Data completeness</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.quality.level === "complete"
              ? "All required inputs were present."
              : "Inputs are incomplete or invalid; no commercial default was invented."}
          </p>
          {result.quality.missingInputs.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Missing: {result.quality.missingInputs.join(", ")}
            </p>
          ) : null}
          {result.quality.invalidInputs.length ? (
            <p className="mt-2 text-xs text-destructive">
              Invalid: {result.quality.invalidInputs.join(", ")}
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

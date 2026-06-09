import { useEffect, useState } from "react";
import { Flame, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ShopFilterState = {
  category?: string;
  q?: string;
  origin?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  bulk?: boolean;
  spice?: number;
  sort: "newest" | "price_asc" | "price_desc" | "most_viewed";
};

type Cat = { id: string; slug: string; name: string };

export function ShopFilters({
  state,
  update,
  reset,
  categories,
  origins,
  brands,
  resultCount,
}: {
  state: ShopFilterState;
  update: (patch: Partial<ShopFilterState>) => void;
  reset: () => void;
  categories: Cat[];
  origins: string[];
  brands: string[];
  resultCount?: number;
}) {
  const [minStr, setMinStr] = useState(state.priceMin?.toString() ?? "");
  const [maxStr, setMaxStr] = useState(state.priceMax?.toString() ?? "");
  useEffect(() => setMinStr(state.priceMin?.toString() ?? ""), [state.priceMin]);
  useEffect(() => setMaxStr(state.priceMax?.toString() ?? ""), [state.priceMax]);

  // Debounce price input → update
  useEffect(() => {
    const id = setTimeout(() => {
      const min = minStr === "" ? undefined : Math.max(0, Number(minStr) || 0);
      const max = maxStr === "" ? undefined : Math.max(0, Number(maxStr) || 0);
      if (min !== state.priceMin || max !== state.priceMax) {
        update({ priceMin: min, priceMax: max });
      }
    }, 350);
    return () => clearTimeout(id);
  }, [minStr, maxStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters =
    !!state.category || !!state.q || !!state.origin || !!state.brand ||
    state.priceMin != null || state.priceMax != null ||
    !!state.inStock || !!state.bulk || state.spice != null ||
    state.sort !== "newest";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg tracking-tight">Filters</h2>
          {typeof resultCount === "number" && (
            <p className="text-xs text-muted-foreground">{resultCount} products</p>
          )}
        </div>
        {hasFilters && (
          <button onClick={reset} className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground">
            Clear all
          </button>
        )}
      </div>

      <ActiveChips state={state} update={update} categories={categories} />

      <Accordion type="multiple" defaultValue={["category", "price", "availability", "sort"]} className="space-y-1">
        <Section value="category" title="Category">
          <div className="space-y-1.5">
            <FilterRadio
              label="All categories"
              checked={!state.category}
              onSelect={() => update({ category: undefined })}
            />
            {categories.map((c) => (
              <FilterRadio
                key={c.id}
                label={c.name}
                checked={state.category === c.slug}
                onSelect={() => update({ category: c.slug })}
              />
            ))}
          </div>
        </Section>

        <Section value="price" title="Price (AED)">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number" inputMode="numeric" min={0} placeholder="Min"
              value={minStr} onChange={(e) => setMinStr(e.target.value)}
              className="h-9"
            />
            <Input
              type="number" inputMode="numeric" min={0} placeholder="Max"
              value={maxStr} onChange={(e) => setMaxStr(e.target.value)}
              className="h-9"
            />
          </div>
        </Section>

        <Section value="availability" title="Availability">
          <div className="space-y-2">
            <CheckRow id="instock" label="In stock only" checked={!!state.inStock}
              onChange={(v) => update({ inStock: v || undefined })} />
            <CheckRow id="bulk" label="HORECA / Bulk" checked={!!state.bulk}
              onChange={(v) => update({ bulk: v || undefined })} />
          </div>
        </Section>

        {brands.length > 0 && (
          <Section value="brand" title="Brand">
            <ScrollList>
              <FilterRadio label="All brands" checked={!state.brand} onSelect={() => update({ brand: undefined })} />
              {brands.map((b) => (
                <FilterRadio key={b} label={b} checked={state.brand === b}
                  onSelect={() => update({ brand: b })} />
              ))}
            </ScrollList>
          </Section>
        )}

        {origins.length > 0 && (
          <Section value="origin" title="Country of origin">
            <ScrollList>
              <FilterRadio label="All origins" checked={!state.origin} onSelect={() => update({ origin: undefined })} />
              {origins.map((o) => (
                <FilterRadio key={o} label={o} checked={state.origin === o}
                  onSelect={() => update({ origin: o })} />
              ))}
            </ScrollList>
          </Section>
        )}

        <Section value="spice" title="Spice level">
          <div className="grid grid-cols-5 gap-1.5">
            <SpiceChip label="Any" active={state.spice == null} onClick={() => update({ spice: undefined })} />
            {[1, 2, 3, 4].map((n) => (
              <SpiceChip key={n}
                active={state.spice === n}
                onClick={() => update({ spice: n })}
                label={
                  <span className="flex items-center justify-center gap-0.5">
                    {Array.from({ length: n }).map((_, i) => <Flame key={i} className="h-3 w-3 fill-current" />)}
                  </span>
                }
              />
            ))}
          </div>
        </Section>

        <Section value="sort" title="Sort by">
          <div className="space-y-1.5">
            {[
              { v: "newest", l: "Newest" },
              { v: "price_asc", l: "Price: low to high" },
              { v: "price_desc", l: "Price: high to low" },
              { v: "most_viewed", l: "Most viewed" },
            ].map((o) => (
              <FilterRadio
                key={o.v}
                label={o.l}
                checked={state.sort === o.v}
                onSelect={() => update({ sort: o.v as ShopFilterState["sort"] })}
              />
            ))}
          </div>
        </Section>
      </Accordion>

      {hasFilters && (
        <Button variant="outline" className="w-full rounded-full" onClick={reset}>Clear all filters</Button>
      )}
    </div>
  );
}

function Section({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border-b border-border/60 last:border-b-0">
      <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">{title}</AccordionTrigger>
      <AccordionContent className="pb-4 pt-1">{children}</AccordionContent>
    </AccordionItem>
  );
}

function ScrollList({ children }: { children: React.ReactNode }) {
  return <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">{children}</div>;
}

function FilterRadio({ label, checked, onSelect }: { label: string; checked: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${checked ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <span className="truncate">{label}</span>
      {checked && <span className="ml-2 h-1.5 w-1.5 rounded-full bg-background" />}
    </button>
  );
}

function CheckRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">{label}</Label>
    </div>
  );
}

function SpiceChip({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-1.5 py-1.5 text-xs transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}

function ActiveChips({
  state, update, categories,
}: { state: ShopFilterState; update: (p: Partial<ShopFilterState>) => void; categories: Cat[] }) {
  const chips: Array<{ label: string; clear: () => void }> = [];
  if (state.category) {
    const c = categories.find((x) => x.slug === state.category);
    chips.push({ label: c?.name ?? state.category, clear: () => update({ category: undefined }) });
  }
  if (state.q) chips.push({ label: `"${state.q}"`, clear: () => update({ q: undefined }) });
  if (state.brand) chips.push({ label: state.brand, clear: () => update({ brand: undefined }) });
  if (state.origin) chips.push({ label: state.origin, clear: () => update({ origin: undefined }) });
  if (state.priceMin != null) chips.push({ label: `Min AED ${state.priceMin}`, clear: () => update({ priceMin: undefined }) });
  if (state.priceMax != null) chips.push({ label: `Max AED ${state.priceMax}`, clear: () => update({ priceMax: undefined }) });
  if (state.inStock) chips.push({ label: "In stock", clear: () => update({ inStock: undefined }) });
  if (state.bulk) chips.push({ label: "HORECA / Bulk", clear: () => update({ bulk: undefined }) });
  if (state.spice != null) chips.push({ label: `Spice ${state.spice}`, clear: () => update({ spice: undefined }) });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <button key={i} onClick={c.clear}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:border-foreground/40">
          {c.label}
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
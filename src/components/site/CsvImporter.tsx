import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { importProductsCsv } from "@/lib/csv-import.functions";

const HEADERS = [
  "slug", "name_en", "name_es", "name_ar", "description_en", "category_slug",
  "brand", "is_halal", "spice_level", "origin_region", "status", "sku",
  "price_aed", "compare_at_price_aed", "stock", "image_urls",
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim().length));
}

function toRowObjects(matrix: string[][]) {
  const [header, ...body] = matrix;
  return body.map((cells) => {
    const o: Record<string, any> = {};
    header.forEach((h, i) => { o[h.trim()] = cells[i] ?? ""; });
    // coerce
    const bool = (v: string) => /^(true|1|yes|y)$/i.test(String(v ?? "").trim());
    const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
    o.is_halal = o.is_halal === "" || o.is_halal == null ? true : bool(o.is_halal);
    o.spice_level = o.spice_level === "" ? null : num(o.spice_level);
    o.price_aed = num(o.price_aed);
    o.compare_at_price_aed = o.compare_at_price_aed === "" ? null : num(o.compare_at_price_aed);
    o.stock = num(o.stock) ?? 0;
    o.image_urls = String(o.image_urls ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    for (const k of ["name_es", "name_ar", "description_en", "category_slug", "brand", "origin_region", "sku"]) {
      if (o[k] === "") o[k] = null;
    }
    if (!o.status) o.status = "active";
    return o;
  });
}

export function CsvImporter({ sellerId, sellerLabel }: { sellerId?: string; sellerLabel?: string }) {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const run = useServerFn(importProductsCsv);

  const headersOk = useMemo(() => HEADERS.every((h) => rows.length === 0 || Object.prototype.hasOwnProperty.call(rows[0], h)), [rows]);

  const m = useMutation({
    mutationFn: () => run({ data: { rows, sellerId } }),
    onSuccess: (r: any) => {
      toast.success(t("dash.import.done", { created: r.created, updated: r.updated }));
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setParseErr("File exceeds 5MB"); return; }
    setFileName(f.name); setParseErr(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const matrix = parseCsv(String(reader.result ?? ""));
        if (matrix.length < 2) { setParseErr("CSV must contain a header row and at least one data row"); setRows([]); return; }
        const objs = toRowObjects(matrix);
        if (objs.length > 1000) { setParseErr("Maximum 1000 rows per file"); setRows([]); return; }
        setRows(objs);
        m.reset();
      } catch (err: any) { setParseErr(err.message ?? "Failed to parse CSV"); }
    };
    reader.readAsText(f);
  }

  const result = m.data as any;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5" /> {t("dash.import.title")}</CardTitle>
          <CardDescription>{t("dash.import.sub")} {sellerLabel ? <span className="ml-1 font-medium">→ {sellerLabel}</span> : null}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <a href="/templates/products-template.csv" download>
              <Button variant="outline" className="rounded-full"><Download className="me-2 h-4 w-4" /> {t("dash.import.template")}</Button>
            </a>
            <label className="inline-flex">
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              <span className="inline-flex h-10 cursor-pointer items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <FileUp className="me-2 h-4 w-4" /> {t("dash.import.choose")}
              </span>
            </label>
            {fileName && <span className="text-sm text-muted-foreground">{fileName} · {rows.length} {t("dash.import.rows")}</span>}
          </div>
          {parseErr && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {parseErr}
            </div>
          )}
          {rows.length > 0 && !headersOk && (
            <div className="rounded-md border border-amber-400/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              {t("dash.import.missingHeaders")}: {HEADERS.filter((h) => !Object.prototype.hasOwnProperty.call(rows[0], h)).join(", ")}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("dash.import.preview")}</CardTitle>
            <CardDescription>{t("dash.import.previewSub", { n: Math.min(rows.length, 10), total: rows.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="p-2">slug</th><th className="p-2">name_en</th><th className="p-2">price</th><th className="p-2">stock</th><th className="p-2">status</th><th className="p-2">category</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 font-mono text-xs">{r.slug}</td>
                      <td className="p-2">{r.name_en}</td>
                      <td className="p-2 tabular-nums">{r.price_aed} AED</td>
                      <td className="p-2 tabular-nums">{r.stock}</td>
                      <td className="p-2"><Badge variant="secondary">{r.status}</Badge></td>
                      <td className="p-2 text-muted-foreground">{r.category_slug ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => m.mutate()} disabled={!headersOk || m.isPending} className="rounded-full">
                {m.isPending ? <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("dash.import.running")}</> : t("dash.import.run", { n: rows.length })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> {t("dash.import.summary")}</CardTitle>
            <CardDescription>
              {t("dash.import.summarySub", { created: result.created, updated: result.updated, errors: result.errors.length, total: result.totalRows })}
            </CardDescription>
          </CardHeader>
          {result.errors.length > 0 && (
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="p-2">{t("dash.import.col.row")}</th><th className="p-2">slug</th><th className="p-2">{t("dash.import.col.error")}</th></tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e: any, i: number) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 tabular-nums">{e.row || "—"}</td>
                        <td className="p-2 font-mono text-xs">{e.slug ?? "—"}</td>
                        <td className="p-2 text-destructive">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminImportProductsCanonical } from "@/lib/admin-products-import.functions";

export const Route = createFileRoute("/_authenticated/admin/products/import")({
  head: () => ({ meta: [{ title: "Admin — Import products" }] }),
  component: AdminProductsImport,
});

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.trim()));
}

function toObjects(matrix: string[][]) {
  const [headers, ...body] = matrix;
  return body.map((cells) => {
    const raw = Object.fromEntries(
      headers.map((header, index) => [header.trim(), cells[index] ?? ""]),
    );
    const number = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const boolean = (value: string, fallback: boolean) =>
      value.trim() === "" ? fallback : /^(true|1|yes|y)$/i.test(value.trim());
    return {
      slug: raw.slug,
      name_en: raw.name_en,
      name_es: raw.name_es || null,
      name_ar: raw.name_ar || null,
      description_en: raw.description_en || null,
      category_slug: raw.category_slug || null,
      brand: raw.brand || null,
      is_halal: boolean(raw.is_halal ?? "", true),
      is_bulk: boolean(raw.is_bulk ?? "", false),
      spice_level: raw.spice_level ? number(raw.spice_level) : null,
      origin_region: raw.origin_region || null,
      status: raw.status || "draft",
      sku: raw.sku || null,
      format_label: raw.format_label || null,
      weight_grams: raw.weight_grams ? number(raw.weight_grams) : null,
      price_aed: number(raw.price_aed),
      compare_at_price_aed: raw.compare_at_price_aed ? number(raw.compare_at_price_aed) : null,
      stock: number(raw.stock) ?? 0,
      image_urls: String(raw.image_urls ?? "")
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean),
    };
  });
}

function AdminProductsImport() {
  const runImport = useServerFn(adminImportProductsCanonical);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => runImport({ data: { rows } }),
    onSuccess: (result) =>
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated`),
    onError: (error: Error) => toast.error(error.message),
  });

  function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setParseError("CSV exceeds 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const matrix = parseCsv(String(reader.result ?? ""));
        if (matrix.length < 2) throw new Error("CSV requires a header and at least one row");
        const objects = toObjects(matrix);
        if (objects.length > 1000) throw new Error("Maximum 1000 rows per import");
        setRows(objects);
        setFileName(file.name);
        setParseError(null);
        mutation.reset();
      } catch (error) {
        setRows([]);
        setParseError(error instanceof Error ? error.message : "CSV parsing failed");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Import products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Single-merchant CornerMex import. No Seller assignment. Stock is committed through the
          canonical atomic inventory transaction.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>CSV import</CardTitle>
          <CardDescription>
            Rows may create or update products by slug. Active rows require a positive price;
            otherwise they remain draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <a href="/templates/products-template.csv" download>
              <Button variant="outline">
                <Download className="me-2 h-4 w-4" /> Download template
              </Button>
            </a>
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              <FileUp className="me-2 h-4 w-4" /> Choose CSV
              <input
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => loadFile(event.target.files?.[0])}
              />
            </label>
            <Button asChild variant="ghost">
              <Link to="/admin/products">Back to products</Link>
            </Button>
          </div>
          {fileName ? (
            <p className="text-sm text-muted-foreground">
              {fileName} · {rows.length} rows ready
            </p>
          ) : null}
          {parseError ? <p className="text-sm text-destructive">{parseError}</p> : null}
          {rows.length ? (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Importing…" : `Import ${rows.length} rows`}
            </Button>
          ) : null}
          {mutation.data ? (
            <div className="rounded-lg border p-4 text-sm">
              <p>
                {mutation.data.created} created · {mutation.data.updated} updated ·{" "}
                {mutation.data.errors.length} errors
              </p>
              {mutation.data.errors.slice(0, 20).map((error) => (
                <p key={`${error.row}-${error.slug ?? "row"}`} className="text-destructive">
                  Row {error.row}
                  {error.slug ? ` (${error.slug})` : ""}: {error.error}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

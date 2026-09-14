import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminPoIntake,
  adminPoQueue,
  adminPoDetail,
  adminPoMappings,
  adminPoRevise,
} from "@/lib/po/admin.functions";
import type { PoMappings } from "@/lib/po/domain";
type Row = {
  id: string;
  po_number: string | null;
  mode: string;
  status: string;
  safe_code: string | null;
  created_at: string;
};
export function PoIntakePanel() {
  const intake = useServerFn(adminPoIntake),
    load = useServerFn(adminPoQueue),
    detail = useServerFn(adminPoDetail),
    saveMappings = useServerFn(adminPoMappings),
    revise = useServerFn(adminPoRevise);
  const queue = useQuery({ queryKey: ["po-intakes"], queryFn: () => load({}) });
  const [mode, setMode] = useState<"test" | "live">("test"),
    [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<{
      id: string;
      normalized_po: unknown;
      composed: unknown;
    } | null>(null);
  const [correction, setCorrection] = useState(""),
    [reason, setReason] = useState("");
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await fn();
      setMessage(JSON.stringify(result));
      await queue.refetch();
    } catch {
      setMessage(
        "Could not complete the request. Verify document format, approved mappings and database availability.",
      );
    } finally {
      setBusy(false);
    }
  };
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Maximum document size is 5 MB.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const mime = file.name.toLowerCase().endsWith(".json")
      ? "application/json"
      : file.name.toLowerCase().endsWith(".txt")
        ? "text/plain"
        : "application/pdf";
    return intake({
      data: {
        mode,
        organizationId: organization,
        source: "admin",
        sourceId: crypto.randomUUID(),
        mime,
        documentBase64: btoa(binary),
      },
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase order intake</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a PO to validate customer, location, products, prices and VAT. Invoice issuance is
          blocked pending separate activation.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Environment
            <select
              className="rounded border p-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as "test" | "live")}
            >
              <option value="test">Test organization</option>
              <option value="live">Live organization · review only</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Zoho organization ID
            <input
              className="rounded border p-2"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            PO document (PDF, JSON or text)
            <input
              type="file"
              accept=".pdf,.json,.txt"
              disabled={busy || !organization}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void action(() => upload(file));
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <details>
          <summary className="cursor-pointer text-sm">
            Approved customer, location and SKU mappings
          </summary>
          <p className="my-2 text-sm text-muted-foreground">
            Import a reviewed mapping file. This saves configuration only. Existing previews require
            revalidation after mappings change.
          </p>
          <input
            aria-label="Mapping configuration"
            type="file"
            accept=".json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void action(async () => {
                  if (file.size > 500000) throw new Error("File too large");
                  return saveMappings({ data: JSON.parse(await file.text()) as PoMappings });
                });
              e.target.value = "";
            }}
          />
        </details>
        {message && (
          <p role="status" className="break-all text-sm">
            {message}
          </p>
        )}
        {queue.isError ? (
          <p role="alert">
            PO intake is unavailable. Verify the migration before submitting documents.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">PO</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Exception</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {((queue.data ?? []) as Row[]).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.po_number ?? "Unparsed document"}</td>
                    <td>{row.mode}</td>
                    <td>{row.status.replaceAll("_", " ")}</td>
                    <td>{row.safe_code ?? "—"}</td>
                    <td>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const record = (await detail({
                              data: { id: row.id },
                            })) as typeof selected;
                            setSelected(record);
                            setCorrection(JSON.stringify(record?.normalized_po ?? {}, null, 2));
                            return { opened: true };
                          })
                        }
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queue.isLoading && Array.isArray(queue.data) && !queue.data.length && (
              <p className="p-2 text-sm">No purchase orders received.</p>
            )}
          </div>
        )}
        {selected && (
          <section className="space-y-3 rounded border p-4">
            <h3 className="font-medium">Document review</h3>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">
              {JSON.stringify(selected, null, 2)}
            </pre>
            <details>
              <summary className="cursor-pointer">Correct extraction and revalidate</summary>
              <p className="my-2 text-sm">
                Verify against the original document. Corrections preserve the original and are
                recorded in the audit trail. An uncertain provider creation cannot be reset here.
              </p>
              <label className="grid gap-1 text-sm">
                Normalized PO
                <textarea
                  className="h-64 rounded border p-2 font-mono text-xs"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Reason
                <input
                  className="rounded border p-2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button
                className="mt-2"
                disabled={busy || reason.trim().length < 10}
                onClick={() =>
                  void action(() =>
                    revise({
                      data: { id: selected.id, normalized: JSON.parse(correction), reason },
                    }),
                  )
                }
              >
                Validate correction
              </Button>
            </details>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ShieldX, FileText } from "lucide-react";
import { adminListKycSubmissions, adminReviewKyc } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/sellers/kyc")({
  head: () => ({ meta: [{ title: "KYC Verification — Admin" }] }),
  component: AdminKyc,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  verified: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function AdminKyc() {
  const listFn = useServerFn(adminListKycSubmissions);
  const reviewFn = useServerFn(adminReviewKyc);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-kyc"], queryFn: () => listFn({}) });
  const reviewMut = useMutation({
    mutationFn: (i: { sellerId: string; decision: "approve" | "reject"; reason?: string }) => reviewFn({ data: i }),
    onSuccess: () => { toast.success("Review saved"); qc.invalidateQueries({ queryKey: ["admin-kyc"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC Verification</h1>
        <p className="text-sm text-muted-foreground">Review trade licenses and supporting documents.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Submissions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.store_name}</div>
                    <div className="text-xs text-muted-foreground">{s.contact_email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[s.kyc_status] ?? ""}>{s.kyc_status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.kyc_submitted_at ? new Date(s.kyc_submitted_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {(s.kyc_documents ?? []).map((d: any) => (
                        <a key={d.kind} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="h-3 w-3" />{d.kind}
                        </a>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {s.kyc_status === "pending" && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => reviewMut.mutate({ sellerId: s.id, decision: "approve" })}>
                          <ShieldCheck className="h-3 w-3" />Approve
                        </Button>
                        <RejectDialog sellerId={s.id} onReject={(reason) => reviewMut.mutate({ sellerId: s.id, decision: "reject", reason })} />
                      </div>
                    )}
                    {s.kyc_status === "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => reviewMut.mutate({ sellerId: s.id, decision: "approve" })}>Approve</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No submissions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RejectDialog({ sellerId, onReject }: { sellerId: string; onReject: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-destructive"><ShieldX className="h-3 w-3" />Reject</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject KYC</DialogTitle>
          <DialogDescription>Tell the seller what they need to fix.</DialogDescription>
        </DialogHeader>
        <div>
          <Label>Reason</Label>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { if (!reason.trim()) return; onReject(reason); setOpen(false); }}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
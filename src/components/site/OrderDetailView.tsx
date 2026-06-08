import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Package, CreditCard, Truck, User, MapPin, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { statusColor } from "@/lib/dashboard-tokens";
import {
  adminSetOrderStatus,
  adminSetPaymentStatus,
  adminAddOrderNote,
} from "@/lib/admin.functions";
import { setOrderItemStatus, sellerAddOrderNote } from "@/lib/seller.functions";

const AED = (n: number | string) => `${Number(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];
const PAYMENT_STATUSES = ["pending", "paid", "partially_paid", "refunded", "failed", "cancelled"];
const ITEM_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];

export type OrderDetailRole = "admin" | "seller";

export function OrderDetailView({
  role,
  data,
  invalidateKey,
  backHref,
  customerHref,
}: {
  role: OrderDetailRole;
  data: any;
  invalidateKey: any[];
  backHref: string;
  customerHref?: string;
}) {
  const qc = useQueryClient();
  const order = data.order;
  const items: any[] = data.items ?? [];
  const notes: any[] = data.notes ?? [];
  const events: any[] = data.events ?? [];
  const shipments: any[] = data.shipments ?? [];
  const payments: any[] = data.payments ?? [];
  const buyer = data.buyer;
  const addr = order.shipping_address ?? {};

  const adminStatus = useServerFn(adminSetOrderStatus);
  const adminPayment = useServerFn(adminSetPaymentStatus);
  const adminNote = useServerFn(adminAddOrderNote);
  const sellerItem = useServerFn(setOrderItemStatus);
  const sellerNote = useServerFn(sellerAddOrderNote);

  const invalidate = () => qc.invalidateQueries({ queryKey: invalidateKey });

  const statusM = useMutation({
    mutationFn: (s: string) => adminStatus({ data: { orderId: order.id, status: s } }),
    onSuccess: () => { toast.success("Order status updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const payM = useMutation({
    mutationFn: (s: string) => adminPayment({ data: { orderId: order.id, status: s } }),
    onSuccess: () => { toast.success("Payment status updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const itemM = useMutation({
    mutationFn: (v: { itemId: string; status: string }) => sellerItem({ data: v }),
    onSuccess: () => { toast.success("Item status updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const [noteText, setNoteText] = useState("");
  const noteM = useMutation({
    mutationFn: () => role === "admin"
      ? adminNote({ data: { orderId: order.id, body: noteText } })
      : sellerNote({ data: { orderId: order.id, body: noteText } }),
    onSuccess: () => { toast.success("Note added"); setNoteText(""); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const subtotal = items.reduce((s, i) => s + Number(i.line_total_aed ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-5">
        <div className="min-w-0">
          <Link to={backHref} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">← Back to orders</Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 font-display text-3xl tracking-tight">
            {order.order_number}
            <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(order.status), color: statusColor(order.status) }}>{order.status}</Badge>
            <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(order.payment_status), color: statusColor(order.payment_status) }}>{order.payment_status}</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        {role === "admin" && (
          <div className="flex flex-wrap items-center gap-2">
            {(order.status !== "cancelled") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Cancel order</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                    <AlertDialogDescription>This will mark the order as cancelled. The buyer will see the change immediately.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep order</AlertDialogCancel>
                    <AlertDialogAction onClick={() => statusM.mutate("cancelled")}>Yes, cancel</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {(order.payment_status !== "refunded") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Mark refunded</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark payment refunded?</AlertDialogTitle>
                    <AlertDialogDescription>Use this after issuing the refund through your payment provider.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => payM.mutate("refunded")}>Confirm refund</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Items</CardTitle>
              <span className="text-xs text-muted-foreground">{items.length} line item{items.length === 1 ? "" : "s"}</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((i) => {
                const img = (i.product?.images ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order)[0]?.url;
                return (
                  <div key={i.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {img ? <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.product_name}</p>
                      {i.variant_label && <p className="text-xs text-muted-foreground">{i.variant_label}</p>}
                      {role === "admin" && i.seller?.store_name && (
                        <p className="text-xs text-muted-foreground">Seller: {i.seller.store_name}</p>
                      )}
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <div>{i.qty} × {AED(i.unit_price_aed)}</div>
                      <div className="font-medium">{AED(i.line_total_aed)}</div>
                    </div>
                    {role === "seller" ? (
                      <Select value={i.fulfillment_status} onValueChange={(v) => itemM.mutate({ itemId: i.id, status: v })}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ITEM_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="capitalize">{i.fulfillment_status}</Badge>
                    )}
                  </div>
                );
              })}
              <Separator />
              <div className="space-y-1 text-sm">
                <Row label="Subtotal" value={AED(order.subtotal_aed ?? subtotal)} />
                {Number(order.discount_aed ?? 0) > 0 && <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`} value={`- ${AED(order.discount_aed)}`} />}
                <Row label="Shipping" value={AED(order.shipping_aed)} />
                <Row label="VAT" value={AED(order.tax_aed)} />
                <div className="flex items-center justify-between pt-2 text-base font-semibold">
                  <span>Total</span><span className="tabular-nums">{AED(order.total_aed)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipments */}
          {shipments.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" /> Shipments</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {shipments.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 p-3">
                    <div>
                      <span className="font-medium uppercase">{s.carrier}</span>
                      {s.tracking_number && <span className="ml-2 font-mono text-xs">{s.tracking_number}</span>}
                      {s.tracking_url && <a className="ml-2 text-xs underline" href={s.tracking_url} target="_blank" rel="noreferrer">track</a>}
                    </div>
                    <Badge variant="secondary" className="capitalize">{s.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="Add an internal note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => noteM.mutate()} disabled={!noteText.trim() || noteM.isPending}>
                    {noteM.isPending ? "Saving…" : "Add note"}
                  </Button>
                </div>
              </div>
              <Separator />
              <ul className="space-y-3 text-sm">
                {notes.map((n) => (
                  <li key={n.id} className="rounded border border-border/60 bg-muted/40 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="capitalize">{n.author_role} note</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-sm">{e.message ?? e.kind}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()} · {e.actor_role}</p>
                    </div>
                  </li>
                ))}
                {notes.length === 0 && events.length === 0 && (
                  <li className="text-sm text-muted-foreground">No activity yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Status controls */}
          {role === "admin" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Manual controls</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Order status</p>
                  <Select value={order.status} onValueChange={(v) => statusM.mutate(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ORDER_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Payment status</p>
                  <Select value={order.payment_status} onValueChange={(v) => payM.mutate(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{buyer?.full_name ?? addr.recipient_name ?? "—"}</p>
              {buyer?.email && <p className="text-muted-foreground">{buyer.email}</p>}
              {(buyer?.phone || addr.phone) && <p className="text-muted-foreground">{buyer?.phone ?? addr.phone}</p>}
              {customerHref && buyer?.id && (
                <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
                  <Link to={customerHref} params={{ id: buyer.id } as any}>View customer</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Shipping address</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{addr.recipient_name ?? "—"}</p>
              {addr.phone && <p className="text-muted-foreground">{addr.phone}</p>}
              <p className="text-muted-foreground">{[addr.building, addr.street, addr.area, addr.emirate].filter(Boolean).join(", ")}</p>
              {addr.landmark && <p className="text-xs text-muted-foreground">Landmark: {addr.landmark}</p>}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" /> Payment</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Method" value={(order.payment_method ?? "").replace(/_/g, " ")} />
              <Row label="Status" value={order.payment_status} />
              <Row label="Total" value={AED(order.total_aed)} />
              {payments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {payments.map((p) => (
                    <div key={p.id} className="rounded border border-border/60 p-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">{p.provider}</span><span>{p.status}</span></div>
                      {p.provider_ref && <div className="font-mono text-[10px] text-muted-foreground">{p.provider_ref}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Order notes</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="capitalize text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
import { Check, Circle, Clock, History, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getSellerItemActions } from "@/lib/order-experience-contract";

const FULFILLMENT_FLOW = ["pending", "preparing", "shipped", "delivered"];

export function FulfillmentTimeline({ status, shipments }: { status: string; shipments: any[] }) {
  const current = FULFILLMENT_FLOW.indexOf(status);
  return (
    <ol className="grid gap-4 sm:grid-cols-4">
      {FULFILLMENT_FLOW.map((step, index) => {
        const complete = current >= index || (step === "shipped" && shipments.length > 0);
        const Icon = complete ? Check : Circle;
        return (
          <li key={step} className="flex gap-3 sm:flex-col">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${complete ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium capitalize">{step}</p>
              <p className="text-xs text-muted-foreground">
                {step === "shipped" && shipments[0]?.shipped_at
                  ? new Date(shipments[0].shipped_at).toLocaleString()
                  : complete
                    ? "Completed"
                    : "Pending"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SellerItemControls({
  item,
  onSelect,
}: {
  item: { id: string; fulfillment_status: string };
  onSelect: (status: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge variant="outline" className="capitalize">
        {item.fulfillment_status}
      </Badge>
      {getSellerItemActions(item.fulfillment_status).map((action) => (
        <Button
          data-testid={`seller-item-${action.nextStatus}`}
          key={action.nextStatus}
          size="sm"
          variant={action.variant}
          onClick={() => onSelect(action.nextStatus)}
        >
          {action.label}
        </Button>
      ))}
      {item.fulfillment_status === "preparing" && (
        <span className="max-w-48 text-right text-xs text-muted-foreground">
          Create a shipment from the orders list to mark it shipped.
        </span>
      )}
    </div>
  );
}

export function SellerShipmentPresentation({ shipments }: { shipments: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" /> Shipments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {shipments.map((shipment) => (
          <div
            key={shipment.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 p-3"
          >
            <div>
              <span className="font-medium uppercase">{shipment.carrier}</span>
              {shipment.tracking_number && (
                <span className="ml-2 font-mono text-xs">{shipment.tracking_number}</span>
              )}
              {shipment.tracking_url && (
                <a
                  className="ml-2 text-xs underline"
                  href={shipment.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  track
                </a>
              )}
            </div>
            <Badge variant="secondary" className="capitalize">
              {shipment.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SellerInternalNotes({
  notes,
  events,
  noteText,
  notePending,
  onNoteTextChange,
  onAddNote,
}: {
  notes: any[];
  events: any[];
  noteText: string;
  notePending: boolean;
  onNoteTextChange: (value: string) => void;
  onAddNote: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Add an internal note…"
            value={noteText}
            onChange={(event) => onNoteTextChange(event.target.value)}
            rows={2}
          />
          <div className="flex justify-end">
            <Button
              data-testid="seller-add-note"
              size="sm"
              onClick={onAddNote}
              disabled={!noteText.trim() || notePending}
            >
              {notePending ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
        <Separator />
        <ul className="space-y-3 text-sm">
          {notes.map((note) => (
            <li key={note.id} className="rounded border border-border/60 bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{note.author_role} note</span>
                <span>{new Date(note.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="flex-1">
                <p className="text-sm">{event.message ?? event.kind}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()} · {event.actor_role}
                </p>
              </div>
            </li>
          ))}
          {notes.length === 0 && events.length === 0 && (
            <li className="text-sm text-muted-foreground">No activity yet.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export type AdminLifecycleEvent = {
  id: string;
  transition_type: string;
  previous_value: string;
  new_value: string;
  actor_id: string;
  created_at: string;
};

export function AdminLifecycleAudit({ events }: { events: AdminLifecycleEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" /> Lifecycle audit
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lifecycle transitions recorded.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {event.transition_type.replace(/_/g, " ")}: {event.previous_value} →{" "}
                  {event.new_value}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()} · actor{" "}
                  {String(event.actor_id).slice(0, 8)}…
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

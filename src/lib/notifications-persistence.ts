export type NotificationKind =
  | "order_placed"
  | "order_shipped"
  | "order_delivered"
  | "new_sale"
  | "shipment_created"
  | "shipment_delivered"
  | "quote_response"
  | "payout_paid"
  | "loyalty_earned"
  | "return_requested"
  | "return_resolved"
  | "payout_auto_requested"
  | "payout_requested"
  | "kyc_approved"
  | "kyc_rejected"
  | "kyc_submitted";

export interface NotifyParams {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  orderId?: string | null;
  shipmentId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type CreateNotificationResult = { ok: true } | { ok: false; error: string };

interface NotificationInsertClient {
  from(table: "notifications"): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
}

/** Canonical persistence seam; injectable so the real insert contract can be integration-tested. */
export async function persistNotification(
  client: NotificationInsertClient,
  p: NotifyParams,
): Promise<CreateNotificationResult> {
  try {
    const { error } = await client.from("notifications").insert({
      user_id: p.userId,
      kind: p.kind,
      title: p.title,
      body: p.body ?? null,
      link: p.link ?? null,
      order_id: p.orderId ?? null,
      shipment_id: p.shipmentId ?? null,
      metadata: p.metadata ?? null,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown notification insert failure",
    };
  }
}

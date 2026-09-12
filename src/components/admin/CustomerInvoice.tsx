import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrderInvoice } from "@/lib/invoice-projection.functions";
export function CustomerInvoice({ orderId }: { orderId: string }) {
  const load = useServerFn(getOrderInvoice);
  const { data } = useQuery({
    queryKey: ["order-invoice", orderId],
    queryFn: () => load({ data: { orderId } }),
  });
  const invoice = data?.invoice;
  if (!invoice) return null;
  return (
    <section className="rounded-xl border p-4">
      <h2 className="font-medium">Invoice {invoice.number ?? invoice.reference}</h2>
      <p className="text-sm text-muted-foreground">
        {invoice.status}
        {invoice.issuedDate ? ` · ${invoice.issuedDate}` : ""}
      </p>
      {invoice.url ? (
        <a
          className="text-sm underline"
          href={invoice.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View invoice
        </a>
      ) : (
        <p className="text-sm">
          Your invoice reference is available. Online document access is not available yet.
        </p>
      )}
    </section>
  );
}

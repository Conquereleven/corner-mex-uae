import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Users, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sellerListCustomers } from "@/lib/seller.functions";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/seller/customers/")({
  head: () => ({ meta: [{ title: "Seller — Customers" }] }),
  component: SellerCustomers,
});

const AED = (n: number) =>
  `${Number(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  order_count: number;
  gmv: number;
  last_order_at: string | null;
};

function SellerCustomers() {
  const fn = useServerFn(sellerListCustomers);
  const q = useQuery({ queryKey: ["seller-customers"], queryFn: () => fn({}) });
  const [search, setSearch] = useState("");
  const all = useMemo(() => (q.data ?? []) as CustomerRow[], [q.data]);
  const rows = useMemo(() => {
    if (!search) return all;
    const s = search.toLowerCase();
    return all.filter((c) =>
      [c.full_name, c.email, c.phone, c.company_name].some((x) =>
        (x ?? "").toLowerCase().includes(s),
      ),
    );
  }, [all, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="People who have purchased from your store."
        icon={Users}
        breadcrumbs={[{ label: "Seller Studio", to: "/seller" }, { label: "Customers" }]}
      />
      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="As buyers place orders, they'll appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-right">Last order</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link
                          to="/seller/customers/$id"
                          params={{ id: c.id }}
                          className="font-medium hover:underline"
                        >
                          {c.full_name}
                        </Link>
                        {c.company_name && (
                          <div className="text-xs text-muted-foreground">{c.company_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.order_count}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {AED(c.gmv)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="icon" variant="ghost">
                          <Link
                            to="/seller/customers/$id"
                            params={{ id: c.id }}
                            aria-label={`View ${c.full_name ?? "customer"} details`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ListPlus,
  PackageSearch,
  RefreshCw,
  X,
} from "lucide-react";
import { AccountNavigation } from "@/components/account/AccountNavigation";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addB2bSavedListItem,
  buildB2bReorderDraft,
  createB2bSavedList,
  getB2bAccounts,
  getB2bReorderOrders,
  getB2bSavedLists,
  removeB2bSavedListItem,
  reorderB2bSavedListItems,
  renameB2bSavedList,
  searchB2bVariants,
  setB2bSavedListQuantity,
  type B2bReorderOrder,
  type B2bReorderLine,
  type B2bSavedList,
  type B2bVariant,
} from "@/lib/b2b-portal.functions";
import {
  getB2bAvailabilityStatus,
  hasSpecialAccountPrice,
  type B2bAvailabilityStatus,
  type B2bPriceStatus,
} from "@/lib/b2b-portal";
import { useB2bReorderIntent } from "@/lib/b2b-reorder-intent";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/account/b2b-portal")({
  head: () => ({ meta: [{ title: "B2B portal — CornerMex" }] }),
  component: B2bPortalPage,
});

const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "CM_B2B_PORTAL_UNAVAILABLE";
  if (message.includes("MEMBERSHIP"))
    return "Your active B2B account membership is required for this action.";
  if (message.includes("DESIRED_QUANTITY") || message.includes("QUANTITY"))
    return "Enter a whole quantity from 1 to 100,000.";
  return "This B2B action could not be completed. Nothing was ordered or changed outside this portal.";
};

function B2bPortalPage() {
  const queryClient = useQueryClient();
  const accountsFn = useServerFn(getB2bAccounts);
  const searchFn = useServerFn(searchB2bVariants);
  const listsFn = useServerFn(getB2bSavedLists);
  const ordersFn = useServerFn(getB2bReorderOrders);
  const createListFn = useServerFn(createB2bSavedList);
  const addItemFn = useServerFn(addB2bSavedListItem);
  const setQuantityFn = useServerFn(setB2bSavedListQuantity);
  const removeItemFn = useServerFn(removeB2bSavedListItem);
  const reorderItemsFn = useServerFn(reorderB2bSavedListItems);
  const renameListFn = useServerFn(renameB2bSavedList);
  const draftFn = useServerFn(buildB2bReorderDraft);
  const setReorderIntent = useB2bReorderIntent((state) => state.setDraft);
  const accounts = useQuery({ queryKey: ["b2b-accounts"], queryFn: () => accountsFn({}) });
  const [accountId, setAccountId] = useState<string>();
  const [search, setSearch] = useState("");
  const [newListName, setNewListName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [intentReady, setIntentReady] = useState(false);

  useEffect(() => {
    if (!accountId && accounts.data?.accounts.length) setAccountId(accounts.data.accounts[0].id);
  }, [accountId, accounts.data]);

  const lists = useQuery({
    queryKey: ["b2b-saved-lists", accountId],
    queryFn: () => listsFn({ data: { accountId: accountId! } }),
    enabled: !!accountId,
  });
  const orders = useQuery({
    queryKey: ["b2b-reorder-orders", accountId],
    queryFn: () => ordersFn({ data: { accountId: accountId! } }),
    enabled: !!accountId,
  });
  const searchResults = useQuery({
    queryKey: ["b2b-variant-search", accountId, search.trim()],
    queryFn: () => searchFn({ data: { accountId: accountId!, query: search.trim() } }),
    enabled: !!accountId && search.trim().length > 0,
  });
  const reorderDraft = useQuery({
    queryKey: ["b2b-reorder-draft", accountId, selectedOrderId],
    queryFn: () => draftFn({ data: { accountId: accountId!, orderId: selectedOrderId! } }),
    enabled: !!accountId && !!selectedOrderId,
  });

  useEffect(() => {
    if (!reorderDraft.data) return;
    setDraftQuantities(
      Object.fromEntries(
        reorderDraft.data.lines
          .filter((line) => line.eligible && line.variantId)
          .map((line) => [line.variantId!, line.quantity]),
      ),
    );
    setIntentReady(false);
  }, [reorderDraft.data]);

  const refreshLists = () =>
    queryClient.invalidateQueries({ queryKey: ["b2b-saved-lists", accountId] });
  const createList = useMutation({
    mutationFn: () => createListFn({ data: { accountId: accountId!, name: newListName.trim() } }),
    onSuccess: () => {
      setNewListName("");
      setFeedback("Saved list created.");
      refreshLists();
    },
  });
  const addItem = useMutation({
    mutationFn: (input: { listId: string; variantId: string }) =>
      addItemFn({ data: { accountId: accountId!, ...input, desiredQuantity: 1 } }),
    onSuccess: () => {
      setFeedback("Item added to the saved list. Existing items increment deterministically.");
      refreshLists();
    },
  });
  const setQuantity = useMutation({
    mutationFn: (input: { listId: string; variantId: string; desiredQuantity: number }) =>
      setQuantityFn({ data: { accountId: accountId!, ...input } }),
    onSuccess: refreshLists,
  });
  const removeItem = useMutation({
    mutationFn: (input: { listId: string; variantId: string }) =>
      removeItemFn({ data: { accountId: accountId!, ...input } }),
    onSuccess: () => {
      setFeedback("Item removed from the saved list.");
      refreshLists();
    },
  });
  const reorderItems = useMutation({
    mutationFn: (input: { listId: string; variantIds: string[] }) =>
      reorderItemsFn({ data: { accountId: accountId!, ...input } }),
    onSuccess: refreshLists,
  });
  const renameList = useMutation({
    mutationFn: (input: { listId: string; name: string }) =>
      renameListFn({ data: { accountId: accountId!, ...input } }),
    onSuccess: () => {
      setFeedback("Saved list renamed.");
      refreshLists();
    },
  });

  const selectedAccount = accounts.data?.accounts.find((account) => account.id === accountId);
  const anyError =
    accounts.error ??
    lists.error ??
    orders.error ??
    searchResults.error ??
    reorderDraft.error ??
    createList.error ??
    addItem.error ??
    setQuantity.error ??
    removeItem.error ??
    reorderItems.error ??
    renameList.error;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Account-scoped B2B workspace</p>
            <h1 className="font-display text-4xl tracking-tight">Quick order &amp; saved lists</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Build a replenishment intent from the current catalogue. This area never places an
              order, takes payment, or reserves inventory.
            </p>
          </div>
          <AccountNavigation />
        </header>

        {accounts.isLoading && <PortalState title="Loading your B2B account…" />}
        {!accounts.isLoading && !accounts.data?.accounts.length && (
          <PortalState
            title="No active B2B membership"
            body="Ask your CornerMex account administrator to activate your business account membership."
          />
        )}
        {!!accounts.data?.accounts.length && (
          <>
            <Card className="mt-8">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Business account
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Label htmlFor="b2b-account" className="sr-only">
                      Active B2B account
                    </Label>
                    <select
                      id="b2b-account"
                      value={accountId}
                      onChange={(event) => setAccountId(event.target.value)}
                      className="h-9 rounded-md border bg-background px-3 text-sm font-medium"
                    >
                      {accounts.data.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                    {selectedAccount && (
                      <Badge variant="outline">{selectedAccount.role.replace("_", " ")}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">Account pricing · AED</p>
                  <p className="text-muted-foreground">
                    Current prices and availability are scoped to this membership.
                  </p>
                </div>
              </CardContent>
            </Card>

            {anyError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertTitle>Action unavailable</AlertTitle>
                <AlertDescription>{errorMessage(anyError)}</AlertDescription>
              </Alert>
            )}
            {feedback && (
              <p
                role="status"
                aria-live="polite"
                className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
              >
                {feedback}
              </p>
            )}

            <Tabs defaultValue="quick" className="mt-8">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="quick">Quick order</TabsTrigger>
                <TabsTrigger value="lists">Saved lists</TabsTrigger>
                <TabsTrigger value="reorder">Reorder</TabsTrigger>
              </TabsList>
              <TabsContent value="quick">
                <QuickOrder
                  search={search}
                  setSearch={setSearch}
                  loading={searchResults.isLoading}
                  items={searchResults.data?.items ?? []}
                  lists={lists.data?.lists ?? []}
                  onAdd={(listId, variantId) => addItem.mutate({ listId, variantId })}
                />
              </TabsContent>
              <TabsContent value="lists">
                <SavedLists
                  lists={lists.data?.lists ?? []}
                  loading={lists.isLoading}
                  name={newListName}
                  setName={setNewListName}
                  onCreate={() => createList.mutate()}
                  onRemove={(listId, variantId) => removeItem.mutate({ listId, variantId })}
                  onQuantity={(listId, variantId, desiredQuantity) =>
                    setQuantity.mutate({ listId, variantId, desiredQuantity })
                  }
                  onRename={(listId, name) => renameList.mutate({ listId, name })}
                  onMove={(listId, variantIds) => reorderItems.mutate({ listId, variantIds })}
                />
              </TabsContent>
              <TabsContent value="reorder">
                <ReorderPanel
                  orders={orders.data?.orders ?? []}
                  loading={orders.isLoading}
                  selectedOrderId={selectedOrderId}
                  setSelectedOrderId={setSelectedOrderId}
                  draft={reorderDraft.data?.lines ?? []}
                  draftLoading={reorderDraft.isLoading}
                  quantities={draftQuantities}
                  setQuantities={setDraftQuantities}
                  intentReady={intentReady}
                  prepareIntent={() => {
                    if (!accountId || !selectedOrderId) return;
                    setReorderIntent({
                      accountId,
                      sourceOrderId: selectedOrderId,
                      items: Object.entries(draftQuantities).map(([variantId, qty]) => ({
                        variantId,
                        qty,
                      })),
                    });
                    setIntentReady(true);
                    setFeedback(
                      "Reorder intent prepared locally. No order, payment, or inventory change was created.",
                    );
                  }}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </section>
    </SiteLayout>
  );
}

function PortalState({ title, body }: { title: string; body?: string }) {
  return (
    <Card className="mt-8">
      <CardContent className="py-10 text-center">
        <PackageSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h2 className="font-semibold">{title}</h2>
        {body && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>}
      </CardContent>
    </Card>
  );
}

function QuickOrder({
  search,
  setSearch,
  loading,
  items,
  lists,
  onAdd,
}: {
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  items: B2bVariant[];
  lists: B2bSavedList[];
  onAdd: (listId: string, variantId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Find a sellable variant</CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor="b2b-search">SKU or product name</Label>
        <Input
          id="b2b-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="e.g. salsa, CHI-001"
          className="mt-2 max-w-xl"
        />
        {loading && (
          <p className="mt-4 text-sm text-muted-foreground">Searching current sellable variants…</p>
        )}
        {search && !loading && !items.length && (
          <p className="mt-4 text-sm text-muted-foreground">
            No active, sellable variants match that search.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">
                  {item.name}
                  {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  SKU {item.sku ?? "—"} · {item.availableStock} available now
                </p>
                <PriceAvailability
                  catalogPriceAed={item.catalogPriceAed}
                  effectivePriceAed={item.effectivePriceAed}
                  priceStatus={item.priceStatus}
                  availability={getB2bAvailabilityStatus({
                    availableStock: item.availableStock,
                  })}
                />
              </div>
              {lists.length ? (
                <div className="flex flex-wrap gap-2">
                  {lists.map((list) => (
                    <Button
                      key={list.id}
                      size="sm"
                      variant="outline"
                      onClick={() => onAdd(list.id, item.variantId)}
                    >
                      <ListPlus /> Add to {list.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <Badge variant="outline">Create a saved list first</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type SavedListsProps = {
  lists: B2bSavedList[];
  loading: boolean;
  name: string;
  setName: (name: string) => void;
  onCreate: () => void;
  onRemove: (listId: string, variantId: string) => void;
  onQuantity: (listId: string, variantId: string, desiredQuantity: number) => void;
  onRename: (listId: string, name: string) => void;
  onMove: (listId: string, variantIds: string[]) => void;
};

function SavedLists({
  lists,
  loading,
  name,
  setName,
  onCreate,
  onRemove,
  onQuantity,
  onRename,
  onMove,
}: SavedListsProps) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Create a saved list</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="e.g. Weekly kitchen replenishment"
            className="max-w-md"
          />
          <Button disabled={!name.trim()} onClick={onCreate}>
            Create list
          </Button>
        </CardContent>
      </Card>
      {loading && <PortalState title="Loading saved lists…" />}
      {!loading && !lists.length && (
        <PortalState
          title="No saved lists yet"
          body="Create a list, then add current catalogue variants from Quick order."
        />
      )}
      {lists.map((list) => (
        <Card key={list.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{list.name}</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const nextName = window.prompt("Rename saved list", list.name)?.trim();
                  if (nextName && nextName !== list.name) onRename(list.id, nextName);
                }}
              >
                Rename list
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Items stay in this account. Adding the same variant increments its desired quantity,
              capped at 100,000.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {!list.items.length && (
              <p className="text-sm text-muted-foreground">No items in this list.</p>
            )}
            {list.items.map((item, index) => (
              <div
                key={item.variantId}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2"
              >
                <div className="min-w-48 flex-1">
                  <p className="font-medium">
                    {item.name}
                    {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.sku ?? "No SKU"} ·{" "}
                    {item.sellable ? `${item.availableStock} available now` : "Unavailable item"}
                  </p>
                  <PriceAvailability
                    catalogPriceAed={item.catalogPriceAed}
                    effectivePriceAed={item.effectivePriceAed}
                    priceStatus={item.priceStatus}
                    availability={getB2bAvailabilityStatus({
                      availableStock: item.availableStock,
                      requestedQuantity: item.desiredQuantity,
                      sellable: item.sellable,
                    })}
                  />
                </div>
                <Input
                  aria-label={`Desired quantity for ${item.name}`}
                  type="number"
                  min="1"
                  max="100000"
                  defaultValue={item.desiredQuantity}
                  className="w-24"
                  onBlur={(event) => {
                    const quantity = Number(event.target.value);
                    if (
                      Number.isInteger(quantity) &&
                      quantity >= 1 &&
                      quantity <= 100000 &&
                      quantity !== item.desiredQuantity
                    )
                      onQuantity(list.id, item.variantId, quantity);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={index === 0}
                  aria-label="Move item up"
                  onClick={() =>
                    onMove(
                      list.id,
                      list.items.map((x, i) =>
                        i === index
                          ? list.items[index - 1].variantId
                          : i === index - 1
                            ? item.variantId
                            : x.variantId,
                      ),
                    )
                  }
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={index === list.items.length - 1}
                  aria-label="Move item down"
                  onClick={() =>
                    onMove(
                      list.id,
                      list.items.map((x, i) =>
                        i === index
                          ? list.items[index + 1].variantId
                          : i === index + 1
                            ? item.variantId
                            : x.variantId,
                      ),
                    )
                  }
                >
                  <ArrowDown />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove item"
                  onClick={() => onRemove(list.id, item.variantId)}
                >
                  <X />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReorderPanel({
  orders,
  loading,
  selectedOrderId,
  setSelectedOrderId,
  draft,
  draftLoading,
  quantities,
  setQuantities,
  intentReady,
  prepareIntent,
}: {
  orders: B2bReorderOrder[];
  loading: boolean;
  selectedOrderId?: string;
  setSelectedOrderId: (id: string) => void;
  draft: B2bReorderLine[];
  draftLoading: boolean;
  quantities: Record<string, number>;
  setQuantities: (value: Record<string, number>) => void;
  intentReady: boolean;
  prepareIntent: () => void;
}) {
  const eligible = useMemo(() => draft.filter((line) => line.eligible && line.variantId), [draft]);
  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Prior orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading prior orders…</p>}
          {!loading && !orders.length && (
            <p className="text-sm text-muted-foreground">
              No prior orders are available for this authorized account user.
            </p>
          )}
          {orders.map((order) => (
            <Button
              key={order.id}
              variant={selectedOrderId === order.id ? "default" : "outline"}
              className="h-auto w-full justify-between py-3 text-left"
              onClick={() => setSelectedOrderId(order.id)}
            >
              <span>
                {order.orderNumber}
                <small className="mt-1 block font-normal opacity-80">
                  {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} items
                </small>
              </span>
              <RefreshCw />
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Current reorder draft</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current account price, stock and sellability replace historical order data. Historical
            prices are never reused as current prices.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedOrderId && (
            <p className="text-sm text-muted-foreground">
              Choose a prior order to prepare a replacement intent.
            </p>
          )}
          {draftLoading && (
            <p className="text-sm text-muted-foreground">Checking current availability…</p>
          )}
          {draft.map((line) => (
            <div
              key={`${line.variantId}-${line.name}`}
              className="flex flex-wrap items-center gap-2 rounded-md border p-3"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">
                  {line.name}
                  {line.variantLabel ? ` · ${line.variantLabel}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {line.sku ?? "No SKU"} · {line.availableStock} available now
                </p>
                {line.catalogPriceAed !== null &&
                line.effectivePriceAed !== null &&
                line.priceStatus !== null ? (
                  <PriceAvailability
                    catalogPriceAed={line.catalogPriceAed}
                    effectivePriceAed={line.effectivePriceAed}
                    priceStatus={line.priceStatus}
                    availability={getB2bAvailabilityStatus({
                      availableStock: line.availableStock,
                      requestedQuantity: quantities[line.variantId ?? ""] ?? line.quantity,
                      sellable: line.reason !== "inactive",
                    })}
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    Current price unavailable for this inactive variant
                  </p>
                )}
              </div>
              {line.eligible && line.variantId ? (
                <Input
                  type="number"
                  min="1"
                  max="100000"
                  value={quantities[line.variantId] ?? line.quantity}
                  className="w-24"
                  onChange={(event) => {
                    const quantity = Number(event.target.value);
                    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 100000)
                      setQuantities({ ...quantities, [line.variantId!]: quantity });
                  }}
                />
              ) : (
                <Badge variant="destructive">
                  {line.reason === "inactive" ? "Unavailable item" : "Out of stock"}
                </Badge>
              )}
            </div>
          ))}
          {!!draft.length && (
            <div className="rounded-md bg-muted p-3 text-sm">
              {eligible.length} of {draft.length} prior lines are eligible. Excluded lines are not
              added to the intent.
            </div>
          )}
          {eligible.length > 0 && <Button onClick={prepareIntent}>Prepare cart intent</Button>}
          {intentReady && (
            <p role="status" aria-live="polite" className="text-sm text-primary">
              Intent prepared for review. No checkout was started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PriceAvailability({
  catalogPriceAed,
  effectivePriceAed,
  priceStatus,
  availability,
}: {
  catalogPriceAed: number;
  effectivePriceAed: number;
  priceStatus: B2bPriceStatus;
  availability: B2bAvailabilityStatus;
}) {
  const special = hasSpecialAccountPrice(priceStatus);
  const availabilityLabel = {
    available: "Available",
    partial: "Partial availability",
    out_of_stock: "Out of stock",
    unavailable: "Unavailable variant",
  }[availability];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">{formatMoney(effectivePriceAed, "AED")}</span>
      {special && (
        <span className="text-xs text-muted-foreground line-through">
          {formatMoney(catalogPriceAed, "AED")}
        </span>
      )}
      {special && <Badge>Special account price</Badge>}
      {priceStatus === "expired_override" && (
        <Badge variant="outline">Account price expired · catalogue price shown</Badge>
      )}
      {priceStatus === "default" && <Badge variant="outline">Catalogue price</Badge>}
      <Badge variant={availability === "available" ? "secondary" : "destructive"}>
        {availabilityLabel}
      </Badge>
    </div>
  );
}

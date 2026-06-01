import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { listProductReviews, submitReview, myReviewForProduct } from "@/lib/reviews.functions";
import { useSession } from "@/lib/use-session";
import { toast } from "sonner";

function Stars({ value, onChange, size = 4 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          disabled={!onChange}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            className={`h-${size} w-${size} ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const fetchList = useServerFn(listProductReviews);
  const fetchMine = useServerFn(myReviewForProduct);
  const submit = useServerFn(submitReview);

  const list = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => fetchList({ data: { productId } }),
  });
  const mine = useQuery({
    queryKey: ["my-review", productId, user?.id ?? "anon"],
    queryFn: () => fetchMine({ data: { productId } }),
    enabled: !!user,
  });

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);

  // Hydrate form from existing
  if (mine.data && !open && (rating === 5 && title === "" && body === "")) {
    // do not auto-open but seed when opening
  }

  const m = useMutation({
    mutationFn: () => submit({ data: { productId, rating, title: title || undefined, body: body || undefined } }),
    onSuccess: () => {
      toast.success("Thanks for your review!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["my-review", productId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openForm() {
    if (mine.data) {
      setRating(mine.data.rating);
      setTitle(mine.data.title ?? "");
      setBody(mine.data.body ?? "");
    }
    setOpen(true);
  }

  return (
    <section className="mt-16 border-t border-border pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-tight">Customer reviews</h2>
          {list.data && list.data.count > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Stars value={Math.round(list.data.avg)} />
              <span className="text-sm text-muted-foreground">
                {list.data.avg.toFixed(1)} · {list.data.count} review{list.data.count === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        {user && (
          <Button variant="outline" className="rounded-full" onClick={openForm}>
            {mine.data ? "Edit your review" : "Write a review"}
          </Button>
        )}
      </div>

      {open && user && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <Label>Rating</Label>
          <div className="mt-1"><Stars value={rating} onChange={setRating} size={5} /></div>
          <div className="mt-3"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sums it up in a few words" /></div>
          <div className="mt-3"><Label>Your review</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="How did the product taste, ship, etc.?" /></div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Publish"}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (list.data?.reviews ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet — be the first.</p>
        ) : (
          (list.data!.reviews).map((r: any) => (
            <article key={r.id} className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="text-sm font-medium">{r.title || "Review"}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.body && <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>}
              <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">— {r.author}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toggleWishlist, wishlistIds } from "@/lib/wishlist.functions";
import { useSession } from "@/lib/use-session";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  className,
  size = "md",
}: {
  productId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const fetchIds = useServerFn(wishlistIds);
  const toggle = useServerFn(toggleWishlist);
  const q = useQuery({
    queryKey: ["wishlist-ids", user?.id ?? "anon"],
    queryFn: () => fetchIds({}),
    enabled: !!user,
  });
  const inList = (q.data ?? []).includes(productId);

  const m = useMutation({
    mutationFn: () => toggle({ data: { productId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wishlist-ids"] });
      qc.invalidateQueries({ queryKey: ["my-wishlist"] });
      toast.success(r.added ? "Added to wishlist" : "Removed from wishlist");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const px = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const ih = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <button
      type="button"
      aria-label="Toggle wishlist"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { toast.info("Sign in to save favorites"); return; }
        m.mutate();
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-background/90 backdrop-blur transition-colors hover:bg-background",
        px,
        inList && "text-primary",
        className,
      )}
    >
      <Heart className={cn(ih, inList && "fill-current")} />
    </button>
  );
}

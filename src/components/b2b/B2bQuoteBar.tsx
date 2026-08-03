import { ArrowRight, ClipboardList } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function B2bQuoteBar({ selectedCount }: { selectedCount: number }) {
  const label = selectedCount === 1 ? "1 product selected" : `${selectedCount} products selected`;
  return (
    <aside
      aria-label="Quote request selection"
      className="desert-glass desert-glass--elevated fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl p-2.5 pl-4 shadow-2xl md:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Saved for this browser session
          </p>
        </div>
      </div>
      {selectedCount > 0 ? (
        <Link to="/b2b">
          <Button className="min-h-11 rounded-xl px-4">
            Continue <ArrowRight className="ms-2 h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Button disabled className="min-h-11 rounded-xl px-4">
          Continue <ArrowRight className="ms-2 h-4 w-4" />
        </Button>
      )}
    </aside>
  );
}

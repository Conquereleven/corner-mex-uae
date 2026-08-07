import { ArrowLeft, ClipboardList } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function EmptyQuoteSelection() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-sand/60 p-6 text-center sm:p-8">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ClipboardList className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-2xl text-foreground">Your shortlist is empty</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Choose at least one Founder-approved Wave 1 product before preparing a request.
      </p>
      <Link to="/b2b/catalog" className="mt-5 inline-block">
        <Button variant="outline" className="min-h-11 rounded-full">
          <ArrowLeft className="me-2 h-4 w-4" /> Back to catalogue
        </Button>
      </Link>
    </div>
  );
}

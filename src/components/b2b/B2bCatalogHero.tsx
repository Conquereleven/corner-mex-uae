import { ArrowDown, ClipboardList } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function B2bCatalogHero({ selectedCount }: { selectedCount: number }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-obsidian text-background shadow-2xl shadow-primary/10 sm:rounded-[2.5rem]">
        <img
          src="/brand-kit/master-scenes/restaurant-b2b.jpg"
          alt="Hospitality team preparing a professional service"
          width={1800}
          height={1200}
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/90 to-obsidian/20" />
        <div className="relative max-w-3xl px-6 py-14 sm:px-10 sm:py-20 lg:px-16 lg:py-24">
          <span className="inline-flex min-h-8 items-center rounded-full border border-background/25 bg-background/10 px-3 text-[11px] uppercase tracking-[0.2em] text-background/80 backdrop-blur">
            CornerMex · Business catalogue
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            Build a Mexican pantry shortlist for your business.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-background/75 sm:text-lg">
            Explore a curated selection for UAE hospitality and retail. Pricing, availability,
            delivery and commercial terms are confirmed through a human-reviewed written quote.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#business-products">
              <Button
                size="lg"
                className="min-h-11 rounded-full bg-background text-foreground hover:bg-background/90"
              >
                Explore products <ArrowDown className="ms-2 h-4 w-4" />
              </Button>
            </a>
            <Link to="/b2b/quote">
              <Button
                size="lg"
                variant="outline"
                className="min-h-11 rounded-full border-background/35 bg-transparent text-background hover:bg-background/10 hover:text-background"
              >
                <ClipboardList className="me-2 h-4 w-4" />
                Quote selection · {selectedCount}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

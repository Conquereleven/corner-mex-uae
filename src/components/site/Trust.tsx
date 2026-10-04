import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle, RotateCcw, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

// Reusable trust layer for CM-COM-2A.
// Every signal rendered here must be factual: verified repository truth or a
// link to a page that explains the real current state. No fake badges, no
// invented guarantees, no urgency mechanics.

type TrustDestination = "/about" | "/contact" | "/delivery" | "/returns" | "/privacy" | "/terms";

export function TrustCard({
  icon: Icon,
  title,
  children,
  to,
  linkLabel,
  headingLevel = 3,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  to?: TrustDestination;
  linkLabel?: string;
  /**
   * Heading level for the card title. Callers pass the level that keeps the
   * page outline sequential (no skipped levels) where the card is rendered.
   */
  headingLevel?: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <Heading className="mt-3 font-display text-lg tracking-tight text-foreground">
        {title}
      </Heading>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{children}</p>
      {to && (
        <Link
          to={to}
          className="mt-3 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          {linkLabel ?? title}
        </Link>
      )}
    </div>
  );
}

/**
 * Compact row of factual trust entries for high-intent surfaces
 * (product detail, cart, checkout, B2B quote).
 */
export function TrustBar({ className, context }: { className?: string; context: "b2c" | "b2b" }) {
  return (
    <nav
      aria-label="Información de envíos, devoluciones y soporte"
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-sm text-muted-foreground",
        className,
      )}
    >
      <Link to="/delivery" className="inline-flex items-center gap-1.5 hover:text-foreground">
        <Truck className="h-3.5 w-3.5" aria-hidden="true" /> Envíos
      </Link>
      <Link to="/returns" className="inline-flex items-center gap-1.5 hover:text-foreground">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Devoluciones
      </Link>
      <Link to="/contact" className="inline-flex items-center gap-1.5 hover:text-foreground">
        {context === "b2b" ? (
          <>
            <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Atención a negocios
          </>
        ) : (
          <>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Contacto
          </>
        )}
      </Link>
    </nav>
  );
}

/**
 * Footer / policy-page navigation group across the public trust destinations.
 */
export function PolicyLinkGroup({
  className,
  exclude,
}: {
  className?: string;
  exclude?: TrustDestination;
}) {
  const links: Array<{ to: TrustDestination; label: string }> = [
    { to: "/about", label: "Nosotros" },
    { to: "/contact", label: "Contacto" },
    { to: "/delivery", label: "Envíos" },
    { to: "/returns", label: "Devoluciones" },
    { to: "/privacy", label: "Privacidad" },
    { to: "/terms", label: "Términos" },
  ];
  return (
    <nav aria-label="Empresa y políticas" className={cn("text-sm", className)}>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
        {links
          .filter((l) => l.to !== exclude)
          .map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="underline underline-offset-4 hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}

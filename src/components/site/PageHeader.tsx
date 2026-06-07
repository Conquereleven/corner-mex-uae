import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Unified page header for dashboard + storefront sections.
 * Replaces ad-hoc <div className="flex justify-between"> wrappers.
 */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 pb-2", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
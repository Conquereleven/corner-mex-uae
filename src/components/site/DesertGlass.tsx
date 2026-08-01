import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceTone = "surface" | "elevated" | "control";

export function DesertGlassSurface<T extends ElementType = "div">({
  as,
  tone = "surface",
  className,
  ...props
}: { as?: T; tone?: SurfaceTone; className?: string } & Omit<ComponentPropsWithoutRef<T>, "as">) {
  const Component = as ?? "div";
  return (
    <Component className={cn("desert-glass", `desert-glass--${tone}`, className)} {...props} />
  );
}

export function DesertGlassHeader(props: ComponentPropsWithoutRef<"header">) {
  return <DesertGlassSurface as="header" tone="elevated" {...props} />;
}

export function DesertGlassControl(props: ComponentPropsWithoutRef<"div">) {
  return <DesertGlassSurface tone="control" {...props} />;
}

export function DesertGlassDrawerShell(props: ComponentPropsWithoutRef<"aside">) {
  return <DesertGlassSurface as="aside" tone="elevated" {...props} />;
}

export function DesertGlassOverlay({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("desert-glass-overlay", className)} {...props} />;
}

export function DesertGlassBadge({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { children: ReactNode }) {
  return (
    <span className={cn("desert-glass-badge", className)} {...props}>
      {children}
    </span>
  );
}

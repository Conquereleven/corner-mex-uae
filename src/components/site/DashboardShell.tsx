import { Link, useRouterState } from "@tanstack/react-router";
import { LanguageProvider } from "./LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";

export type DashNav = { to: string; label: string };

export function DashboardShell({
  title,
  nav,
  backHref = "/",
  children,
}: {
  title: string;
  nav: DashNav[];
  backHref?: string;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <LanguageProvider>
      <div className="flex min-h-screen bg-muted/30">
        <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-background p-6 md:block">
          <Link to={backHref} className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to site
          </Link>
          <h2 className="font-display text-2xl tracking-tight">{title}</h2>
          <nav className="mt-8 flex flex-col gap-1 text-sm">
            {nav.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link key={n.to} to={n.to} className={`rounded-md px-3 py-2 transition-colors ${active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 p-6 md:p-10">{children}</main>
        <Toaster position="bottom-right" />
      </div>
    </LanguageProvider>
  );
}
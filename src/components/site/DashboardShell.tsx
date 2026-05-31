import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Globe, LogOut } from "lucide-react";
import { LanguageProvider } from "./LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGS } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export type DashNavItem = {
  to?: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};
export type DashNavGroup = {
  label: string;
  items: DashNavItem[];
};

export function DashboardShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: DashNavGroup[];
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <SidebarProvider>
        <DashSidebar title={title} subtitle={subtitle} nav={nav} />
        <SidebarInset>
          <TopBar title={title} nav={nav} />
          <main className="flex-1 bg-muted/30 p-4 sm:p-6 lg:p-8">{children}</main>
        </SidebarInset>
        <Toaster position="bottom-right" />
      </SidebarProvider>
    </LanguageProvider>
  );
}

function DashSidebar({ title, subtitle, nav }: { title: string; subtitle?: string; nav: DashNavGroup[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();
  const isActive = (to?: string) => !!to && (pathname === to || pathname.startsWith(to + "/"));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground font-display text-lg">C</span>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-display text-base leading-tight tracking-tight">{title}</p>
            {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {nav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.soon || !item.to ? (
                      <SidebarMenuButton tooltip={`${item.label} · ${t("dash.soon")}`} className="cursor-not-allowed opacity-55" disabled>
                        <item.icon />
                        <span>{item.label}</span>
                        <Badge variant="outline" className="ml-auto h-4 px-1 text-[9px] font-normal uppercase tracking-wider group-data-[collapsible=icon]:hidden">soon</Badge>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("dash.backToSite")}>
              <Link to="/">
                <ArrowLeft />
                <span>{t("dash.backToSite")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar({ title, nav }: { title: string; nav: DashNavGroup[] }) {
  const { i18n } = useTranslation();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const current = nav
    .flatMap((g) => g.items)
    .find((i) => i.to && (pathname === i.to || pathname.startsWith(i.to + "/")));

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <span className="truncate font-medium text-foreground/80">{title}</span>
        {current && (
          <>
            <span className="opacity-50">/</span>
            <span className="truncate text-foreground">{current.label}</span>
          </>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Language">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LANGS.map((l) => (
              <DropdownMenuItem key={l.code} onClick={() => i18n.changeLanguage(l.code)}>
                {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t("dash.signOut")}</span>
        </Button>
      </div>
    </header>
  );
}
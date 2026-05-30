import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShoppingBag, User, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGS } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/use-session";

export function Header() {
  const { t, i18n } = useTranslation();
  const change = (code: string) => i18n.changeLanguage(code);
  const cartCount = useCart((s) => s.items.reduce((a, i) => a + i.qty, 0));
  const { user } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Corner<span className="text-primary">Mex</span>
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">UAE</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/shop" className="transition-colors hover:text-foreground">{t("nav.shop")}</Link>
          <Link to="/b2b" className="transition-colors hover:text-foreground">{t("nav.b2b")}</Link>
          <Link to="/about" className="transition-colors hover:text-foreground">{t("nav.about")}</Link>
        </nav>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Language">
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LANGS.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => change(l.code)}>
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/account">
            <Button variant="ghost" size="icon" aria-label="Account">
              <User className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/cart">
            <Button variant="ghost" size="icon" aria-label="Cart" className="relative">
              <ShoppingBag className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
          </Link>
          {user ? (
            <Link to="/account" className="ms-2 hidden sm:block">
              <Button size="sm" variant="outline" className="rounded-full">
                Mi cuenta
              </Button>
            </Link>
          ) : (
            <Link to="/signup" className="ms-2 hidden sm:block">
              <Button size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                {t("nav.signup")}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Globe, DollarSign, Home, Search, Building2, User, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGS } from "@/lib/i18n";
import { useCurrency, CURRENCIES } from "@/lib/use-currency";
import { useSession } from "@/lib/use-session";
import { useCart } from "@/lib/cart";
import {
  DesertGlassBadge,
  DesertGlassControl,
  DesertGlassHeader,
} from "@/components/site/DesertGlass";

export function Header() {
  const { t, i18n } = useTranslation();
  const change = (code: string) => i18n.changeLanguage(code);
  const cur = useCurrency();
  const { user } = useSession();
  const cartCount = useCart((state) => state.items.reduce((total, item) => total + item.qty, 0));

  return (
    <>
      <DesertGlassHeader className="sticky inset-x-0 top-2 z-40 mx-2 rounded-2xl sm:top-3 sm:mx-4">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-5 lg:px-7">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Corner<span className="text-primary">Mex</span>
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              UAE
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <Link to="/shop" className="transition-colors hover:text-foreground">
              {t("nav.shop")}
            </Link>
            <Link to="/b2b" className="transition-colors hover:text-foreground">
              {t("nav.b2b")}
            </Link>
            <Link to="/about" className="transition-colors hover:text-foreground">
              {t("nav.about")}
            </Link>
          </nav>

          <div className="flex items-center gap-0.5">
            <DesertGlassBadge className="me-1 hidden border-primary/40 bg-primary/10 text-primary sm:inline-flex">
              Commercial preview
            </DesertGlassBadge>
            <Link to="/shop" search={{ sort: "newest" }} className="hidden sm:block">
              <Button variant="ghost" size="icon" aria-label="Search products">
                <Search className="h-4 w-4" />
              </Button>
            </Link>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Currency"
                  className="gap-1 px-2 text-xs"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  {cur.code}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {CURRENCIES.map((c) => (
                  <DropdownMenuItem key={c} onClick={() => cur.setCode(c)}>
                    {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/b2b/quote" className="ms-1 hidden sm:block">
              <Button size="sm" variant="outline" className="rounded-full">
                Manual quote
              </Button>
            </Link>
            <Link to={user ? "/account" : "/login"} className="ms-1">
              <Button variant="ghost" size="icon" aria-label={user ? "Account" : "Sign in"}>
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
          </div>
        </div>
      </DesertGlassHeader>
      <DesertGlassControl
        role="navigation"
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-3 z-40 grid min-h-14 grid-cols-5 rounded-2xl p-1.5 md:hidden"
      >
        <MobileLink to="/" label="Home" icon={Home} />
        <MobileLink to="/shop" label="Shop" icon={Search} />
        <MobileLink to="/b2b" label="Business" icon={Building2} />
        <MobileLink to={user ? "/account" : "/login"} label={user ? "Account" : "Sign in"} icon={User} />
        <MobileLink to="/cart" label={cartCount ? `Cart (${cartCount})` : "Cart"} icon={ShoppingBag} />
      </DesertGlassControl>
    </>
  );
}

function MobileLink({
  to,
  label,
  icon: Icon,
}: {
  to: "/" | "/shop" | "/b2b" | "/login" | "/account" | "/cart";
  label: string;
  icon: typeof Home;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-11 flex-col items-center justify-center rounded-xl text-[10px] font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="mb-0.5 h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

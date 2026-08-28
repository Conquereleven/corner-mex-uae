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
import { DesertGlassControl, DesertGlassHeader } from "@/components/site/DesertGlass";
import { NotificationsBell } from "@/components/site/NotificationsBell";
import { BrandLogo } from "@/components/site/BrandLogo";

export function Header() {
  const { i18n } = useTranslation();
  const change = (code: string) => i18n.changeLanguage(code);
  const cur = useCurrency();
  const { user } = useSession();
  const cartCount = useCart((state) => state.items.reduce((total, item) => total + item.qty, 0));
  // Legacy CM-COM-1B source sentinel: Commercial preview

  return (
    <>
      <DesertGlassHeader className="sticky inset-x-0 top-2 z-40 mx-2 rounded-2xl sm:top-3 sm:mx-4">
        <div className="intermex-header mx-auto grid min-h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5 lg:px-7">
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-5 text-sm font-medium text-muted-foreground lg:flex"
          >
            <Link to="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
            <Link to="/shop" className="transition-colors hover:text-foreground">
              Catalog
            </Link>
            <Link to="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
            <Link to="/about" className="transition-colors hover:text-foreground">
              About Us
            </Link>
            <Link to="/contact#find-us" className="transition-colors hover:text-foreground">
              Find Us
            </Link>
          </nav>

          <Link to="/" aria-label="Intermex UAE home" className="justify-self-center">
            <BrandLogo className="h-12 w-24 sm:h-14 sm:w-28" />
          </Link>

          <div className="flex items-center justify-end gap-0.5">
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
            <NotificationsBell />
            <Link to={user ? "/account" : "/login"} className="ms-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={user ? "Account" : "Sign in"}
                className="gap-1.5"
              >
                <User className="h-4 w-4" />
                <span className="hidden lg:inline">{user ? "Account" : "Sign in"}</span>
              </Button>
            </Link>
            <Link to="/cart">
              <Button variant="ghost" size="sm" aria-label="Cart" className="relative gap-1.5">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden lg:inline">Cart</span>
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
        className="fixed inset-x-3 bottom-3 z-40 grid min-h-14 grid-cols-5 rounded-2xl p-1.5 lg:hidden"
      >
        <MobileLink to="/" label="Home" icon={Home} />
        <MobileLink to="/shop" label="Catalog" icon={Search} />
        <MobileLink to="/b2b" label="Business" icon={Building2} />
        <MobileLink
          to={user ? "/account" : "/login"}
          label={user ? "Account" : "Sign in"}
          icon={User}
        />
        <MobileLink
          to="/cart"
          label={cartCount ? `Cart (${cartCount})` : "Cart"}
          icon={ShoppingBag}
        />
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

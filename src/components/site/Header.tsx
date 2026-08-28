import { Link } from "@tanstack/react-router";
import { Search, Store, Building2, User, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";
import { useCart } from "@/lib/cart";
import { DesertGlassControl, DesertGlassHeader } from "@/components/site/DesertGlass";
import { BrandLogo } from "@/components/site/BrandLogo";

export function Header() {
  const { user } = useSession();
  const cartCount = useCart((state) => state.items.reduce((total, item) => total + item.qty, 0));
  // Legacy CM-COM-1B source sentinel: Commercial preview. Shop and Business
  // remain independent public surfaces during this storefront migration.

  return (
    <>
      <DesertGlassHeader className="sticky inset-x-0 top-2 z-40 mx-2 rounded-2xl sm:top-3 sm:mx-4">
        <div className="intermex-header mx-auto grid min-h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-3 sm:px-5 lg:px-7">
          <Link to="/" aria-label="Intermex UAE home" className="justify-self-start">
            <BrandLogo className="h-11 w-24 sm:h-12 sm:w-28" />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center justify-center gap-1 text-sm font-semibold lg:flex"
          >
            <Link to="/shop" className="rounded-full px-4 py-2 transition-colors">
              Shop
            </Link>
            <Link to="/b2b" className="rounded-full px-4 py-2 transition-colors">
              Wholesale
            </Link>
            <Link to="/about" className="rounded-full px-4 py-2 transition-colors">
              About
            </Link>
            <Link to="/contact#find-us" className="rounded-full px-4 py-2 transition-colors">
              Find Us
            </Link>
          </nav>

          <div className="flex items-center justify-end gap-0.5">
            <Link to="/shop" search={{ sort: "newest" }}>
              <Button variant="ghost" size="sm" aria-label="Search products" className="gap-1.5">
                <Search className="h-4 w-4" />
                <span className="hidden xl:inline">Search</span>
              </Button>
            </Link>
            <Link to={user ? "/account" : "/login"} className="ms-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={user ? "Account" : "Sign in"}
                className="gap-1.5"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Account</span>
              </Button>
            </Link>
            <Link to="/cart">
              <Button variant="ghost" size="sm" aria-label="Cart" className="relative gap-1.5">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Cart</span>
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
        <MobileLink to="/shop" label="Shop" icon={Store} />
        <MobileLink to="/b2b" label="Wholesale" icon={Building2} />
        <MobileLink to="/shop" label="Search" icon={Search} />
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
  icon: typeof Store;
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

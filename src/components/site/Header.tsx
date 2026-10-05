import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, User, ShoppingBag, Menu, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LANGS } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";
import { useCart } from "@/lib/cart";
import { DesertGlassHeader } from "@/components/site/DesertGlass";
import { BrandLogo } from "@/components/site/BrandLogo";

export function Header() {
  const { i18n } = useTranslation();
  const { user } = useSession();
  const cartCount = useCart((state) => state.items.reduce((total, item) => total + item.qty, 0));
  // Shop and Business remain independent public surfaces.

  return (
    <>
      <DesertGlassHeader className="sticky inset-x-0 top-2 z-40 mx-2 rounded-2xl sm:top-3 sm:mx-4">
        <div className="cornermex-header mx-auto grid min-h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-3 sm:px-5 lg:px-7">
          <Link to="/" aria-label="CornerMex, inicio" className="justify-self-start">
            <BrandLogo surface="onIvory" className="h-11 w-24 sm:h-12 sm:w-28" />
          </Link>

          <nav
            aria-label="Navegación principal"
            className="hidden items-center justify-center gap-1 text-sm font-semibold lg:flex"
          >
            <Link to="/shop" className="rounded-full px-4 py-2 transition-colors">
              Tienda
            </Link>
            <Link to="/b2b" className="rounded-full px-4 py-2 transition-colors">
              Mayoreo
            </Link>
            <Link to="/about" className="rounded-full px-4 py-2 transition-colors">
              Nosotros
            </Link>
            <Link to="/contact#find-us" className="rounded-full px-4 py-2 transition-colors">
              Encuéntranos
            </Link>
          </nav>

          <div className="flex items-center justify-end gap-0.5">
            <Link to="/shop" search={{ sort: "newest" }}>
              <Button variant="ghost" size="sm" aria-label="Buscar productos" className="gap-1.5">
                <Search className="h-4 w-4" />
                <span className="hidden xl:inline">Buscar</span>
              </Button>
            </Link>
            <Link to={user ? "/account" : "/login"} className="ms-1 hidden lg:block">
              <Button
                variant="ghost"
                size="sm"
                aria-label={user ? "Mi cuenta" : "Iniciar sesión"}
                className="gap-1.5"
              >
                <User className="h-4 w-4" />
                <span className="hidden xl:inline">Cuenta</span>
              </Button>
            </Link>
            <Link to="/cart">
              <Button variant="ghost" size="sm" aria-label="Carrito" className="relative gap-1.5">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden xl:inline">Carrito</span>
                {cartCount > 0 && (
                  <span className="absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir menú"
                  className="ms-1 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="cornermex-mobile-menu w-[min(88vw,22rem)] border-border px-5"
              >
                <SheetHeader className="text-left">
                  <BrandLogo surface="onIvory" className="h-12 w-28" />
                  <SheetTitle>Explora CornerMex</SheetTitle>
                  <SheetDescription className="text-muted-foreground">
                    Despensa mexicana por pieza y por mayoreo.
                  </SheetDescription>
                </SheetHeader>

                <nav aria-label="Menú" className="mt-8 grid gap-1 text-base font-semibold">
                  <MobileMenuLink to="/shop">Tienda</MobileMenuLink>
                  <MobileMenuLink to="/b2b">Mayoreo</MobileMenuLink>
                  <MobileMenuLink to="/about">Nosotros</MobileMenuLink>
                  <MobileMenuLink to="/contact#find-us">Encuéntranos</MobileMenuLink>
                  <MobileMenuLink to={user ? "/account" : "/login"}>Cuenta</MobileMenuLink>
                </nav>

                <div className="mt-8 border-t border-white/20 pt-6">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Globe2 className="h-4 w-4" /> Idioma
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {LANGS.map((language) => (
                      <Button
                        key={language.code}
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-pressed={i18n.language === language.code}
                        onClick={() => i18n.changeLanguage(language.code)}
                        className="rounded-full border border-white/20"
                      >
                        {language.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </DesertGlassHeader>
    </>
  );
}

function MobileMenuLink({
  to,
  children,
}: {
  to: "/shop" | "/b2b" | "/about" | "/contact#find-us" | "/login" | "/account";
  children: string;
}) {
  return (
    <SheetClose asChild>
      <Link
        to={to}
        className="rounded-xl px-4 py-3 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {children}
      </Link>
    </SheetClose>
  );
}

import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function AccountNavigation({ includeHome = true }: { includeHome?: boolean }) {
  return (
    <nav aria-label="Cuenta" className="flex flex-wrap gap-2" data-testid="account-navigation">
      {includeHome && (
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/account">Account</Link>
        </Button>
      )}
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/orders">Mis pedidos</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/b2b-portal">Portal de negocios</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/notifications">Notificaciones</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/wishlist">Favoritos</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/loyalty">Recompensas</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/returns">Devoluciones</Link>
      </Button>
    </nav>
  );
}

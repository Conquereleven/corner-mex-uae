import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function AccountNavigation({ includeHome = true }: { includeHome?: boolean }) {
  return (
    <nav aria-label="Account" className="flex flex-wrap gap-2" data-testid="account-navigation">
      {includeHome && (
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/account">Account</Link>
        </Button>
      )}
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/orders">My Orders</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/b2b-portal">B2B portal</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/notifications">Notifications</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/wishlist">Wishlist</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/loyalty">Loyalty</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/account/returns">Returns</Link>
      </Button>
    </nav>
  );
}

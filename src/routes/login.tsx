import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accounts unavailable — Corner Mex commercial preview" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginUnavailable,
});

function LoginUnavailable() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          Customer account access is not active
        </h1>
        <p className="mt-4 text-muted-foreground">
          This public preview does not accept account sign-in or registration. Catalogue discovery
          remains available without an account.
        </p>
        <Link to="/shop">
          <Button className="mt-8 rounded-full">Browse the catalogue</Button>
        </Link>
      </section>
    </SiteLayout>
  );
}

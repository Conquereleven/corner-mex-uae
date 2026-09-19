import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Create an account — CornerMex" }, { name: "robots", content: "noindex" }],
  }),
  component: SignupUnavailable,
});

function SignupUnavailable() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Accounts
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          Email registration is not open
        </h1>
        <p className="mt-4 text-muted-foreground">
          This page does not collect signup details. To create an account, use Continue with Google
          on the sign-in page. You can explore the catalogue without an account.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/login">
            <Button className="rounded-full">Sign in</Button>
          </Link>
          <Link to="/shop">
            <Button variant="outline" className="rounded-full">
              Browse the catalogue
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

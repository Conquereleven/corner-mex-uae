import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Accounts unavailable — Corner Mex commercial preview" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignupUnavailable,
});

function SignupUnavailable() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          Account registration is not open
        </h1>
        <p className="mt-4 text-muted-foreground">
          This preview does not create customer accounts or collect signup details. You can explore
          the catalogue without registering.
        </p>
        <Link to="/shop">
          <Button className="mt-8 rounded-full">Browse the catalogue</Button>
        </Link>
      </section>
    </SiteLayout>
  );
}

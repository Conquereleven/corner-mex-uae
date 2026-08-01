import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — Corner Mex commercial preview" }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Privacy</h1>
        <div className="mt-8 space-y-6 text-base leading-7 text-muted-foreground">
          <section>
            <h2 className="font-display text-2xl text-foreground">This preview</h2>
            <p className="mt-2">
              The public catalogue can be browsed without creating an account. Newsletter signup,
              lead forms, checkout and payment collection are disabled.
            </p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">Technical data</h2>
            <p className="mt-2">
              The site may process essential technical information needed for security, reliability
              and language or cookie preferences. Non-essential cookies remain subject to your
              preferences.
            </p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-foreground">Manual enquiries</h2>
            <p className="mt-2">
              If you email CornerMex, the information you choose to provide is used to review and
              respond to that enquiry. It is not treated as an order or account registration.
            </p>
          </section>
          <p>
            Privacy requests:{" "}
            <a className="underline" href="mailto:privacy@cornermex.ae">
              privacy@cornermex.ae
            </a>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

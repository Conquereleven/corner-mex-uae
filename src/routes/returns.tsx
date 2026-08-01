import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";

export const Route = createFileRoute("/returns")({
  head: () => ({ meta: [{ title: "Returns — Corner Mex commercial preview" }] }),
  component: Returns,
});

function Returns() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Returns</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
          <p>
            CornerMex is not accepting online orders during this preview, so no website purchase or
            return process is active.
          </p>
          <p>
            If CornerMex later provides a manually approved quote, the applicable cancellation,
            return and refund terms will be stated in the written commercial documents before
            acceptance. Statutory rights under applicable UAE law are not limited by this preview
            notice.
          </p>
          <p>
            For a concern about a direct communication from CornerMex, contact{" "}
            <a className="underline" href={mailto(PUBLIC_CONTACT.complaints)}>
              {PUBLIC_CONTACT.complaints}
            </a>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

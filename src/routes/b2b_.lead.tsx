import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";

export const Route = createFileRoute("/b2b_/lead")({
  head: () => ({
    meta: [
      { title: "Manual business enquiry — Corner Mex" },
      {
        name: "description",
        content: "CornerMex business enquiries are reviewed manually during commercial preview.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManualEnquiry,
});

function ManualEnquiry() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          Business enquiries are handled manually
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          The website does not submit or store lead forms. Email CornerMex with the products,
          approximate volume and UAE destination you want us to review. Availability, AED pricing,
          delivery and commercial terms are confirmed only in a human-approved written quote.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={mailto(PUBLIC_CONTACT.b2b, "CornerMex manual quote request")}>
            <Button className="rounded-full">
              <Mail className="me-2 h-4 w-4" /> Email {PUBLIC_CONTACT.b2b}
            </Button>
          </a>
          <Link to="/b2b">
            <Button variant="outline" className="rounded-full">
              Back to business overview
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

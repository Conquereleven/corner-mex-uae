import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";

export const Route = createFileRoute("/b2b_/lead")({
  head: () => ({
    meta: [
      { title: "Business enquiry — CornerMex UAE" },
      {
        name: "description",
        content:
          "Submit a structured CornerMex B2B enquiry through the quote builder or contact the team manually by email.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessEnquiry,
});

function BusinessEnquiry() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Human-reviewed B2B
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Request a CornerMex B2B quote</h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Use the B2B catalogue to select products and submit a structured enquiry directly to the
          CornerMex commercial pipeline. Every request is reviewed by a person before pricing,
          availability, delivery or commercial terms are confirmed. A request is not an order.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/b2b/catalog">
            <Button className="rounded-full">Open B2B catalogue</Button>
          </Link>
          <a href={mailto(PUBLIC_CONTACT.b2b, "CornerMex manual quote request")}>
            <Button variant="outline" className="rounded-full">
              <Mail className="me-2 h-4 w-4" /> Email {PUBLIC_CONTACT.b2b}
            </Button>
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}

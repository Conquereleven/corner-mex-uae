import { createFileRoute } from "@tanstack/react-router";
import { Building2, Mail, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { businessIdentityLine } from "@/lib/business-identity";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/contact")({
  head: () => {
    const title = "Contact CornerMex — customer support and B2B enquiries in the UAE";
    const description =
      "Reach CornerMex by email for customer support, B2B and wholesale enquiries, or privacy and legal questions. Every enquiry is reviewed manually.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: siteUrl("/contact") },
      ],
      links: [{ rel: "canonical", href: siteUrl("/contact") }],
    };
  },
  component: Contact,
});

const CHANNELS = [
  {
    icon: Mail,
    title: "Customer support",
    description:
      "Questions about the catalogue, your cart or account, or an enquiry you have already sent.",
    email: PUBLIC_CONTACT.complaints,
    subject: "CornerMex customer enquiry",
  },
  {
    icon: Building2,
    title: "B2B and wholesale",
    description:
      "Restaurants, retailers and distributors. Quote requests are reviewed and answered manually in writing.",
    email: PUBLIC_CONTACT.b2b,
    subject: "CornerMex B2B enquiry",
  },
  {
    icon: ShieldCheck,
    title: "Privacy and legal",
    description: "Privacy requests, legal questions and formal correspondence.",
    email: PUBLIC_CONTACT.legal,
    subject: "CornerMex legal enquiry",
  },
];

function Contact() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          We read every message
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Contact CornerMex</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          CornerMex is reachable by email. Enquiries are reviewed by a person — sending one does not
          create an order, a contract or an automated process.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((channel) => (
            <div
              key={channel.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              <channel.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-display text-2xl tracking-tight">{channel.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {channel.description}
              </p>
              <a
                href={mailto(channel.email, channel.subject)}
                className="mt-4 inline-block break-all text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                {channel.email}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground">
          <p>{businessIdentityLine()}</p>
          <p className="mt-2">
            A phone line, street address for visits and published support hours are not yet
            available on this website. Email is currently the confirmed way to reach us.
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            More information
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/contact" />
        </div>
      </section>
    </SiteLayout>
  );
}

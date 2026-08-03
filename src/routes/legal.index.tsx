import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { siteUrl } from "@/lib/site-url";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";

const POLICIES = [
  {
    to: "/shipping" as const,
    title: "Shipping",
    summary: "How delivery is handled while online ordering remains off.",
  },
  {
    to: "/returns" as const,
    title: "Returns",
    summary: "The preview state and how future written terms will apply.",
  },
  {
    to: "/privacy" as const,
    title: "Privacy",
    summary: "What this public preview processes and how to contact us.",
  },
  {
    to: "/terms" as const,
    title: "Terms",
    summary: "The non-transactional terms of this commercial preview.",
  },
];

export const Route = createFileRoute("/legal/")({
  head: () => ({
    meta: [
      { title: "Policies — Corner Mex commercial preview" },
      {
        name: "description",
        content: "Shipping, returns, privacy and preview terms for CornerMex in the UAE.",
      },
      { property: "og:url", content: siteUrl("/legal") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/legal") }],
  }),
  component: LegalIndex,
});

function LegalIndex() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Commercial preview policies
        </div>
        <h1 className="mt-3 font-display text-5xl tracking-tight">
          Clear boundaries before commerce
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          CornerMex is currently a catalogue and manual-enquiry experience. Online orders, accounts,
          checkout, payments, live stock, marketplace participation and automated messaging are not
          active.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {POLICIES.map((policy) => (
            <Link
              key={policy.to}
              to={policy.to}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="mt-4 font-display text-2xl tracking-tight group-hover:underline">
                {policy.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{policy.summary}</p>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Legal questions:{" "}
          <a className="underline" href={mailto(PUBLIC_CONTACT.legal)}>
            {PUBLIC_CONTACT.legal}
          </a>
        </p>
      </section>
    </SiteLayout>
  );
}

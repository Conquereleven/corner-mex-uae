import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { siteUrl } from "@/lib/site-url";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { ONLINE_ORDERING_ENABLED } from "@/lib/commerce-mode";

const POLICIES = [
  {
    to: "/delivery" as const,
    title: "Delivery",
    summary: "Emirate-based coverage and how charges are confirmed before you commit.",
  },
  {
    to: "/returns" as const,
    title: "Returns",
    summary: "The preview state and how future written terms will apply.",
  },
  {
    to: "/privacy" as const,
    title: "Privacy",
    summary: "What CornerMex processes and how to contact us.",
  },
  {
    to: "/terms" as const,
    title: "Terms",
    summary: "The terms for using CornerMex and for website orders.",
  },
];

export const Route = createFileRoute("/legal/")({
  head: () => ({
    meta: [
      { title: "Policies — CornerMex" },
      {
        name: "description",
        content: "Delivery, returns, privacy and terms for CornerMex in the UAE.",
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
          <ShieldCheck className="h-3.5 w-3.5" /> Policies
        </div>
        <h1 className="mt-3 font-display text-5xl tracking-tight">
          Clear boundaries before commerce
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          {ONLINE_ORDERING_ENABLED
            ? "CornerMex supports catalogue discovery, customer accounts, cash-on-delivery orders for signed-in customers and manual B2B enquiries. Card payments, marketplace participation and automated messaging run only when authorized configuration is enabled."
            : "CornerMex currently supports catalogue discovery, optional accounts, B2C cart preparation and manual B2B enquiries. Order execution, payments, marketplace participation and automated messaging run only when authorized configuration is enabled."}
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

import { createFileRoute, notFound } from "@tanstack/react-router";
import { LegalDocPage } from "@/components/site/LegalDocPage";
import { getLegalDoc } from "@/lib/legal-docs";

export const Route = createFileRoute("/legal/$slug")({
  loader: ({ params }) => {
    const doc = getLegalDoc(params.slug);
    if (!doc) throw notFound();
    return { doc };
  },
  head: ({ loaderData, params }) => {
    const d = loaderData?.doc;
    const title = d ? `${d.title} — Corner Mex` : "Legal — Corner Mex";
    const desc = d?.summary ?? "Corner Mex legal documents.";
    const url = `https://corner-mex-uae.lovable.app/legal/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: LegalSlug,
});

function LegalSlug() {
  const { slug } = Route.useParams();
  return <LegalDocPage slug={slug} />;
}
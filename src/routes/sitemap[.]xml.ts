import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const origin = new URL(request.url).origin;
        const { LEGAL_DOCS } = await import("@/lib/legal-docs");
        const urls: string[] = [
          "/", "/shop", "/b2b", "/about", "/sellers", "/legal",
          ...LEGAL_DOCS.map((d) => `/legal/${d.slug}`),
        ];
        const { data: products } = await supabaseAdmin.from("products").select("slug, updated_at").eq("status", "active").limit(5000);
        const { data: sellers } = await supabaseAdmin.from("sellers").select("slug, updated_at").eq("status", "active").limit(1000);
        const items = [
          ...urls.map((u) => ({ loc: `${origin}${u}`, lastmod: new Date().toISOString() })),
          ...(products ?? []).map((p) => ({ loc: `${origin}/product/${p.slug}`, lastmod: p.updated_at })),
          ...(sellers ?? []).map((s) => ({ loc: `${origin}/sellers/${s.slug}`, lastmod: s.updated_at })),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
          .map((i) => `  <url><loc>${i.loc}</loc><lastmod>${new Date(i.lastmod).toISOString()}</lastmod></url>`)
          .join("\n")}\n</urlset>`;
        return new Response(xml, { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
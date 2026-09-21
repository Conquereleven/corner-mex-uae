import { createFileRoute } from "@tanstack/react-router";

// robots.txt is served dynamically so the Sitemap line follows whichever host
// the site is served from. The previous static public/robots.txt hardcoded the
// Railway host, which would have advertised the wrong sitemap after the domain
// cutover. See docs/cornermex-2/DOMAIN-CUTOVER.md.
const DISALLOW = ["/account", "/admin", "/seller", "/checkout", "/cart", "/login", "/signup"];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const body = [
          "User-agent: *",
          "Allow: /",
          ...DISALLOW.map((path) => `Disallow: ${path}`),
          "",
          `Sitemap: ${origin}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppErrorBoundary } from "@/components/site/AppErrorBoundary";
import { installRuntimeErrorLogger } from "@/lib/runtime-error-logger";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Corner Mex — Authentic Mexican pantry in the UAE" },
      { name: "description", content: "Authentic Mexican chiles, salsas, masa and snacks — sourced for the UAE. Shop retail or order in bulk for your venue, directly from CornerMex." },
      { property: "og:title", content: "Corner Mex — Authentic Mexican pantry in the UAE" },
      { property: "og:description", content: "Authentic Mexican chiles, salsas, masa and snacks — sourced for the UAE. Shop retail or order in bulk for your venue, directly from CornerMex." },
      { property: "og:site_name", content: "Corner Mex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Corner Mex — Authentic Mexican pantry in the UAE" },
      { name: "twitter:description", content: "Authentic Mexican chiles, salsas, masa and snacks — sourced for the UAE. Shop retail or order in bulk for your venue, directly from CornerMex." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b2277b16-0b12-4d15-b3f6-5c84ef869cf3/id-preview-35b8fda6--d9495376-339d-44dd-9c8a-db0f7b451f96.lovable.app-1780958276716.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b2277b16-0b12-4d15-b3f6-5c84ef869cf3/id-preview-35b8fda6--d9495376-339d-44dd-9c8a-db0f7b451f96.lovable.app-1780958276716.png" },
      { name: "keywords", content: "Mexican groceries Dubai, Mexican food Abu Dhabi, Latin products UAE, Mexican products Sharjah, authentic Mexican products UAE, productos mexicanos Dubai, productos latinos EAU, tortillas UAE, salsa Mexico Dubai" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "OnlineStore",
          name: "Corner Mex",
          url: "https://corner-mex-uae.lovable.app",
          description: "CornerMex — authentic Mexican pantry sold directly to customers across the UAE.",
          areaServed: [
            { "@type": "City", name: "Dubai", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
            { "@type": "City", name: "Abu Dhabi", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
            { "@type": "City", name: "Sharjah", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
            { "@type": "City", name: "Ajman", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
            { "@type": "City", name: "Ras Al Khaimah", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
            { "@type": "City", name: "Fujairah", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
            { "@type": "City", name: "Umm Al Quwain", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
          ],
          currenciesAccepted: "AED",
          knowsLanguage: ["en", "es", "ar"],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { installRuntimeErrorLogger(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <AppErrorBoundary>
        <Outlet />
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

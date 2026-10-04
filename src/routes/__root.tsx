import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ACTIVE_MARKET } from "@/config/market";
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
import { siteOrigin } from "@/lib/site-url";

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
      { title: "CornerMex — Despensa mexicana por pieza y por mayoreo" },
      {
        name: "description",
        content:
          "Chiles, salsas, masa y botanas mexicanas. Compra en línea sin crear una cuenta, con envío cotizado a tu código postal, o solicita una cotización para tu negocio.",
      },
      { property: "og:title", content: "CornerMex — Despensa mexicana por pieza y por mayoreo" },
      {
        property: "og:description",
        content:
          "Chiles, salsas, masa y botanas mexicanas. Compra en línea sin crear una cuenta, con envío cotizado a tu código postal, o solicita una cotización para tu negocio.",
      },
      { property: "og:site_name", content: "CornerMex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CornerMex — Despensa mexicana por pieza y por mayoreo" },
      {
        name: "twitter:description",
        content:
          "Chiles, salsas, masa y botanas mexicanas. Compra en línea sin crear una cuenta, con envío cotizado a tu código postal, o solicita una cotización para tu negocio.",
      },
      {
        name: "keywords",
        content:
          "despensa mexicana, abarrotes en línea, chiles secos, salsas mexicanas, botanas mexicanas, mayoreo de abarrotes, proveedor para restaurantes, Tecámac, Estado de México, CDMX",
      },
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
          "@type": "WebSite",
          name: "CornerMex",
          url: siteOrigin(),
          description:
            "Chiles, salsas, masa y botanas mexicanas. Compra en línea sin crear una cuenta, con envío cotizado a tu código postal, o solicita una cotización para tu negocio.",
          currenciesAccepted: ACTIVE_MARKET.currency,
          knowsLanguage: [...ACTIVE_MARKET.languages],
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
    <html lang={ACTIVE_MARKET.defaultLanguage}>
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
  useEffect(() => {
    installRuntimeErrorLogger();
  }, []);

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

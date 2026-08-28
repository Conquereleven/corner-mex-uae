import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search) => callbackSearchSchema.parse(search),
  head: () => ({
    meta: [{ title: "Completing sign in — Intermex" }, { name: "robots", content: "noindex" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const destination = safeInternalRedirect(search.redirect, "/account");
  const [failed, setFailed] = useState(Boolean(search.error) || !search.code);

  useEffect(() => {
    if (!search.code || search.error) return;
    let active = true;

    void supabase.auth.exchangeCodeForSession(search.code).then(({ error }) => {
      if (!active) return;
      if (error) {
        setFailed(true);
        return;
      }
      void navigate({ to: destination as "/" });
    });

    return () => {
      active = false;
    };
  }, [destination, navigate, search.code, search.error]);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        {failed ? (
          <div role="alert">
            <h1 className="font-display text-4xl tracking-tight">
              Google sign-in could not finish
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              No account details or provider response were displayed. Return to sign in and try
              again.
            </p>
            <Link to="/login" search={{ redirect: destination }}>
              <Button className="mt-6 rounded-full">Return to sign in</Button>
            </Link>
          </div>
        ) : (
          <div role="status" aria-live="polite">
            <h1 className="font-display text-4xl tracking-tight">Completing sign in</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Securely exchanging the one-time authorization code…
            </p>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

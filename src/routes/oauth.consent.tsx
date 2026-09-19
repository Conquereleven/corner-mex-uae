import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const consentSearchSchema = z.object({
  authorization_id: z.string().trim().min(1).max(512).optional(),
});

type ConsentDetails = {
  clientName: string;
  redirectUri: string;
  scopes: string[];
};

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search) => consentSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Authorize application — CornerMex" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OAuthConsent,
});

function OAuthConsent() {
  const navigate = useNavigate();
  const { authorization_id: authorizationId } = Route.useSearch();
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAuthorization() {
      if (!authorizationId) {
        setError("This authorization request is missing its identifier.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        const returnTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        await navigate({ to: "/login", search: { redirect: returnTo }, replace: true });
        return;
      }

      const { data, error: authorizationError } =
        await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

      if (!active) return;
      if (authorizationError || !data) {
        setError("This authorization request is invalid, expired, or unavailable.");
        setLoading(false);
        return;
      }

      if (!("authorization_id" in data)) {
        window.location.assign(data.redirect_url);
        return;
      }

      setDetails({
        clientName: data.client.name || "Unnamed application",
        redirectUri: data.redirect_uri,
        scopes: data.scope
          ? data.scope
              .split(" ")
              .map((scope) => scope.trim())
              .filter(Boolean)
          : [],
      });
      setLoading(false);
    }

    void loadAuthorization();
    return () => {
      active = false;
    };
  }, [authorizationId, navigate]);

  async function decide(nextDecision: "approve" | "deny") {
    if (!authorizationId || decision) return;

    setDecision(nextDecision);
    setError(null);
    const result =
      nextDecision === "approve"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);

    if (result.error || !result.data?.redirect_url) {
      setDecision(null);
      setError("CornerMex could not complete this authorization decision. Please try again.");
      return;
    }

    window.location.assign(result.data.redirect_url);
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          CornerMex secure connection
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Authorize application</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Review the application and identity scopes before allowing it to connect to your CornerMex
          account.
        </p>

        {loading && (
          <div className="mt-8 rounded-2xl border p-5 text-sm text-muted-foreground" role="status">
            Validating the authorization request…
          </div>
        )}

        {error && (
          <div
            className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {details && !loading && (
          <div className="mt-8 space-y-6 rounded-2xl border p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Requesting application
              </p>
              <p className="mt-2 text-xl font-semibold">{details.clientName}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Registered callback
              </p>
              <p className="mt-2 break-all text-sm">{details.redirectUri}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Identity scopes
              </p>
              {details.scopes.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {details.scopes.map((scope) => (
                    <li key={scope}>{scope}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Default identity scope.</p>
              )}
            </div>

            <p className="rounded-xl bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
              OAuth consent does not by itself grant operational data access. CornerMex MCP data
              access also requires a separate server-side grant for this exact user and OAuth
              client.
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={decision !== null}
                onClick={() => void decide("deny")}
              >
                {decision === "deny" ? "Declining…" : "Decline"}
              </Button>
              <Button
                type="button"
                disabled={decision !== null}
                onClick={() => void decide("approve")}
              >
                {decision === "approve" ? "Authorizing…" : "Authorize"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

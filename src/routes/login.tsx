import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

function mapLoginError(error: { message?: string; code?: string } | null) {
  if (!error) return "";
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "invalid_credentials" || message.includes("invalid login")) {
    return "Email or password is incorrect.";
  }
  if (error.code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (message.includes("rate limit")) return "Too many attempts. Please try again later.";
  return error.message ?? "Unable to sign in.";
}

export const Route = createFileRoute("/login")({
  validateSearch: (search) => z.object({ redirect: z.string().optional() }).parse(search),
  head: () => ({
    meta: [{ title: "Sign in — Corner Mex" }, { name: "robots", content: "noindex" }],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) {
      setError(mapLoginError(result.error));
      return;
    }
    await navigate({ to: safeInternalRedirect(redirect) as "/" });
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          CornerMex account
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Use your confirmed CornerMex email and password. Account access does not enable checkout.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full rounded-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </section>
    </SiteLayout>
  );
}

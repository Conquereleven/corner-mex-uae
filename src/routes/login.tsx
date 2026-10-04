import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";
import { ONLINE_ORDERING_ENABLED } from "@/lib/commerce-mode";

function mapLoginError(error: { message?: string; code?: string } | null) {
  if (!error) return "";
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "invalid_credentials" || message.includes("invalid login")) {
    return "El correo o la contraseña no son correctos.";
  }
  if (error.code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesión.";
  }
  if (message.includes("rate limit")) return "Demasiados intentos. Inténtalo más tarde.";
  return error.message ?? "No pudimos iniciar tu sesión.";
}

export const Route = createFileRoute("/login")({
  validateSearch: (search) => z.object({ redirect: z.string().optional() }).parse(search),
  head: () => ({
    meta: [{ title: "Iniciar sesión — CornerMex" }, { name: "robots", content: "noindex" }],
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
  const [googleLoading, setGoogleLoading] = useState(false);

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

  async function continueWithGoogle() {
    setError(null);
    setGoogleLoading(true);
    const destination = safeInternalRedirect(redirect, "/account");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("redirect", destination);
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (result.error) {
      setGoogleLoading(false);
      setError("No pudimos abrir el inicio de sesión con Google. Inténtalo de nuevo.");
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Cuenta CornerMex
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Iniciar sesión</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {ONLINE_ORDERING_ENABLED
            ? "Inicia sesión con Google o con tu correo y contraseña de CornerMex."
            : "Usa tu correo y contraseña de CornerMex."}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={googleLoading}
          className="mt-8 w-full rounded-full"
          onClick={() => void continueWithGoogle()}
        >
          {googleLoading ? "Abriendo Google…" : "Continuar con Google"}
        </Button>
        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
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
            {loading ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>
      </section>
    </SiteLayout>
  );
}

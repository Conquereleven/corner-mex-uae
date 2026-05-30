import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

function mapLoginError(err: { message?: string; code?: string } | null): string {
  if (!err) return "";
  const msg = (err.message ?? "").toLowerCase();
  const code = err.code ?? "";
  if (code === "invalid_credentials" || msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesión.";
  }
  if (msg.includes("rate limit")) {
    return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  }
  return err.message ?? "No se pudo iniciar sesión.";
}

export const Route = createFileRoute("/login")({
  validateSearch: (s) => z.object({ redirect: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Sign in — Corner Mex" }] }),
  component: Login,
});

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(mapLoginError(error as any));
    else navigate({ to: (redirect as any) ?? "/" });
  };

  const google = async () => {
    await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirect ?? "/"}`,
    });
  };

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight">{t("auth.signin")}</h1>
        <Button onClick={google} variant="outline" className="mt-8 w-full rounded-full">
          {t("auth.google")}
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full rounded-full">
            {loading ? "..." : t("auth.signin")}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.noAccount")} <Link to="/signup" className="font-medium text-foreground underline">{t("auth.signup")}</Link>
        </p>
      </section>
    </SiteLayout>
  );
}
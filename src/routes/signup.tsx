import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

function mapSignupError(err: { message?: string; code?: string } | null): string {
  if (!err) return "";
  const msg = (err.message ?? "").toLowerCase();
  const code = err.code ?? "";
  if (code === "weak_password" || msg.includes("weak") || msg.includes("pwned")) {
    return "Esta contraseña es muy común o ha aparecido en filtraciones de seguridad. Usa una contraseña más fuerte y única.";
  }
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
    return "Ya existe una cuenta con este correo. Inicia sesión.";
  }
  if (msg.includes("rate limit") || msg.includes("over_email_send_rate")) {
    return "Demasiados intentos. Espera un minuto y vuelve a intentar.";
  }
  if (msg.includes("invalid") && msg.includes("email")) {
    return "El correo no es válido.";
  }
  return err.message ?? "No se pudo crear la cuenta.";
}

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Corner Mex" }] }),
  component: Signup,
});

function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acceptedLegal) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) {
      setError(mapSignupError(error as any));
      return;
    }
    // If email confirmation is required, Supabase returns no session.
    if (!data.session) {
      setNeedsConfirm(true);
      return;
    }
    toast.success("Cuenta creada. ¡Bienvenido!");
    navigate({ to: "/" });
  };

  const google = async () => {
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  };

  if (needsConfirm) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
          <h1 className="font-display text-3xl tracking-tight">Check your inbox</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to activate your account, then sign in.
          </p>
          <Link to="/login">
            <Button className="mt-8 w-full rounded-full">{t("auth.signin")}</Button>
          </Link>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight">{t("auth.signup")}</h1>
        <Button onClick={google} variant="outline" className="mt-8 w-full rounded-full">
          {t("auth.google")}
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Mínimo 10 caracteres. Evita contraseñas comunes o que hayan aparecido en filtraciones.
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
            />
            <span>
              I have read and accept the{" "}
              <Link to="/legal/$slug" params={{ slug: "terms-and-conditions" }} className="underline">Terms & Conditions</Link>{" "}
              and the{" "}
              <Link to="/legal/$slug" params={{ slug: "privacy-policy" }} className="underline">Privacy Policy</Link>.
            </span>
          </label>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full rounded-full">
            {loading ? "..." : t("auth.signup")}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")} <Link to="/login" className="font-medium text-foreground underline">{t("auth.signin")}</Link>
        </p>
      </section>
    </SiteLayout>
  );
}
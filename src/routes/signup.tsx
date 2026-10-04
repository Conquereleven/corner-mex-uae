import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Crear una cuenta — CornerMex" }, { name: "robots", content: "noindex" }],
  }),
  component: SignupUnavailable,
});

function SignupUnavailable() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Cuentas
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          El registro por correo aún no está abierto
        </h1>
        <p className="mt-4 text-muted-foreground">
          Esta página no recopila datos de registro. Para crear una cuenta, usa Continuar con Google en la página de inicio de sesión. Puedes explorar el catálogo y comprar sin una cuenta.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/login">
            <Button className="rounded-full">Iniciar sesión</Button>
          </Link>
          <Link to="/shop">
            <Button variant="outline" className="rounded-full">
              Ver el catálogo
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

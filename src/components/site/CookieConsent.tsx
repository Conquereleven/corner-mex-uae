import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { acceptAll, readPreferences, rejectNonEssential, writePreferences, DEFAULT_PREFS, type CookiePreferences } from "@/lib/cookie-consent";
import { Cookie } from "lucide-react";

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [hasChoice, setHasChoice] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [draft, setDraft] = useState<CookiePreferences>(DEFAULT_PREFS);

  useEffect(() => {
    setMounted(true);
    const current = readPreferences();
    setHasChoice(!!current);
    setDraft(current ?? DEFAULT_PREFS);
    const openHandler = () => {
      setDraft(readPreferences() ?? DEFAULT_PREFS);
      setOpenModal(true);
    };
    window.addEventListener("cm:open-cookie-preferences", openHandler);
    return () => window.removeEventListener("cm:open-cookie-preferences", openHandler);
  }, []);

  if (!mounted) return null;

  function persist(prefs: Partial<CookiePreferences>) {
    writePreferences(prefs);
    setHasChoice(true);
    setOpenModal(false);
  }

  return (
    <>
      {!hasChoice && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="mx-auto max-w-4xl rounded-2xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Cookie className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-foreground">Tu privacidad nos importa</p>
                <p className="mt-1 text-muted-foreground">
                  Usamos las cookies necesarias para que CornerMex funcione. Con tu consentimiento también usamos cookies de analítica, mercadotecnia y funcionales para mejorar tu experiencia. Consulta nuestra{" "}
                  <Link to="/legal/$slug" params={{ slug: "cookie-policy" }} className="underline">política de privacidad</Link>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <Button size="sm" variant="ghost" onClick={() => { rejectNonEssential(); setHasChoice(true); }}>Rechazar las no esenciales</Button>
                <Button size="sm" variant="outline" onClick={() => { setDraft(readPreferences() ?? DEFAULT_PREFS); setOpenModal(true); }}>Elegir preferencias</Button>
                <Button size="sm" onClick={() => { acceptAll(); setHasChoice(true); }}>Aceptar todas</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preferencias de cookies</DialogTitle>
            <DialogDescription>
              Elige qué categorías de cookies permites. Las necesarias siempre están activas. Puedes cambiarlo cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Row title="Estrictamente necesarias" desc="Inicio de sesión, carrito, seguridad y prevención de fraude. Siempre activas.">
              <Switch checked disabled />
            </Row>
            <Row title="Analítica" desc="Nos ayudan a entender cómo se usa el sitio para mejorarlo.">
              <Switch checked={draft.analytics} onCheckedChange={(v) => setDraft({ ...draft, analytics: v })} />
            </Row>
            <Row title="Mercadotecnia" desc="Miden y personalizan la comunicación en nuestros canales.">
              <Switch checked={draft.marketing} onCheckedChange={(v) => setDraft({ ...draft, marketing: v })} />
            </Row>
            <Row title="Funcionales" desc="Recuerdan preferencias no esenciales, como el idioma y los filtros.">
              <Switch checked={draft.functional} onCheckedChange={(v) => setDraft({ ...draft, functional: v })} />
            </Row>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => { rejectNonEssential(); setHasChoice(true); setOpenModal(false); }}>Rechazar las no esenciales</Button>
            <Button variant="outline" onClick={() => { acceptAll(); setHasChoice(true); setOpenModal(false); }}>Aceptar todas</Button>
            <Button onClick={() => persist(draft)}>Guardar preferencias</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="pt-1">{children}</div>
    </div>
  );
}

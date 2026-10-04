import { useEffect, useState } from "react";
import i18n, { LANGS } from "@/lib/i18n";
import { ACTIVE_MARKET } from "@/config/market";
import { useTranslation } from "react-i18next";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n: instance } = useTranslation();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const apply = (lng: string) => {
      const dir = lng === "ar" ? "rtl" : "ltr";
      if (typeof document !== "undefined") {
        document.documentElement.lang = lng;
        document.documentElement.dir = dir;
      }
    };
    // After hydration, restore stored preference (or detect browser language)
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("cmx-lang") : null;
    // Only an explicit choice overrides the market default: a customer in Mexico
    // with an English browser still lands on the Spanish storefront.
    const fallback = ACTIVE_MARKET.defaultLanguage;
    const initial = stored || fallback;
    const valid = LANGS.some((language) => language.code === initial) ? initial : fallback;
    if (valid !== instance.language) {
      instance.changeLanguage(valid);
    } else {
      apply(valid);
    }
    setHydrated(true);
    instance.on("languageChanged", apply);
    const saveOnChange = (lng: string) => {
      try { window.localStorage.setItem("cmx-lang", lng); } catch {}
    };
    instance.on("languageChanged", saveOnChange);
    return () => {
      instance.off("languageChanged", apply);
      instance.off("languageChanged", saveOnChange);
    };
  }, [instance]);
  return <>{children}</>;
}

export { i18n };
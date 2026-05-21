import { useEffect, useState } from "react";
import i18n from "@/lib/i18n";
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
    const initial = stored || (typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en");
    const valid = ["en", "es", "ar"].includes(initial) ? initial : "en";
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
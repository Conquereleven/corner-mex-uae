import { useEffect } from "react";
import i18n from "@/lib/i18n";
import { useTranslation } from "react-i18next";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n: instance } = useTranslation();
  useEffect(() => {
    const apply = (lng: string) => {
      const dir = lng === "ar" ? "rtl" : "ltr";
      if (typeof document !== "undefined") {
        document.documentElement.lang = lng;
        document.documentElement.dir = dir;
      }
    };
    apply(instance.language || "en");
    instance.on("languageChanged", apply);
    return () => instance.off("languageChanged", apply);
  }, [instance]);
  return <>{children}</>;
}

export { i18n };
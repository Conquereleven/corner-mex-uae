import { Header } from "./Header";
import { Footer } from "./Footer";
import { LanguageProvider } from "./LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "./CookieConsent";
import { brandCssVariables, INTERMEX_BRAND, type BrandConfig } from "@/config/brand";

export function SiteLayout({
  children,
  brand = INTERMEX_BRAND,
}: {
  children: React.ReactNode;
  brand?: BrandConfig;
}) {
  return (
    <LanguageProvider>
      <div
        className="intermex-storefront flex min-h-screen flex-col bg-background pb-20 md:pb-0"
        style={brandCssVariables(brand)}
        data-brand={brand.id}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster position="bottom-right" />
        <CookieConsent />
      </div>
    </LanguageProvider>
  );
}

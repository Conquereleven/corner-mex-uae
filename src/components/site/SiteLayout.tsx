import { Header } from "./Header";
import { Footer } from "./Footer";
import { LanguageProvider } from "./LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "./CookieConsent";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster position="bottom-right" />
        <CookieConsent />
      </div>
    </LanguageProvider>
  );
}
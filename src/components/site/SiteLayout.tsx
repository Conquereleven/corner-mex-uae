import { Header } from "./Header";
import { Footer } from "./Footer";
import { LanguageProvider } from "./LanguageProvider";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}
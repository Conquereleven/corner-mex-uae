import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Corner Mex" },
      { name: "description", content: "How Corner Mex collects, uses and protects your personal data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-AE")}</p>
        <div className="prose prose-neutral mt-8 max-w-none text-foreground">
          <p>
            This is a legacy summary. The current, versioned Privacy Policy lives in the{" "}
            <a href="/legal/privacy-policy">Legal Center</a>.
          </p>
          <p>We collect only the data we need to run your account, process your orders and keep the service secure. CornerMex is the seller of record and controller for personal data processed through this site.</p>
          <h2>1. What we collect</h2>
          <p>Account details (name, email, phone), delivery addresses, order history, and basic device/browser data for security and analytics.</p>
          <h2>2. How we use it</h2>
          <p>To process orders, communicate about your purchases, prevent fraud, and improve the service. We never sell your personal data.</p>
          <h2>3. Sharing</h2>
          <p>Order details are shared with the logistics partner needed to deliver your purchase. Payment data is handled by our PCI-compliant payment partners.</p>
          <h2>4. Your rights</h2>
          <p>You can request access, correction or deletion of your personal data at <a href="mailto:privacy@cornermex.ae">privacy@cornermex.ae</a>.</p>
        </div>
      </section>
    </SiteLayout>
  );
}
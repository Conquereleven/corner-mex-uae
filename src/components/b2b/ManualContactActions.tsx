import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mailto, PUBLIC_CONTACT, whatsappUrl } from "@/lib/public-contact";

export function ManualContactActions({ preview }: { preview: string }) {
  const [copied, setCopied] = useState(false);
  const whatsAppHref = whatsappUrl(PUBLIC_CONTACT.whatsapp, preview);

  async function copyRequest() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a
          href={mailto(PUBLIC_CONTACT.b2b, "CornerMex manual quote request", preview)}
          className="inline-flex"
        >
          <Button className="min-h-11 w-full rounded-full sm:w-auto">
            <Mail className="me-2 h-4 w-4" /> Send by email
          </Button>
        </a>
        {whatsAppHref ? (
          <a href={whatsAppHref} className="inline-flex">
            <Button variant="outline" className="min-h-11 w-full rounded-full sm:w-auto">
              <MessageCircle className="me-2 h-4 w-4" /> Open WhatsApp
            </Button>
          </a>
        ) : (
          <Button disabled variant="outline" className="min-h-11 rounded-full">
            <MessageCircle className="me-2 h-4 w-4" /> WhatsApp unavailable
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={copyRequest}
          className="min-h-11 rounded-full"
        >
          {copied ? <Check className="me-2 h-4 w-4" /> : <Copy className="me-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy request"}
        </Button>
      </div>
      {!whatsAppHref && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          WhatsApp contact configuration is unavailable. Use email or copy the request instead.
        </p>
      )}
    </div>
  );
}

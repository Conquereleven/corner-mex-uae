import { useEffect, useRef, useState } from "react";

// Mercado Pago Card Payment Brick.
//
// The card form is rendered and owned by Mercado Pago's own SDK, loaded from
// Mercado Pago. Card number, expiry and security code are typed into Mercado
// Pago's fields and never pass through CornerMex code, state or servers: the
// only thing this component receives is a single-use token.
//
// The amount shown is for the customer's information. The amount actually
// charged is the order total computed by the database; the server ignores any
// amount the browser might send.
//
// Capability level: SCAFFOLDED — built against the published Brick contract,
// not yet exercised with a real Public Key.

const SDK_URL = "https://sdk.mercadopago.com/js/v2";

export type MercadoPagoCardToken = {
  token: string;
  paymentMethodId: string;
  installments: number;
};

type BrickController = { unmount: () => void };
type MercadoPagoInstance = {
  bricks: () => {
    create: (
      name: "cardPayment",
      containerId: string,
      settings: Record<string, unknown>,
    ) => Promise<BrickController>;
  };
};
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

let sdkLoading: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.MercadoPago) return Promise.resolve();
  sdkLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoading = null;
      reject(new Error("MERCADO_PAGO_SDK_UNAVAILABLE"));
    };
    document.head.appendChild(script);
  });
  return sdkLoading;
}

export function MercadoPagoCardBrick({
  publicKey,
  amount,
  payerEmail,
  onToken,
}: {
  publicKey: string;
  /** Display only; see the note at the top of this file. */
  amount: number;
  payerEmail: string | null;
  /** Resolves when the order was placed; rejects to let the Brick show a failure. */
  onToken: (card: MercadoPagoCardToken) => Promise<void>;
}) {
  const containerId = useRef(`mp-card-${Math.random().toString(36).slice(2)}`).current;
  const submit = useRef(onToken);
  submit.current = onToken;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let controller: BrickController | null = null;
    let cancelled = false;
    setState("loading");
    loadSdk()
      .then(async () => {
        if (cancelled || !window.MercadoPago) return;
        const mercadoPago = new window.MercadoPago(publicKey, { locale: "es-MX" });
        controller = await mercadoPago.bricks().create("cardPayment", containerId, {
          initialization: { amount, ...(payerEmail ? { payer: { email: payerEmail } } : {}) },
          customization: { paymentMethods: { maxInstallments: 1 } },
          callbacks: {
            onReady: () => !cancelled && setState("ready"),
            onError: () => !cancelled && setState("error"),
            onSubmit: (data: {
              token?: string;
              payment_method_id?: string;
              installments?: number;
            }) => {
              if (!data.token || !data.payment_method_id) {
                return Promise.reject(new Error("MERCADO_PAGO_TOKEN_MISSING"));
              }
              return submit.current({
                token: data.token,
                paymentMethodId: data.payment_method_id,
                installments: data.installments ?? 1,
              });
            },
          },
        });
        if (cancelled) controller.unmount();
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
      controller?.unmount();
    };
    // The Brick is rebuilt when the amount changes so it never shows a stale total.
  }, [amount, containerId, payerEmail, publicKey]);

  return (
    <div className="mt-4">
      {state === "loading" && (
        <p className="text-sm text-muted-foreground">Cargando el formulario de pago seguro…</p>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-destructive">
          No pudimos cargar el formulario de tarjeta. Elige otra forma de pago o inténtalo de nuevo.
        </p>
      )}
      <div id={containerId} />
    </div>
  );
}

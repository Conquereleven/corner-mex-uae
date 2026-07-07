// Centralized payment method eligibility for CornerMex checkout.
// Emirate codes match the form values in src/routes/checkout.tsx.

import { CreditCard, Smartphone, Truck, Wallet, Building2, type LucideIcon } from "lucide-react";

export type PaymentMethodId =
  | "card"
  | "apple_pay"
  | "google_pay"
  | "tabby"
  | "tamara"
  | "bank_transfer"
  | "cod";

export type EmirateCode = "DU" | "AD" | "SH" | "AJ" | "UQ" | "RK" | "FU";

export type PaymentMethodOption = {
  id: PaymentMethodId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  enabled: boolean;
  unavailableReason?: string;
};

// Provider feature flags. Tabby / Tamara stay off until real merchant
// integration is live. Do not flip these without a working provider.
// TODO: Move to environment/config when Stripe/Tabby/Tamara go live.
export const PAYMENT_FLAGS = {
  stripeEnabled: true, // card path already exists; server falls back gracefully
  tabbyEnabled: false,
  tamaraEnabled: false,
} as const;

const COD_EMIRATES: ReadonlySet<EmirateCode> = new Set(["DU", "AD", "SH", "AJ"]);
const COD_MIN = 50;
const COD_MAX = 300;
const BNPL_MIN = 150;

export type EligibilityInput = {
  subtotal: number;
  emirate: EmirateCode;
  stripeEnabled?: boolean;
  tabbyEnabled?: boolean;
  tamaraEnabled?: boolean;
  applePayAvailable?: boolean;
  googlePayAvailable?: boolean;
};

export function getAvailablePaymentMethods(input: EligibilityInput): PaymentMethodOption[] {
  const {
    subtotal,
    emirate,
    stripeEnabled = PAYMENT_FLAGS.stripeEnabled,
    tabbyEnabled = PAYMENT_FLAGS.tabbyEnabled,
    tamaraEnabled = PAYMENT_FLAGS.tamaraEnabled,
    applePayAvailable = false,
    googlePayAvailable = false,
  } = input;

  const list: PaymentMethodOption[] = [];

  list.push({
    id: "card",
    title: "Credit / Debit card",
    subtitle: "Visa, Mastercard, Amex",
    icon: CreditCard,
    enabled: true,
  });

  if (stripeEnabled && applePayAvailable) {
    list.push({
      id: "apple_pay",
      title: "Apple Pay",
      subtitle: "One-tap checkout",
      icon: Smartphone,
      enabled: true,
    });
  }

  if (stripeEnabled && googlePayAvailable) {
    list.push({
      id: "google_pay",
      title: "Google Pay",
      subtitle: "Fast & secure",
      icon: Smartphone,
      enabled: true,
    });
  }

  if (tabbyEnabled) {
    const ok = subtotal >= BNPL_MIN;
    list.push({
      id: "tabby",
      title: "Tabby",
      subtitle: "Pay in 4 interest-free payments",
      icon: Wallet,
      enabled: ok,
      unavailableReason: ok ? undefined : `Available from AED ${BNPL_MIN.toFixed(2)}`,
    });
  }

  if (tamaraEnabled) {
    const ok = subtotal >= BNPL_MIN;
    list.push({
      id: "tamara",
      title: "Tamara",
      subtitle: "Split into payments",
      icon: Wallet,
      enabled: ok,
      unavailableReason: ok ? undefined : `Available from AED ${BNPL_MIN.toFixed(2)}`,
    });
  }

  list.push({
    id: "bank_transfer",
    title: "Bank transfer",
    subtitle: subtotal >= COD_MAX ? "Recommended for large orders" : "Manual UAE bank transfer",
    icon: Building2,
    enabled: true,
  });

  let codEnabled = true;
  let codReason: string | undefined;
  if (!COD_EMIRATES.has(emirate)) {
    codEnabled = false;
    codReason = "Not available in your emirate";
  } else if (subtotal < COD_MIN) {
    codEnabled = false;
    codReason = `Available from AED ${COD_MIN.toFixed(2)}`;
  } else if (subtotal > COD_MAX) {
    codEnabled = false;
    codReason = `Available for orders up to AED ${COD_MAX.toFixed(2)}`;
  }
  list.push({
    id: "cod",
    title: "Cash on delivery",
    subtitle: "Pay the courier",
    icon: Truck,
    enabled: codEnabled,
    unavailableReason: codReason,
  });

  return list;
}

export function isMethodAvailable(id: PaymentMethodId, methods: PaymentMethodOption[]) {
  return methods.some((m) => m.id === id && m.enabled);
}

// TODO: Wire real bank details from admin settings / secrets when available.
export const BANK_TRANSFER_DETAILS = {
  accountName: "RodMor Trade Co LLC",
  bankName: "[Add bank name]",
  iban: "[Add IBAN]",
};

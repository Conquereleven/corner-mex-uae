import type { CanonicalPaymentStatus } from "./payment-state";
import type { Database } from "@/integrations/supabase/types";
/** Additive repository contract only; not a claim that production has these columns. */
type Tables = Database["public"]["Tables"];
export type OperationalDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Tables, "orders" | "payments"> & {
      orders: Omit<Tables["orders"], "Row"> & {
        Row: Tables["orders"]["Row"] & {
          payment_status: CanonicalPaymentStatus;
          payment_attention: string | null;
          b2b_account_id: string | null;
          stripe_paid_attempt_id: string | null;
        };
      };
      payments: Omit<Tables["payments"], "Row"> & {
        Row: Tables["payments"]["Row"] & {
          status: CanonicalPaymentStatus;
          provider_mode: "test" | "live" | null;
          captured_aed: number;
          refunded_aed: number;
        };
      };
    };
  };
};

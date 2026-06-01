export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          area: string
          building: string | null
          created_at: string
          emirate: Database["public"]["Enums"]["emirate"]
          floor_apt: string | null
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          phone: string
          recipient_name: string
          street: string | null
          user_id: string
        }
        Insert: {
          area: string
          building?: string | null
          created_at?: string
          emirate: Database["public"]["Enums"]["emirate"]
          floor_apt?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          phone: string
          recipient_name: string
          street?: string | null
          user_id: string
        }
        Update: {
          area?: string
          building?: string | null
          created_at?: string
          emirate?: Database["public"]["Enums"]["emirate"]
          floor_apt?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          phone?: string
          recipient_name?: string
          street?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_es: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string
          name_en: string
          name_es: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar: string
          name_en: string
          name_es: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string
          name_es?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          commission_aed: number
          fulfillment_status: Database["public"]["Enums"]["order_status"]
          id: string
          line_total_aed: number
          order_id: string
          product_id: string
          product_name: string
          qty: number
          seller_id: string
          unit_price_aed: number
          variant_id: string
          variant_label: string | null
        }
        Insert: {
          commission_aed?: number
          fulfillment_status?: Database["public"]["Enums"]["order_status"]
          id?: string
          line_total_aed: number
          order_id: string
          product_id: string
          product_name: string
          qty: number
          seller_id: string
          unit_price_aed: number
          variant_id: string
          variant_label?: string | null
        }
        Update: {
          commission_aed?: number
          fulfillment_status?: Database["public"]["Enums"]["order_status"]
          id?: string
          line_total_aed?: number
          order_id?: string
          product_id?: string
          product_name?: string
          qty?: number
          seller_id?: string
          unit_price_aed?: number
          variant_id?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipping_address: Json
          shipping_aed: number
          shipping_zone_id: string | null
          sla_max_days: number | null
          sla_min_days: number | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_aed: number
          tax_aed: number
          total_aed: number
          updated_at: string
          weight_grams_total: number | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address: Json
          shipping_aed?: number
          shipping_zone_id?: string | null
          sla_max_days?: number | null
          sla_min_days?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_aed?: number
          tax_aed?: number
          total_aed?: number
          updated_at?: string
          weight_grams_total?: number | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address?: Json
          shipping_aed?: number
          shipping_zone_id?: string | null
          sla_max_days?: number | null
          sla_min_days?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_aed?: number
          tax_aed?: number
          total_aed?: number
          updated_at?: string
          weight_grams_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_aed: number
          created_at: string
          external_id: string | null
          id: string
          order_id: string
          provider: Database["public"]["Enums"]["payment_method"]
          raw: Json | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_aed: number
          created_at?: string
          external_id?: string | null
          id?: string
          order_id: string
          provider: Database["public"]["Enums"]["payment_method"]
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_aed?: number
          created_at?: string
          external_id?: string | null
          id?: string
          order_id?: string
          provider?: Database["public"]["Enums"]["payment_method"]
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          description: string | null
          lang: Database["public"]["Enums"]["lang_code"]
          name: string
          product_id: string
        }
        Insert: {
          description?: string | null
          lang: Database["public"]["Enums"]["lang_code"]
          name: string
          product_id: string
        }
        Update: {
          description?: string | null
          lang?: Database["public"]["Enums"]["lang_code"]
          name?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          bulk_tiers: Json
          compare_at_price_aed: number | null
          created_at: string
          format_label: string | null
          id: string
          is_default: boolean
          price_aed: number
          product_id: string
          sku: string | null
          stock: number
          weight_grams: number | null
        }
        Insert: {
          bulk_tiers?: Json
          compare_at_price_aed?: number | null
          created_at?: string
          format_label?: string | null
          id?: string
          is_default?: boolean
          price_aed: number
          product_id: string
          sku?: string | null
          stock?: number
          weight_grams?: number | null
        }
        Update: {
          bulk_tiers?: Json
          compare_at_price_aed?: number | null
          created_at?: string
          format_label?: string | null
          id?: string
          is_default?: boolean
          price_aed?: number
          product_id?: string
          sku?: string | null
          stock?: number
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attrs: Json
          brand: string | null
          category_id: string | null
          created_at: string
          id: string
          is_bulk: boolean
          is_halal: boolean
          origin_region: string | null
          seller_id: string
          slug: string
          spice_level: number | null
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          attrs?: Json
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_bulk?: boolean
          is_halal?: boolean
          origin_region?: string | null
          seller_id: string
          slug: string
          spice_level?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          attrs?: Json
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_bulk?: boolean
          is_halal?: boolean
          origin_region?: string | null
          seller_id?: string
          slug?: string
          spice_level?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_lang: Database["public"]["Enums"]["lang_code"]
          trn: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_lang?: Database["public"]["Enums"]["lang_code"]
          trn?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_lang?: Database["public"]["Enums"]["lang_code"]
          trn?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          accepted_at: string | null
          assigned_admin_id: string | null
          buyer_id: string
          company_name: string | null
          contact_email: string
          contact_phone: string | null
          converted_order_id: string | null
          created_at: string
          id: string
          items: Json
          notes: string | null
          quote_number: string
          rejected_at: string | null
          rejection_reason: string | null
          response: Json | null
          status: Database["public"]["Enums"]["quote_status"]
          total_estimate_aed: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_admin_id?: string | null
          buyer_id: string
          company_name?: string | null
          contact_email: string
          contact_phone?: string | null
          converted_order_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          quote_number?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_estimate_aed?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_admin_id?: string | null
          buyer_id?: string
          company_name?: string | null
          contact_email?: string
          contact_phone?: string | null
          converted_order_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          quote_number?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_estimate_aed?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      seller_payouts: {
        Row: {
          commission_aed: number
          created_at: string
          gross_aed: number
          id: string
          net_aed: number
          paid_at: string | null
          period_end: string
          period_start: string
          seller_id: string
          status: string
        }
        Insert: {
          commission_aed?: number
          created_at?: string
          gross_aed?: number
          id?: string
          net_aed?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          seller_id: string
          status?: string
        }
        Update: {
          commission_aed?: number
          created_at?: string
          gross_aed?: number
          id?: string
          net_aed?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          bank_account_holder: string | null
          bank_iban: string | null
          bank_name: string | null
          bio: string | null
          commission_rate: number
          contact_email: string | null
          contact_phone: string | null
          cover_url: string | null
          created_at: string
          id: string
          logo_url: string | null
          slug: string
          status: Database["public"]["Enums"]["seller_status"]
          store_name: string
          tagline: string | null
          trn: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bio?: string | null
          commission_rate?: number
          contact_email?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          slug: string
          status?: Database["public"]["Enums"]["seller_status"]
          store_name: string
          tagline?: string | null
          trn?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bio?: string | null
          commission_rate?: number
          contact_email?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["seller_status"]
          store_name?: string
          tagline?: string | null
          trn?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          base_aed: number
          created_at: string
          free_above_aed: number | null
          id: string
          is_active: boolean
          per_kg_aed: number
          seller_id: string | null
          sla_max_days: number
          sla_min_days: number
          updated_at: string
          zone_id: string
        }
        Insert: {
          base_aed?: number
          created_at?: string
          free_above_aed?: number | null
          id?: string
          is_active?: boolean
          per_kg_aed?: number
          seller_id?: string | null
          sla_max_days?: number
          sla_min_days?: number
          updated_at?: string
          zone_id: string
        }
        Update: {
          base_aed?: number
          created_at?: string
          free_above_aed?: number | null
          id?: string
          is_active?: boolean
          per_kg_aed?: number
          seller_id?: string | null
          sla_max_days?: number
          sla_min_days?: number
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          created_at: string
          emirates: Database["public"]["Enums"]["emirate"][]
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          emirates?: Database["public"]["Enums"]["emirate"][]
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          emirates?: Database["public"]["Enums"]["emirate"][]
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "buyer" | "seller" | "admin"
      emirate:
        | "abu_dhabi"
        | "dubai"
        | "sharjah"
        | "ajman"
        | "umm_al_quwain"
        | "ras_al_khaimah"
        | "fujairah"
      lang_code: "en" | "ar" | "es"
      order_status:
        | "pending"
        | "paid"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      payment_method:
        | "stripe"
        | "cod"
        | "bank_transfer"
        | "quote"
        | "card"
        | "apple_pay"
        | "google_pay"
        | "tabby"
        | "tamara"
      payment_status: "pending" | "authorized" | "paid" | "failed" | "refunded"
      product_status: "draft" | "pending" | "active" | "archived"
      quote_status: "open" | "responded" | "accepted" | "rejected" | "expired"
      seller_status: "pending" | "active" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["buyer", "seller", "admin"],
      emirate: [
        "abu_dhabi",
        "dubai",
        "sharjah",
        "ajman",
        "umm_al_quwain",
        "ras_al_khaimah",
        "fujairah",
      ],
      lang_code: ["en", "ar", "es"],
      order_status: [
        "pending",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      payment_method: [
        "stripe",
        "cod",
        "bank_transfer",
        "quote",
        "card",
        "apple_pay",
        "google_pay",
        "tabby",
        "tamara",
      ],
      payment_status: ["pending", "authorized", "paid", "failed", "refunded"],
      product_status: ["draft", "pending", "active", "archived"],
      quote_status: ["open", "responded", "accepted", "rejected", "expired"],
      seller_status: ["pending", "active", "suspended"],
    },
  },
} as const

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
          emirate: string
          floor_apt: string | null
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          phone: string
          recipient_name: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          building?: string | null
          created_at?: string
          emirate: string
          floor_apt?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          phone: string
          recipient_name: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          building?: string | null
          created_at?: string
          emirate?: string
          floor_apt?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          phone?: string
          recipient_name?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      b2b_leads: {
        Row: {
          business_type: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_type?: string | null
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_type?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalog_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          product_id: string | null
          session_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          product_id?: string | null
          session_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          product_id?: string | null
          session_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string | null
          name_en: string
          name_es: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          name_es?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          name_es?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_aed: number
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_aed: number
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_aed?: number
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          minimum_order_aed: number | null
          starts_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          minimum_order_aed?: number | null
          starts_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          minimum_order_aed?: number | null
          starts_at?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          quantity_on_hand: number
          quantity_reserved: number
          reorder_point: number | null
          updated_at: string
          variant_id: string
        }
        Insert: {
          quantity_on_hand?: number
          quantity_reserved?: number
          reorder_point?: number | null
          updated_at?: string
          variant_id: string
        }
        Update: {
          quantity_on_hand?: number
          quantity_reserved?: number
          reorder_point?: number | null
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          movement_type: string
          quantity_delta: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          variant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          movement_type: string
          quantity_delta: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          variant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          movement_type?: string
          quantity_delta?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          fulfillment_status: string
          id: string
          line_total_aed: number
          order_id: string
          product_id: string | null
          product_name: string
          qty: number
          unit_price_aed: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          fulfillment_status?: string
          id?: string
          line_total_aed: number
          order_id: string
          product_id?: string | null
          product_name: string
          qty: number
          unit_price_aed: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          fulfillment_status?: string
          id?: string
          line_total_aed?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          unit_price_aed?: number
          variant_id?: string | null
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
          legal_acceptance: Json | null
          order_number: string
          payment_method: string | null
          payment_status: string
          shipping_address: Json
          shipping_aed: number
          status: string
          subtotal_aed: number
          tax_aed: number
          total_aed: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          legal_acceptance?: Json | null
          order_number: string
          payment_method?: string | null
          payment_status?: string
          shipping_address: Json
          shipping_aed?: number
          status?: string
          subtotal_aed: number
          tax_aed?: number
          total_aed: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          legal_acceptance?: Json | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string
          shipping_address?: Json
          shipping_aed?: number
          status?: string
          subtotal_aed?: number
          tax_aed?: number
          total_aed?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_aed: number
          created_at: string
          id: string
          metadata: Json
          order_id: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_aed: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          provider: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_aed?: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
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
      product_reviews: {
        Row: {
          body: string | null
          buyer_id: string
          created_at: string
          id: string
          order_id: string | null
          order_item_id: string | null
          product_id: string
          rating: number
          status: string
          title: string | null
          updated_at: string
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          order_item_id?: string | null
          product_id: string
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          created_at: string
          description: string | null
          lang: string
          name: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          lang: string
          name: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          lang?: string
          name?: string
          product_id?: string
          updated_at?: string
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
          compare_at_price_aed: number | null
          created_at: string
          format_label: string | null
          id: string
          is_active: boolean
          is_default: boolean
          price_aed: number
          product_id: string
          sku: string | null
          stock: number
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          compare_at_price_aed?: number | null
          created_at?: string
          format_label?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          price_aed: number
          product_id: string
          sku?: string | null
          stock?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          compare_at_price_aed?: number | null
          created_at?: string
          format_label?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          price_aed?: number
          product_id?: string
          sku?: string | null
          stock?: number
          updated_at?: string
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
          slug: string
          spice_level: number | null
          status: string
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
          slug: string
          spice_level?: number | null
          status?: string
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
          slug?: string
          spice_level?: number | null
          status?: string
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
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

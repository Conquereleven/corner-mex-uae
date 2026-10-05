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
    PostgrestVersion: "14.18"
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
          admin_note: string | null
          blocker: string | null
          business_type: string | null
          company_name: string
          contact_name: string
          contact_preference: string | null
          contact_role: string | null
          contacted_at: string | null
          country_city: string | null
          created_at: string
          decision_maker: string | null
          email: string
          estimated_volume: string | null
          first_order_id: string | null
          first_order_linked_at: string | null
          id: string
          idempotency_key: string | null
          last_contact_at: string | null
          message: string | null
          next_action: string | null
          next_action_at: string | null
          owner: string | null
          phone: string | null
          priority: string
          products_interest: string | null
          qualification_score: number | null
          quote_draft: Json | null
          quote_draft_updated_at: string | null
          source_url: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          admin_note?: string | null
          blocker?: string | null
          business_type?: string | null
          company_name: string
          contact_name: string
          contact_preference?: string | null
          contact_role?: string | null
          contacted_at?: string | null
          country_city?: string | null
          created_at?: string
          decision_maker?: string | null
          email: string
          estimated_volume?: string | null
          first_order_id?: string | null
          first_order_linked_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_contact_at?: string | null
          message?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner?: string | null
          phone?: string | null
          priority?: string
          products_interest?: string | null
          qualification_score?: number | null
          quote_draft?: Json | null
          quote_draft_updated_at?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          admin_note?: string | null
          blocker?: string | null
          business_type?: string | null
          company_name?: string
          contact_name?: string
          contact_preference?: string | null
          contact_role?: string | null
          contacted_at?: string | null
          country_city?: string | null
          created_at?: string
          decision_maker?: string | null
          email?: string
          estimated_volume?: string | null
          first_order_id?: string | null
          first_order_linked_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_contact_at?: string | null
          message?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner?: string | null
          phone?: string | null
          priority?: string
          products_interest?: string | null
          qualification_score?: number | null
          quote_draft?: Json | null
          quote_draft_updated_at?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_leads_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata: Json | null
          order_id: string | null
          read_at: string | null
          shipment_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          shipment_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          shipment_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      order_lifecycle_events: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          new_value: string
          order_id: string
          previous_value: string
          transition_type: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          new_value: string
          order_id: string
          previous_value: string
          transition_type: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          new_value?: string
          order_id?: string
          previous_value?: string
          transition_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lifecycle_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          b2b_account_id: string | null
          buyer_id: string | null
          created_at: string
          guest_email: string | null
          id: string
          legal_acceptance: Json | null
          order_number: string
          payment_attention: string | null
          payment_method: string | null
          payment_status: string
          shipping_address: Json
          shipping_aed: number
          status: string
          stripe_paid_attempt_id: string | null
          subtotal_aed: number
          tax_aed: number
          total_aed: number
          updated_at: string
        }
        Insert: {
          b2b_account_id?: string | null
          buyer_id?: string | null
          created_at?: string
          guest_email?: string | null
          id?: string
          legal_acceptance?: Json | null
          order_number: string
          payment_attention?: string | null
          payment_method?: string | null
          payment_status?: string
          shipping_address: Json
          shipping_aed?: number
          status?: string
          stripe_paid_attempt_id?: string | null
          subtotal_aed: number
          tax_aed?: number
          total_aed: number
          updated_at?: string
        }
        Update: {
          b2b_account_id?: string | null
          buyer_id?: string | null
          created_at?: string
          guest_email?: string | null
          id?: string
          legal_acceptance?: Json | null
          order_number?: string
          payment_attention?: string | null
          payment_method?: string | null
          payment_status?: string
          shipping_address?: Json
          shipping_aed?: number
          status?: string
          stripe_paid_attempt_id?: string | null
          subtotal_aed?: number
          tax_aed?: number
          total_aed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_stripe_paid_attempt_id_fkey"
            columns: ["stripe_paid_attempt_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_aed: number
          captured_aed: number
          created_at: string
          id: string
          metadata: Json
          order_id: string
          provider: string
          provider_mode: string | null
          provider_reference: string | null
          refunded_aed: number
          status: string
          updated_at: string
        }
        Insert: {
          amount_aed: number
          captured_aed?: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          provider: string
          provider_mode?: string | null
          provider_reference?: string | null
          refunded_aed?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount_aed?: number
          captured_aed?: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          provider?: string
          provider_mode?: string | null
          provider_reference?: string | null
          refunded_aed?: number
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
      admin_add_b2b_lead_note_v1: {
        Args: { p_body: string; p_lead_id: string }
        Returns: Json
      }
      admin_delete_b2b_lead_note_v1: {
        Args: { p_note_id: string }
        Returns: Json
      }
      admin_get_b2b_lead_v1: { Args: { p_lead_id: string }; Returns: Json }
      admin_import_product_row_v1: {
        Args: {
          p_brand: string
          p_category_slug: string
          p_compare_at_price_aed: number
          p_description_en: string
          p_format_label: string
          p_image_urls: Json
          p_is_bulk: boolean
          p_is_halal: boolean
          p_name_ar: string
          p_name_en: string
          p_name_es: string
          p_origin_region: string
          p_price_aed: number
          p_sku: string
          p_slug: string
          p_spice_level: number
          p_status: string
          p_stock: number
          p_weight_grams: number
        }
        Returns: Json
      }
      admin_list_b2b_leads_v1: { Args: { p_status?: string }; Returns: Json }
      admin_save_b2b_quote_draft_v1: {
        Args: { p_lead_id: string; p_quote_draft: Json }
        Returns: Json
      }
      admin_transition_order_lifecycle_v1: {
        Args: {
          p_expected_from: string
          p_order_id: string
          p_to: string
          p_transition_type: string
        }
        Returns: Json
      }
      admin_update_b2b_lead_pipeline_v1: {
        Args: {
          p_blocker: string
          p_decision_maker: string
          p_first_order_id: string
          p_last_contact_at: string
          p_lead_id: string
          p_next_action: string
          p_next_action_at: string
          p_owner: string
          p_priority: string
          p_qualification_score: number
          p_source_url: string
          p_website: string
        }
        Returns: Json
      }
      admin_update_b2b_lead_v1: {
        Args: {
          p_admin_note?: string
          p_lead_id: string
          p_set_admin_note?: boolean
          p_status?: string
        }
        Returns: Json
      }
      admin_upsert_product_v1: {
        Args: {
          p_attrs: Json
          p_brand: string
          p_category_id: string
          p_description_ar: string
          p_description_en: string
          p_description_es: string
          p_is_bulk: boolean
          p_is_halal: boolean
          p_name_ar: string
          p_name_en: string
          p_name_es: string
          p_origin_region: string
          p_product_id: string
          p_slug: string
          p_spice_level: number
          p_status: string
        }
        Returns: string
      }
      admin_upsert_product_variant_v1: {
        Args: {
          p_compare_at_price_aed?: number
          p_format_label?: string
          p_is_active?: boolean
          p_is_default?: boolean
          p_price_aed?: number
          p_product_id: string
          p_sku?: string
          p_stock?: number
          p_variant_id?: string
          p_weight_grams?: number
        }
        Returns: string
      }
      b2b_portal_v1: {
        Args: { p_account_id?: string; p_action: string; p_payload?: Json }
        Returns: Json
      }
      cm_accounting_admin_action_v2: {
        Args: { p_action: string; p_actor_id: string; p_id: string }
        Returns: Json
      }
      cm_accounting_control_center_v2: {
        Args: { p_actor_id: string }
        Returns: Json
      }
      cm_accounting_job_action_v2: {
        Args: {
          p_action: string
          p_job_id: string
          p_payload?: Json
          p_worker_id: string
        }
        Returns: Json
      }
      cm_claim_accounting_jobs_v2: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "accounting_integration_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cm_claim_guest_order_v1: {
        Args: { p_order_id: string; p_token: string; p_user_id: string }
        Returns: Json
      }
      cm_com_4a_order_lifecycle_capability: { Args: never; Returns: boolean }
      cm_completed_checkout_operation_v2: {
        Args: { p_actor_id: string; p_order_id: string }
        Returns: string
      }
      cm_create_card_order_v2: {
        Args: {
          p_account_id?: string
          p_buyer_id: string
          p_items: Json
          p_legal_acceptance: Json
          p_mode: string
          p_operation_id: string
          p_shipping_address: Json
          p_shipping_aed: number
          p_tax_rate: number
        }
        Returns: Json
      }
      cm_create_cod_order_v2: {
        Args: {
          p_buyer_id: string
          p_guest_email: string
          p_items: Json
          p_legal_acceptance: Json
          p_operation_id: string
          p_shipping_address: Json
          p_shipping_aed: number
          p_tax_rate: number
        }
        Returns: Json
      }
      cm_guest_order_by_token_v1: {
        Args: { p_order_id: string; p_token: string }
        Returns: Json
      }
      cm_invoice_projection_v2: {
        Args: { p_actor_id: string; p_order_id: string }
        Returns: Json
      }
      cm_market_identity_v1: { Args: never; Returns: Json }
      cm_mx_apply_payment_state_v1: {
        Args: {
          p_amount: number
          p_late_capture: boolean
          p_provider: string
          p_provider_payment_id: string
          p_raw_status: string
          p_raw_status_detail: string
          p_refunded_amount: number
          p_status: string
        }
        Returns: Json
      }
      cm_mx_apply_shipment_event_v1: {
        Args: {
          p_label_url: string
          p_provider: string
          p_provider_shipment_id: string
          p_raw_status: string
          p_status: string
          p_tracking_number: string
          p_tracking_url: string
        }
        Returns: Json
      }
      cm_mx_bind_payment_attempt_v1: {
        Args: {
          p_attempt_id: string
          p_provider_payment_id: string
          p_raw_status: string
          p_raw_status_detail: string
          p_redirect_url: string
        }
        Returns: undefined
      }
      cm_mx_claim_webhook_event_v1: {
        Args: {
          p_external_event_id: string
          p_payload_hash: string
          p_provider: string
          p_raw_payload: Json
        }
        Returns: boolean
      }
      cm_mx_complete_webhook_event_v1: {
        Args: {
          p_external_event_id: string
          p_provider: string
          p_status: string
        }
        Returns: undefined
      }
      cm_mx_create_order_v1: {
        Args: {
          p_buyer_id: string
          p_guest_email: string
          p_items: Json
          p_legal_acceptance: Json
          p_operation_id: string
          p_payment_method: string
          p_shipping: number
          p_shipping_address: Json
          p_tax_rate: number
        }
        Returns: Json
      }
      cm_mx_import_launch_sku_v1: { Args: { p_sku: Json }; Returns: Json }
      cm_mx_launch_assortment_v1: {
        Args: never
        Returns: {
          available: number
          b2b_price: number
          case_pack: number
          gaps: string[]
          last_purchase_cost: number
          launch_status: string
          lead_time_days: number
          minimum_order_quantity: number
          on_hand: number
          preferred_supplier: string
          product_slug: string
          reorder_point: number
          reserved: number
          retail_price: number
          sku: string
          supplier_cost: number
          units_sold_30d: number
          variant_id: string
          weight_grams: number
        }[]
      }
      cm_mx_order_payment_attempt_v1: {
        Args: { p_order_id: string }
        Returns: Json
      }
      cm_mx_payment_attempt_v1: {
        Args: { p_provider: string; p_provider_payment_id: string }
        Returns: Json
      }
      cm_mx_reserve_label_v1: {
        Args: {
          p_order_id: string
          p_provider: string
          p_provider_rate_id: string
        }
        Returns: boolean
      }
      cm_mx_set_launch_status_v1: {
        Args: { p_status: string; p_variant_id: string }
        Returns: Json
      }
      cm_mx_start_payment_attempt_v1: {
        Args: {
          p_idempotency_key: string
          p_order_id: string
          p_provider: string
        }
        Returns: Json
      }
      cm_operational_status_v2: { Args: { p_actor_id: string }; Returns: Json }
      cm_pay_bind_stripe_checkout_session_v1: {
        Args: {
          p_payment_id: string
          p_payment_intent_id?: string
          p_session_id: string
        }
        Returns: Json
      }
      cm_pay_bind_stripe_session_v2: {
        Args: {
          p_mode: string
          p_payment_id: string
          p_payment_intent_id: string
          p_session_id: string
        }
        Returns: Json
      }
      cm_pay_create_stripe_attempt_v1: {
        Args: { p_order_id: string }
        Returns: Json
      }
      cm_pay_create_stripe_attempt_v2: {
        Args: { p_mode: string; p_order_id: string }
        Returns: Json
      }
      cm_pay_note_stripe_attempt_degraded_v1: {
        Args: { p_payment_id: string }
        Returns: Json
      }
      cm_pay_process_stripe_webhook_v1: {
        Args: {
          p_amount_aed: number
          p_currency: string
          p_event_id: string
          p_event_type: string
          p_order_id: string
          p_payment_id: string
          p_payment_intent_id?: string
          p_payment_status?: string
          p_provider_created_at?: string
          p_provider_object_id: string
          p_refunded_amount_aed?: number
        }
        Returns: Json
      }
      cm_pay_process_stripe_webhook_v2: {
        Args: {
          p_amount_aed: number
          p_currency: string
          p_event_id: string
          p_event_type: string
          p_mode: string
          p_order_id: string
          p_payment_id: string
          p_payment_intent_id: string
          p_payment_status: string
          p_provider_created_at: string
          p_provider_object_id: string
          p_refunded_amount_aed: number
        }
        Returns: Json
      }
      cm_po_action_v1: {
        Args: { p_action: string; p_actor_id?: string; p_payload?: Json }
        Returns: Json
      }
      cm_po_claim_v1: {
        Args: { p_mode: string; p_organization_id: string; p_worker_id: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "po_intakes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cm_release_order_stock_v1: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      cm_runtime_capabilities_v2: { Args: never; Returns: Json }
      place_cod_order_v1: {
        Args: {
          p_buyer_id: string
          p_items: Json
          p_legal_acceptance: Json
          p_shipping_address: Json
          p_shipping_aed: number
          p_tax_rate: number
        }
        Returns: Json
      }
      place_cod_order_v2: {
        Args: {
          p_buyer_id: string
          p_guest_email: string
          p_items: Json
          p_legal_acceptance: Json
          p_shipping_address: Json
          p_shipping_aed: number
          p_tax_rate: number
        }
        Returns: Json
      }
      submit_b2b_lead_v1: {
        Args: {
          p_business_type: string
          p_company: string
          p_contact_preference: string
          p_contact_role: string
          p_country_city: string
          p_email: string
          p_estimated_volume: string
          p_full_name: string
          p_idempotency_key: string
          p_message: string
          p_phone: string
          p_products_interest: string
        }
        Returns: Json
      }
      submit_b2b_lead_v2: {
        Args: {
          p_abuse_key: string
          p_business_type: string
          p_company: string
          p_contact_preference: string
          p_contact_role: string
          p_country_city: string
          p_email: string
          p_estimated_volume: string
          p_full_name: string
          p_idempotency_key: string
          p_message: string
          p_phone: string
          p_products_interest: string
        }
        Returns: Json
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

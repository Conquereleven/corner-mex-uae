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
      anomaly_events: {
        Row: {
          anomaly_key: string
          assigned_to_user_id: string | null
          confidence_score: number | null
          created_at: string
          description: string | null
          dismissed_at: string | null
          emirate_code: string | null
          emirate_name: string | null
          evidence: Json
          first_detected_at: string
          hypotheses: Json
          id: string
          last_detected_at: string
          product_id: string | null
          product_slug: string | null
          resolved_at: string | null
          severity: string
          source: string
          status: string
          suggested_action: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          anomaly_key: string
          assigned_to_user_id?: string | null
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          dismissed_at?: string | null
          emirate_code?: string | null
          emirate_name?: string | null
          evidence?: Json
          first_detected_at?: string
          hypotheses?: Json
          id?: string
          last_detected_at?: string
          product_id?: string | null
          product_slug?: string | null
          resolved_at?: string | null
          severity: string
          source?: string
          status?: string
          suggested_action?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          anomaly_key?: string
          assigned_to_user_id?: string | null
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          dismissed_at?: string | null
          emirate_code?: string | null
          emirate_name?: string | null
          evidence?: Json
          first_detected_at?: string
          hypotheses?: Json
          id?: string
          last_detected_at?: string
          product_id?: string | null
          product_slug?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          suggested_action?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_leads: {
        Row: {
          admin_note: string | null
          business_type: string | null
          company: string | null
          contact_preference: string | null
          contacted_at: string | null
          country_city: string | null
          created_at: string
          email: string
          estimated_volume: string | null
          full_name: string
          id: string
          idempotency_key: string | null
          message: string | null
          phone: string | null
          products_interest: string | null
          source: string | null
          status: Database["public"]["Enums"]["b2b_lead_status"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          business_type?: string | null
          company?: string | null
          contact_preference?: string | null
          contacted_at?: string | null
          country_city?: string | null
          created_at?: string
          email: string
          estimated_volume?: string | null
          full_name: string
          id?: string
          idempotency_key?: string | null
          message?: string | null
          phone?: string | null
          products_interest?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["b2b_lead_status"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          business_type?: string | null
          company?: string | null
          contact_preference?: string | null
          contacted_at?: string | null
          country_city?: string | null
          created_at?: string
          email?: string
          estimated_volume?: string | null
          full_name?: string
          id?: string
          idempotency_key?: string | null
          message?: string | null
          phone?: string | null
          products_interest?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["b2b_lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      catalog_events: {
        Row: {
          category_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["catalog_event_type"]
          id: string
          metadata: Json | null
          order_id: string | null
          product_id: string | null
          revenue_aed: number | null
          seller_id: string | null
          session_hash: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["catalog_event_type"]
          id?: string
          metadata?: Json | null
          order_id?: string | null
          product_id?: string | null
          revenue_aed?: number | null
          seller_id?: string | null
          session_hash?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["catalog_event_type"]
          id?: string
          metadata?: Json | null
          order_id?: string | null
          product_id?: string | null
          revenue_aed?: number | null
          seller_id?: string | null
          session_hash?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_discount_aed: number | null
          max_uses: number | null
          min_subtotal_aed: number
          seller_id: string | null
          starts_at: string | null
          updated_at: string
          uses_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_discount_aed?: number | null
          max_uses?: number | null
          min_subtotal_aed?: number
          seller_id?: string | null
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["coupon_kind"]
          max_discount_aed?: number | null
          max_uses?: number | null
          min_subtotal_aed?: number
          seller_id?: string | null
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Relationships: []
      }
      currency_rates: {
        Row: {
          base: string
          fetched_at: string
          id: string
          quote: string
          rate: number
        }
        Insert: {
          base?: string
          fetched_at?: string
          id?: string
          quote: string
          rate: number
        }
        Update: {
          base?: string
          fetched_at?: string
          id?: string
          quote?: string
          rate?: number
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          lead_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "b2b_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          lead_id: string
          note: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          lead_id: string
          note?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "b2b_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          created_at: string
          id: string
          lifetime_spend_aed: number
          points_balance: number
          tier: Database["public"]["Enums"]["loyalty_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lifetime_spend_aed?: number
          points_balance?: number
          tier?: Database["public"]["Enums"]["loyalty_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lifetime_spend_aed?: number
          points_balance?: number
          tier?: Database["public"]["Enums"]["loyalty_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["loyalty_txn_kind"]
          metadata: Json | null
          order_id: string | null
          points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["loyalty_txn_kind"]
          metadata?: Json | null
          order_id?: string | null
          points: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["loyalty_txn_kind"]
          metadata?: Json | null
          order_id?: string | null
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          locale: string
          source: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          locale?: string
          source?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          locale?: string
          source?: string | null
          status?: string
        }
        Relationships: []
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
        Relationships: []
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_role: string
          created_at: string
          id: string
          kind: string
          message: string | null
          order_id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          order_id: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          order_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          shipment_id: string | null
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
          shipment_id?: string | null
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
          shipment_id?: string | null
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
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
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
      order_notes: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          author_id: string
          author_role?: string
          body: string
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          channel: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          order_id: string
          payload: Json | null
          sent_at: string
          status: string
        }
        Insert: {
          channel?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          order_id: string
          payload?: Json | null
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          order_id?: string
          payload?: Json | null
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          discount_aed: number
          id: string
          legal_acceptance: Json | null
          notes: string | null
          order_number: string
          paid_at: string | null
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
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_aed?: number
          id?: string
          legal_acceptance?: Json | null
          notes?: string | null
          order_number?: string
          paid_at?: string | null
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
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_aed?: number
          id?: string
          legal_acceptance?: Json | null
          notes?: string | null
          order_number?: string
          paid_at?: string | null
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
      product_reviews: {
        Row: {
          body: string | null
          buyer_id: string
          created_at: string
          id: string
          is_verified_purchase: boolean
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          seller_id: string
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          seller_id: string
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          order_id?: string
          order_item_id?: string
          product_id?: string
          rating?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
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
      product_views: {
        Row: {
          category_id: string | null
          id: number
          product_id: string
          seller_id: string | null
          session_hash: string | null
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          category_id?: string | null
          id?: number
          product_id: string
          seller_id?: string | null
          session_hash?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          category_id?: string | null
          id?: number
          product_id?: string
          seller_id?: string | null
          session_hash?: string | null
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_views_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          approval_note: string | null
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
          approval_note?: string | null
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
          approval_note?: string | null
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
      promo_banners: {
        Row: {
          created_at: string
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      returns: {
        Row: {
          buyer_id: string
          buyer_notes: string | null
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          qty: number
          reason: Database["public"]["Enums"]["return_reason"]
          refund_aed: number | null
          resolved_at: string | null
          return_number: string
          seller_id: string
          seller_response: string | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_notes?: string | null
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          qty: number
          reason: Database["public"]["Enums"]["return_reason"]
          refund_aed?: number | null
          resolved_at?: string | null
          return_number?: string
          seller_id: string
          seller_response?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_notes?: string | null
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          qty?: number
          reason?: Database["public"]["Enums"]["return_reason"]
          refund_aed?: number | null
          resolved_at?: string | null
          return_number?: string
          seller_id?: string
          seller_response?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
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
          receipt_path: string | null
          requested_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
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
          receipt_path?: string | null
          requested_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
          receipt_path?: string | null
          requested_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
          accepted_payment_methods: string[] | null
          address_line1: string | null
          address_line2: string | null
          auto_accept_orders: boolean
          bank_account_holder: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift: string | null
          banner_url: string | null
          bio: string | null
          business_hours: Json | null
          city: string | null
          commission_rate: number
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          currency: string | null
          featured_product_ids: string[] | null
          id: string
          is_house_account: boolean
          is_published: boolean
          kyc_documents: Json
          kyc_rejection_reason: string | null
          kyc_reviewed_at: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          last_auto_payout_at: string | null
          legal_name: string | null
          logo_url: string | null
          min_payout_aed: number
          notify_low_stock: boolean
          notify_new_order: boolean
          notify_payout: boolean
          notify_return: boolean | null
          notify_review: boolean | null
          payout_method: string
          payout_schedule: string
          postal_code: string | null
          processing_days: number
          slug: string
          social_links: Json
          status: Database["public"]["Enums"]["seller_status"]
          store_name: string
          support_email: string | null
          support_phone: string | null
          tagline: string | null
          tax_inclusive_pricing: boolean | null
          tax_rate: number | null
          theme: Json
          trn: string | null
          updated_at: string
          user_id: string
          vacation_message: string | null
          vacation_mode: boolean
          vat_number: string | null
        }
        Insert: {
          accepted_payment_methods?: string[] | null
          address_line1?: string | null
          address_line2?: string | null
          auto_accept_orders?: boolean
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          banner_url?: string | null
          bio?: string | null
          business_hours?: Json | null
          city?: string | null
          commission_rate?: number
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string | null
          featured_product_ids?: string[] | null
          id?: string
          is_house_account?: boolean
          is_published?: boolean
          kyc_documents?: Json
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_auto_payout_at?: string | null
          legal_name?: string | null
          logo_url?: string | null
          min_payout_aed?: number
          notify_low_stock?: boolean
          notify_new_order?: boolean
          notify_payout?: boolean
          notify_return?: boolean | null
          notify_review?: boolean | null
          payout_method?: string
          payout_schedule?: string
          postal_code?: string | null
          processing_days?: number
          slug: string
          social_links?: Json
          status?: Database["public"]["Enums"]["seller_status"]
          store_name: string
          support_email?: string | null
          support_phone?: string | null
          tagline?: string | null
          tax_inclusive_pricing?: boolean | null
          tax_rate?: number | null
          theme?: Json
          trn?: string | null
          updated_at?: string
          user_id: string
          vacation_message?: string | null
          vacation_mode?: boolean
          vat_number?: string | null
        }
        Update: {
          accepted_payment_methods?: string[] | null
          address_line1?: string | null
          address_line2?: string | null
          auto_accept_orders?: boolean
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          banner_url?: string | null
          bio?: string | null
          business_hours?: Json | null
          city?: string | null
          commission_rate?: number
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string | null
          featured_product_ids?: string[] | null
          id?: string
          is_house_account?: boolean
          is_published?: boolean
          kyc_documents?: Json
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_auto_payout_at?: string | null
          legal_name?: string | null
          logo_url?: string | null
          min_payout_aed?: number
          notify_low_stock?: boolean
          notify_new_order?: boolean
          notify_payout?: boolean
          notify_return?: boolean | null
          notify_review?: boolean | null
          payout_method?: string
          payout_schedule?: string
          postal_code?: string | null
          processing_days?: number
          slug?: string
          social_links?: Json
          status?: Database["public"]["Enums"]["seller_status"]
          store_name?: string
          support_email?: string | null
          support_phone?: string | null
          tagline?: string | null
          tax_inclusive_pricing?: boolean | null
          tax_rate?: number | null
          theme?: Json
          trn?: string | null
          updated_at?: string
          user_id?: string
          vacation_message?: string | null
          vacation_mode?: boolean
          vat_number?: string | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: Database["public"]["Enums"]["carrier_code"]
          cost_aed: number | null
          created_at: string
          delivered_at: string | null
          id: string
          label_url: string | null
          notes: string | null
          order_id: string
          seller_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          carrier: Database["public"]["Enums"]["carrier_code"]
          cost_aed?: number | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          label_url?: string | null
          notes?: string | null
          order_id: string
          seller_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          carrier?: Database["public"]["Enums"]["carrier_code"]
          cost_aed?: number | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          label_url?: string | null
          notes?: string | null
          order_id?: string
          seller_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_grams?: number | null
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
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_order_state: {
        Args: {
          p_order_id: string
          p_payment_status?: Database["public"]["Enums"]["payment_status"]
          p_status?: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          buyer_id: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          discount_aed: number
          id: string
          legal_acceptance: Json | null
          notes: string | null
          order_number: string
          paid_at: string | null
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
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_verified_review: {
        Args: {
          p_comment?: string
          p_order_item_id: string
          p_rating: number
          p_title?: string
        }
        Returns: {
          body: string | null
          buyer_id: string
          created_at: string
          id: string
          is_verified_purchase: boolean
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          seller_id: string
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "product_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seller_update_order_item_fulfillment: {
        Args: {
          p_item_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          commission_aed: number
          fulfillment_status: Database["public"]["Enums"]["order_status"]
          id: string
          line_total_aed: number
          order_id: string
          product_id: string
          product_name: string
          qty: number
          seller_id: string
          shipment_id: string | null
          unit_price_aed: number
          variant_id: string
          variant_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      track_product_view: {
        Args: { p_product_id: string; p_session_hash?: string }
        Returns: undefined
      }
      update_verified_review: {
        Args: {
          p_comment?: string
          p_rating: number
          p_review_id: string
          p_title?: string
        }
        Returns: {
          body: string | null
          buyer_id: string
          created_at: string
          id: string
          is_verified_purchase: boolean
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          seller_id: string
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "product_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "buyer" | "seller" | "admin"
      b2b_lead_status: "new" | "contacted" | "quoting" | "closed" | "lost"
      carrier_code:
        | "aramex"
        | "dhl"
        | "fedex"
        | "talabat"
        | "local_courier"
        | "pickup"
        | "other"
      catalog_event_type:
        | "card_impression"
        | "card_click"
        | "product_view"
        | "add_to_cart"
        | "wishlist_add"
        | "b2b_lead_submit"
        | "checkout_started"
        | "purchase_completed"
      coupon_kind: "percent" | "fixed"
      emirate:
        | "abu_dhabi"
        | "dubai"
        | "sharjah"
        | "ajman"
        | "umm_al_quwain"
        | "ras_al_khaimah"
        | "fujairah"
      lang_code: "en" | "ar" | "es"
      loyalty_tier: "bronze" | "silver" | "gold" | "platinum"
      loyalty_txn_kind: "earn" | "redeem" | "adjust" | "expire"
      notification_kind:
        | "order_placed"
        | "order_confirmed"
        | "shipped"
        | "delivered"
        | "payout_paid"
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
      product_status: "draft" | "pending" | "active" | "archived" | "rejected"
      quote_status:
        | "open"
        | "responded"
        | "accepted"
        | "rejected"
        | "expired"
        | "contacted"
        | "negotiating"
        | "won"
        | "lost"
      return_reason:
        | "damaged"
        | "wrong_item"
        | "not_as_described"
        | "quality_issue"
        | "no_longer_needed"
        | "other"
      return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "received"
        | "refunded"
        | "cancelled"
      review_status: "pending" | "approved" | "hidden"
      seller_status: "pending" | "active" | "suspended"
      shipment_status:
        | "prepared"
        | "in_transit"
        | "delivered"
        | "returned"
        | "lost"
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
      b2b_lead_status: ["new", "contacted", "quoting", "closed", "lost"],
      carrier_code: [
        "aramex",
        "dhl",
        "fedex",
        "talabat",
        "local_courier",
        "pickup",
        "other",
      ],
      catalog_event_type: [
        "card_impression",
        "card_click",
        "product_view",
        "add_to_cart",
        "wishlist_add",
        "b2b_lead_submit",
        "checkout_started",
        "purchase_completed",
      ],
      coupon_kind: ["percent", "fixed"],
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
      loyalty_tier: ["bronze", "silver", "gold", "platinum"],
      loyalty_txn_kind: ["earn", "redeem", "adjust", "expire"],
      notification_kind: [
        "order_placed",
        "order_confirmed",
        "shipped",
        "delivered",
        "payout_paid",
      ],
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
      product_status: ["draft", "pending", "active", "archived", "rejected"],
      quote_status: [
        "open",
        "responded",
        "accepted",
        "rejected",
        "expired",
        "contacted",
        "negotiating",
        "won",
        "lost",
      ],
      return_reason: [
        "damaged",
        "wrong_item",
        "not_as_described",
        "quality_issue",
        "no_longer_needed",
        "other",
      ],
      return_status: [
        "requested",
        "approved",
        "rejected",
        "received",
        "refunded",
        "cancelled",
      ],
      review_status: ["pending", "approved", "hidden"],
      seller_status: ["pending", "active", "suspended"],
      shipment_status: [
        "prepared",
        "in_transit",
        "delivered",
        "returned",
        "lost",
      ],
    },
  },
} as const

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
      ania_settings: {
        Row: {
          assistant_name: string | null
          company_description: string | null
          created_at: string
          fallback_message: string | null
          global_instructions: string | null
          human_support_url: string | null
          human_support_whatsapp: string | null
          id: string
          pix_bank: string | null
          pix_key: string | null
          pix_receiver_name: string | null
          sales_rules: string | null
          support_email: string | null
          tenant_id: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          assistant_name?: string | null
          company_description?: string | null
          created_at?: string
          fallback_message?: string | null
          global_instructions?: string | null
          human_support_url?: string | null
          human_support_whatsapp?: string | null
          id?: string
          pix_bank?: string | null
          pix_key?: string | null
          pix_receiver_name?: string | null
          sales_rules?: string | null
          support_email?: string | null
          tenant_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          assistant_name?: string | null
          company_description?: string | null
          created_at?: string
          fallback_message?: string | null
          global_instructions?: string | null
          human_support_url?: string | null
          human_support_whatsapp?: string | null
          id?: string
          pix_bank?: string | null
          pix_key?: string | null
          pix_receiver_name?: string | null
          sales_rules?: string | null
          support_email?: string | null
          tenant_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      business_config: {
        Row: {
          accent_color: string | null
          assistant_bubble_text: string | null
          assistant_image_url: string | null
          assistant_position: string | null
          assistant_position_axis: string | null
          assistant_position_value: number | null
          assistant_size: number | null
          assistant_voice: string | null
          assistant_voice_speed: number | null
          assistant_voice_style: string | null
          business_category: string | null
          business_name: string | null
          button_color: string | null
          chat_ania_bubble_color: string | null
          chat_catalog_card_color: string | null
          chat_header_color: string | null
          chat_icon_color: string | null
          chat_input_bg_color: string | null
          chat_link_color: string | null
          chat_send_button_color: string | null
          chat_user_bubble_color: string | null
          chat_wallpaper_blur: string | null
          chat_wallpaper_dim: boolean | null
          chat_wallpaper_fit: string | null
          chat_wallpaper_opacity: number | null
          chat_wallpaper_url: string | null
          created_at: string
          footer_text: string | null
          hero_banner_url: string | null
          hero_button_glow: number | null
          hero_button_radius: number | null
          hero_button_text: string | null
          hero_subtitle: string | null
          hero_subtitle_size: number | null
          hero_title: string | null
          hero_title_size: number | null
          id: string
          official_icon_url: string | null
          payment_link: string | null
          primary_color: string | null
          sale_mode: string
          section_texts: Json | null
          show_assistant_bubble: boolean | null
          splash_animation: boolean | null
          splash_bg_color: string | null
          splash_bg_gradient_from: string | null
          splash_bg_gradient_to: string | null
          splash_bg_type: string | null
          splash_duration_ms: number | null
          splash_enabled: boolean | null
          splash_image_url: string | null
          tenant_id: string | null
          text_color: string | null
          title_color: string | null
          transfer_enabled: boolean
          updated_at: string
          use_emojis: boolean
          whatsapp_number: string | null
        }
        Insert: {
          accent_color?: string | null
          assistant_bubble_text?: string | null
          assistant_image_url?: string | null
          assistant_position?: string | null
          assistant_position_axis?: string | null
          assistant_position_value?: number | null
          assistant_size?: number | null
          assistant_voice?: string | null
          assistant_voice_speed?: number | null
          assistant_voice_style?: string | null
          business_category?: string | null
          business_name?: string | null
          button_color?: string | null
          chat_ania_bubble_color?: string | null
          chat_catalog_card_color?: string | null
          chat_header_color?: string | null
          chat_icon_color?: string | null
          chat_input_bg_color?: string | null
          chat_link_color?: string | null
          chat_send_button_color?: string | null
          chat_user_bubble_color?: string | null
          chat_wallpaper_blur?: string | null
          chat_wallpaper_dim?: boolean | null
          chat_wallpaper_fit?: string | null
          chat_wallpaper_opacity?: number | null
          chat_wallpaper_url?: string | null
          created_at?: string
          footer_text?: string | null
          hero_banner_url?: string | null
          hero_button_glow?: number | null
          hero_button_radius?: number | null
          hero_button_text?: string | null
          hero_subtitle?: string | null
          hero_subtitle_size?: number | null
          hero_title?: string | null
          hero_title_size?: number | null
          id?: string
          official_icon_url?: string | null
          payment_link?: string | null
          primary_color?: string | null
          sale_mode?: string
          section_texts?: Json | null
          show_assistant_bubble?: boolean | null
          splash_animation?: boolean | null
          splash_bg_color?: string | null
          splash_bg_gradient_from?: string | null
          splash_bg_gradient_to?: string | null
          splash_bg_type?: string | null
          splash_duration_ms?: number | null
          splash_enabled?: boolean | null
          splash_image_url?: string | null
          tenant_id?: string | null
          text_color?: string | null
          title_color?: string | null
          transfer_enabled?: boolean
          updated_at?: string
          use_emojis?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          accent_color?: string | null
          assistant_bubble_text?: string | null
          assistant_image_url?: string | null
          assistant_position?: string | null
          assistant_position_axis?: string | null
          assistant_position_value?: number | null
          assistant_size?: number | null
          assistant_voice?: string | null
          assistant_voice_speed?: number | null
          assistant_voice_style?: string | null
          business_category?: string | null
          business_name?: string | null
          button_color?: string | null
          chat_ania_bubble_color?: string | null
          chat_catalog_card_color?: string | null
          chat_header_color?: string | null
          chat_icon_color?: string | null
          chat_input_bg_color?: string | null
          chat_link_color?: string | null
          chat_send_button_color?: string | null
          chat_user_bubble_color?: string | null
          chat_wallpaper_blur?: string | null
          chat_wallpaper_dim?: boolean | null
          chat_wallpaper_fit?: string | null
          chat_wallpaper_opacity?: number | null
          chat_wallpaper_url?: string | null
          created_at?: string
          footer_text?: string | null
          hero_banner_url?: string | null
          hero_button_glow?: number | null
          hero_button_radius?: number | null
          hero_button_text?: string | null
          hero_subtitle?: string | null
          hero_subtitle_size?: number | null
          hero_title?: string | null
          hero_title_size?: number | null
          id?: string
          official_icon_url?: string | null
          payment_link?: string | null
          primary_color?: string | null
          sale_mode?: string
          section_texts?: Json | null
          show_assistant_bubble?: boolean | null
          splash_animation?: boolean | null
          splash_bg_color?: string | null
          splash_bg_gradient_from?: string | null
          splash_bg_gradient_to?: string | null
          splash_bg_type?: string | null
          splash_duration_ms?: number | null
          splash_enabled?: boolean | null
          splash_image_url?: string | null
          tenant_id?: string | null
          text_color?: string | null
          title_color?: string | null
          transfer_enabled?: boolean
          updated_at?: string
          use_emojis?: boolean
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          closing_state: Json | null
          created_at: string
          id: string
          is_simulation: boolean
          negotiation_state: Json | null
          product_id: string | null
          session_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          closing_state?: Json | null
          created_at?: string
          id?: string
          is_simulation?: boolean
          negotiation_state?: Json | null
          product_id?: string | null
          session_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          closing_state?: Json | null
          created_at?: string
          id?: string
          is_simulation?: boolean
          negotiation_state?: Json | null
          product_id?: string | null
          session_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          categoria: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          categoria?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          categoria?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          show_on_landing: boolean
          slug: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          show_on_landing?: boolean
          slug: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          show_on_landing?: boolean
          slug?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_click_events: {
        Row: {
          click_type: string
          created_at: string
          id: string
          product_id: string
          tenant_id: string | null
        }
        Insert: {
          click_type: string
          created_at?: string
          id?: string
          product_id: string
          tenant_id?: string | null
        }
        Update: {
          click_type?: string
          created_at?: string
          id?: string
          product_id?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string
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
          admin_reply: string | null
          admin_reply_at: string | null
          ania_reply: string | null
          ania_reply_at: string | null
          comment: string
          created_at: string
          customer_name: string
          helpful_count: number
          id: string
          imported_at: string | null
          is_imported: boolean
          is_pinned: boolean
          is_reported: boolean
          product_id: string
          source_platform: string | null
          source_url: string | null
          stars: number
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          ania_reply?: string | null
          ania_reply_at?: string | null
          comment: string
          created_at?: string
          customer_name: string
          helpful_count?: number
          id?: string
          imported_at?: string | null
          is_imported?: boolean
          is_pinned?: boolean
          is_reported?: boolean
          product_id: string
          source_platform?: string | null
          source_url?: string | null
          stars: number
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          ania_reply?: string | null
          ania_reply_at?: string | null
          comment?: string
          created_at?: string
          customer_name?: string
          helpful_count?: number
          id?: string
          imported_at?: string | null
          is_imported?: boolean
          is_pinned?: boolean
          is_reported?: boolean
          product_id?: string
          source_platform?: string | null
          source_url?: string | null
          stars?: number
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          affiliate_url: string | null
          category: string | null
          created_at: string
          delivery_info: string | null
          external_product_id: string | null
          has_gallery: boolean
          id: string
          image_url: string | null
          imported_at: string | null
          is_featured: boolean
          is_hero: boolean
          last_synced_at: string | null
          long_description: string | null
          min_price_allowed: number | null
          name: string
          niche_id: string | null
          payment_link: string | null
          payment_methods: string[] | null
          price: number
          short_description: string | null
          show_on_products: boolean
          source_platform: string | null
          source_url: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_url?: string | null
          category?: string | null
          created_at?: string
          delivery_info?: string | null
          external_product_id?: string | null
          has_gallery?: boolean
          id?: string
          image_url?: string | null
          imported_at?: string | null
          is_featured?: boolean
          is_hero?: boolean
          last_synced_at?: string | null
          long_description?: string | null
          min_price_allowed?: number | null
          name: string
          niche_id?: string | null
          payment_link?: string | null
          payment_methods?: string[] | null
          price: number
          short_description?: string | null
          show_on_products?: boolean
          source_platform?: string | null
          source_url?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_url?: string | null
          category?: string | null
          created_at?: string
          delivery_info?: string | null
          external_product_id?: string | null
          has_gallery?: boolean
          id?: string
          image_url?: string | null
          imported_at?: string | null
          is_featured?: boolean
          is_hero?: boolean
          last_synced_at?: string | null
          long_description?: string | null
          min_price_allowed?: number | null
          name?: string
          niche_id?: string | null
          payment_link?: string | null
          payment_methods?: string[] | null
          price?: number
          short_description?: string | null
          show_on_products?: boolean
          source_platform?: string | null
          source_url?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_category: string | null
          business_name: string | null
          created_at: string
          id: string
          theme: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          business_category?: string | null
          business_name?: string | null
          created_at?: string
          id?: string
          theme?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          business_category?: string | null
          business_name?: string | null
          created_at?: string
          id?: string
          theme?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      review_helpful_votes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          voter_fingerprint: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          voter_fingerprint: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          voter_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      storefronts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_tenant_id: { Args: never; Returns: string }
      register_review_helpful: {
        Args: { _fingerprint: string; _review_id: string }
        Returns: boolean
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

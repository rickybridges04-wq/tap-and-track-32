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
      app_form_submissions: {
        Row: {
          app_id: string
          created_at: string
          form_name: string
          id: string
          payload: Json
          read_at: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          form_name: string
          id?: string
          payload?: Json
          read_at?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          form_name?: string
          id?: string
          payload?: Json
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_form_submissions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_rows: {
        Row: {
          created_at: string
          data: Json
          id: string
          table_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          table_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_rows_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "app_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      app_store_submissions: {
        Row: {
          app_id: string
          assets: Json
          checklist: Json
          created_at: string
          id: string
          status: string
          store: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          assets?: Json
          checklist?: Json
          created_at?: string
          id?: string
          status?: string
          store: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          assets?: Json
          checklist?: Json
          created_at?: string
          id?: string
          status?: string
          store?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_store_submissions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_tables: {
        Row: {
          app_id: string
          created_at: string
          id: string
          name: string
          schema: Json
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          name: string
          schema?: Json
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          name?: string
          schema?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_tables_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          base_url: string | null
          bg_color: string | null
          category: string | null
          created_at: string
          icon_url: string | null
          id: string
          long_desc: string | null
          name: string
          short_desc: string | null
          slug: string
          status: string
          theme_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url?: string | null
          bg_color?: string | null
          category?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          long_desc?: string | null
          name: string
          short_desc?: string | null
          slug: string
          status?: string
          theme_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string | null
          bg_color?: string | null
          category?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          long_desc?: string | null
          name?: string
          short_desc?: string | null
          slug?: string
          status?: string
          theme_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_campaigns: {
        Row: {
          app_id: string
          body: string
          created_at: string
          id: string
          image_url: string | null
          scheduled_for: string | null
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          app_id: string
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          app_id?: string
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaigns_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_subscribers: {
        Row: {
          app_id: string
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          unsubscribed_at: string | null
          user_agent: string | null
        }
        Insert: {
          app_id: string
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Update: {
          app_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_subscribers_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          theme_pref: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          theme_pref?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          theme_pref?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_findings: {
        Row: {
          category: string
          confidence: number
          created_at: string
          detail: string
          id: string
          page_url: string
          persona_id: string
          run_id: string
          severity: string
          suggestion: string | null
          title: string
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number
          created_at?: string
          detail: string
          id?: string
          page_url: string
          persona_id: string
          run_id: string
          severity: string
          suggestion?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          detail?: string
          id?: string
          page_url?: string
          persona_id?: string
          run_id?: string
          severity?: string
          suggestion?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "qa_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_pages: {
        Row: {
          created_at: string
          id: string
          links: Json
          markdown_preview: string | null
          run_id: string
          status: number | null
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          links?: Json
          markdown_preview?: string | null
          run_id: string
          status?: number | null
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          links?: Json
          markdown_preview?: string | null
          run_id?: string
          status?: number | null
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_pages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "qa_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          depth: string
          error: string | null
          id: string
          personas: string[]
          progress_pct: number
          progress_stage: string | null
          score: number | null
          status: string
          target_url: string
          user_id: string
          verdict: string | null
          warnings: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          depth: string
          error?: string | null
          id?: string
          personas?: string[]
          progress_pct?: number
          progress_stage?: string | null
          score?: number | null
          status?: string
          target_url: string
          user_id: string
          verdict?: string | null
          warnings?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          depth?: string
          error?: string | null
          id?: string
          personas?: string[]
          progress_pct?: number
          progress_stage?: string | null
          score?: number | null
          status?: string
          target_url?: string
          user_id?: string
          verdict?: string | null
          warnings?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          price_cents: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          price_cents?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          price_cents?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json | null
          user_id?: string
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
      app_role: "owner" | "admin" | "user"
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
      app_role: ["owner", "admin", "user"],
    },
  },
} as const

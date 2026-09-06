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
      expenses: {
        Row: {
          amount: number
          billable: boolean
          category: string
          city: string | null
          country: string | null
          created_at: string
          currency: string
          id: string
          merchant: string | null
          notes: string | null
          spent_on: string
          storage_path: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          billable?: boolean
          category?: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          merchant?: string | null
          notes?: string | null
          spent_on?: string
          storage_path?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billable?: boolean
          category?: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          merchant?: string | null
          notes?: string | null
          spent_on?: string
          storage_path?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      future_notes: {
        Row: {
          city: string
          country: string | null
          created_at: string
          id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string | null
          created_at?: string
          id?: string
          note: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string | null
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      itinerary_items: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          day_date: string | null
          detail: string | null
          id: string
          kind: string
          lat: number | null
          lon: number | null
          position: number
          time_label: string | null
          title: string
          trip_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          day_date?: string | null
          detail?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lon?: number | null
          position?: number
          time_label?: string | null
          title: string
          trip_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          day_date?: string | null
          detail?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lon?: number | null
          position?: number
          time_label?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      app_reports: {
        Row: {
          app_version: string | null
          created_at: string
          detail: string | null
          id: string
          kind: string
          message: string
          path: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          message: string
          path?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          message?: string
          path?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      legal_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          document_version: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          document_version: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          document_version?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      packing_items: {
        Row: {
          created_at: string
          id: string
          label: string
          list_id: string
          packed: boolean
          position: number
          quantity: number
          section: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          list_id: string
          packed?: boolean
          position?: number
          quantity?: number
          section?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          list_id?: string
          packed?: boolean
          position?: number
          quantity?: number
          section?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "packing_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_lists: {
        Row: {
          created_at: string
          emoji: string
          id: string
          name: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          name: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_lists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_memories: {
        Row: {
          caption: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          lat: number | null
          lon: number | null
          storage_path: string
          taken_at: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lon?: number | null
          storage_path: string
          taken_at?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lon?: number | null
          storage_path?: string
          taken_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avoid_notes: string | null
          budget_level: string | null
          created_at: string
          dietary_notes: string | null
          display_name: string | null
          home_city: string | null
          home_currency: string | null
          id: string
          preferences: string[]
          preferred_countries: string[]
          travel_style: string | null
          trip_pace: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          avoid_notes?: string | null
          budget_level?: string | null
          created_at?: string
          dietary_notes?: string | null
          display_name?: string | null
          home_city?: string | null
          home_currency?: string | null
          id: string
          preferences?: string[]
          preferred_countries?: string[]
          travel_style?: string | null
          trip_pace?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          avoid_notes?: string | null
          budget_level?: string | null
          created_at?: string
          dietary_notes?: string | null
          display_name?: string | null
          home_city?: string | null
          home_currency?: string | null
          id?: string
          preferences?: string[]
          preferred_countries?: string[]
          travel_style?: string | null
          trip_pace?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          lat: number | null
          lon: number | null
          name: string
          notes: string | null
          pin_type: string
          recommended_by: string | null
          source: string | null
          travel_tags: string[]
          updated_at: string
          url: string | null
          user_id: string
          visited: boolean
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lon?: number | null
          name: string
          notes?: string | null
          pin_type?: string
          recommended_by?: string | null
          source?: string | null
          travel_tags?: string[]
          updated_at?: string
          url?: string | null
          user_id: string
          visited?: boolean
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string
          notes?: string | null
          pin_type?: string
          recommended_by?: string | null
          source?: string | null
          travel_tags?: string[]
          updated_at?: string
          url?: string | null
          user_id?: string
          visited?: boolean
        }
        Relationships: []
      }
      trip_budget_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          label: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          label: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          label?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_budget_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          accepted_at: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          invited_by: string
          trip_id: string
        }
        Insert: {
          accepted_at?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          invited_by: string
          trip_id: string
        }
        Update: {
          accepted_at?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          invited_by?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          address: string | null
          arrive_on: string | null
          city: string
          country: string | null
          created_at: string
          created_by: string | null
          depart_on: string | null
          id: string
          kind: string
          lat: number | null
          lon: number | null
          notes: string | null
          place_name: string | null
          position: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          arrive_on?: string | null
          city: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          depart_on?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lon?: number | null
          notes?: string | null
          place_name?: string | null
          position?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          arrive_on?: string | null
          city?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          depart_on?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lon?: number | null
          notes?: string | null
          place_name?: string | null
          position?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget: string | null
          budget_amount: number
          budget_currency: string
          budget_enabled: boolean
          city: string | null
          country: string | null
          created_at: string
          dates_status: string | null
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          budget?: string | null
          budget_amount?: number
          budget_currency?: string
          budget_enabled?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          dates_status?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          budget?: string | null
          budget_amount?: number
          budget_currency?: string
          budget_enabled?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          dates_status?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      vault_documents: {
        Row: {
          ciphertext: string
          created_at: string
          expires_on: string | null
          id: string
          iv: string
          kind: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          expires_on?: string | null
          id?: string
          iv: string
          kind?: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          iv?: string
          kind?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_settings: {
        Row: {
          biometric_credential_id: string | null
          created_at: string
          salt: string
          updated_at: string
          user_id: string
          verifier: string
          verifier_iv: string
        }
        Insert: {
          biometric_credential_id?: string | null
          created_at?: string
          salt: string
          updated_at?: string
          user_id: string
          verifier: string
          verifier_iv: string
        }
        Update: {
          biometric_credential_id?: string | null
          created_at?: string
          salt?: string
          updated_at?: string
          user_id?: string
          verifier?: string
          verifier_iv?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_trip_invite: {
        Args: { _code: string; _display_name?: string }
        Returns: string
      }
      is_trip_member: {
        Args: { _trip_id: string; _user_id: string }
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

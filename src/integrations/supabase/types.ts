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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string | null
          datetime_end: string | null
          datetime_start: string
          doctor_id: string | null
          id: string
          institution_id: string | null
          notes: string | null
          reason: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          datetime_end?: string | null
          datetime_start: string
          doctor_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          datetime_end?: string | null
          datetime_start?: string
          doctor_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          specialty: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      file_attachments: {
        Row: {
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          file_name: string
          file_url: string
          id: string
          mime_type: string | null
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          file_name: string
          file_url: string
          id?: string
          mime_type?: string | null
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          file_name?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          type: Database["public"]["Enums"]["institution_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["institution_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["institution_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          created_at: string | null
          id: string
          medication_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["medication_log_status"] | null
          taken_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          medication_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["medication_log_status"] | null
          taken_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          medication_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["medication_log_status"] | null
          taken_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string | null
          dose_text: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          schedule_type: Database["public"]["Enums"]["medication_schedule_type"]
          start_date: string | null
          status: Database["public"]["Enums"]["medication_status"] | null
          times: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dose_text: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          schedule_type: Database["public"]["Enums"]["medication_schedule_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["medication_status"] | null
          times?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dose_text?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          schedule_type?: Database["public"]["Enums"]["medication_schedule_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["medication_status"] | null
          times?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      procedures: {
        Row: {
          created_at: string
          date: string
          doctor_id: string | null
          id: string
          institution_id: string | null
          notes: string | null
          title: string
          type: Database["public"]["Enums"]["procedure_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          doctor_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          title: string
          type: Database["public"]["Enums"]["procedure_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          doctor_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          title?: string
          type?: Database["public"]["Enums"]["procedure_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          role: Database["public"]["Enums"]["sharing_role"]
          shared_with_email: string
          shared_with_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          role?: Database["public"]["Enums"]["sharing_role"]
          shared_with_email: string
          shared_with_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          role?: Database["public"]["Enums"]["sharing_role"]
          shared_with_email?: string
          shared_with_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          id: string
          insurance_member_id: string | null
          insurance_plan: string | null
          insurance_provider: string | null
          last_name: string | null
          national_id: string | null
          notes: string | null
          notification_email: boolean | null
          notification_in_app: boolean | null
          phone: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allergies?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          insurance_member_id?: string | null
          insurance_plan?: string | null
          insurance_provider?: string | null
          last_name?: string | null
          national_id?: string | null
          notes?: string | null
          notification_email?: boolean | null
          notification_in_app?: boolean | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allergies?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          insurance_member_id?: string | null
          insurance_plan?: string | null
          insurance_provider?: string | null
          last_name?: string | null
          national_id?: string | null
          notes?: string | null
          notification_email?: boolean | null
          notification_in_app?: boolean | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          due_date_time: string
          id: string
          is_completed: boolean | null
          notes: string | null
          repeat_rule: Database["public"]["Enums"]["repeat_rule"] | null
          title: string
          type: Database["public"]["Enums"]["reminder_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          due_date_time: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          repeat_rule?: Database["public"]["Enums"]["repeat_rule"] | null
          title: string
          type?: Database["public"]["Enums"]["reminder_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          due_date_time?: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          repeat_rule?: Database["public"]["Enums"]["repeat_rule"] | null
          title?: string
          type?: Database["public"]["Enums"]["reminder_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          created_at: string | null
          date: string
          id: string
          institution_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["test_status"] | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          institution_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["test_status"] | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          institution_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["test_status"] | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_profile: {
        Args: { _profile_owner_id: string; _user_id: string }
        Returns: boolean
      }
      can_modify_data: {
        Args: { _profile_owner_id: string; _user_id: string }
        Returns: boolean
      }
      get_sharing_role: {
        Args: { _profile_owner_id: string; _user_id: string }
        Returns: string
      }
      is_data_owner: {
        Args: { _data_owner_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status: "Upcoming" | "Completed" | "Cancelled"
      entity_type: "Appointment" | "TestStudy" | "Procedure"
      institution_type: "Clinic" | "Lab" | "Hospital" | "Other"
      medication_log_status: "Taken" | "Skipped"
      medication_schedule_type: "Daily" | "Weekly" | "As needed"
      medication_status: "Active" | "Paused" | "Completed"
      procedure_type: "Surgery" | "Hospitalization" | "Vaccine"
      reminder_type:
        | "Checkup"
        | "Appointment follow-up"
        | "Test follow-up"
        | "Custom"
      repeat_rule: "None" | "Daily" | "Weekly" | "Monthly" | "Yearly"
      sharing_role: "viewer" | "contributor"
      test_status: "Scheduled" | "Done" | "Result received"
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
      appointment_status: ["Upcoming", "Completed", "Cancelled"],
      entity_type: ["Appointment", "TestStudy", "Procedure"],
      institution_type: ["Clinic", "Lab", "Hospital", "Other"],
      medication_log_status: ["Taken", "Skipped"],
      medication_schedule_type: ["Daily", "Weekly", "As needed"],
      medication_status: ["Active", "Paused", "Completed"],
      procedure_type: ["Surgery", "Hospitalization", "Vaccine"],
      reminder_type: [
        "Checkup",
        "Appointment follow-up",
        "Test follow-up",
        "Custom",
      ],
      repeat_rule: ["None", "Daily", "Weekly", "Monthly", "Yearly"],
      sharing_role: ["viewer", "contributor"],
      test_status: ["Scheduled", "Done", "Result received"],
    },
  },
} as const

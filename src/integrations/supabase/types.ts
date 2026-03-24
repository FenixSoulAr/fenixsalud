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
      admin_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string | null
          datetime_end: string | null
          datetime_start: string
          doctor_id: string | null
          id: string
          institution_id: string | null
          notes: string | null
          professional_status: Database["public"]["Enums"]["professional_status"]
          profile_id: string | null
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
          professional_status?: Database["public"]["Enums"]["professional_status"]
          profile_id?: string | null
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
          professional_status?: Database["public"]["Enums"]["professional_status"]
          profile_id?: string | null
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
          {
            foreignKeyName: "appointments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_runs: {
        Row: {
          admin_user_id: string
          created_at: string
          details_json: Json
          id: string
          profile_id: string
          totals_json: Json
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          details_json?: Json
          id?: string
          profile_id: string
          totals_json?: Json
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          details_json?: Json
          id?: string
          profile_id?: string
          totals_json?: Json
        }
        Relationships: []
      }
      diagnoses: {
        Row: {
          condition: string
          created_at: string
          diagnosed_date: string | null
          id: string
          notes: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["diagnosis_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          diagnosed_date?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["diagnosis_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          diagnosed_date?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["diagnosis_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          applicable_plan_id: string | null
          code: string
          created_at: string
          duration_type: string
          duration_value: number | null
          id: string
          is_active: boolean
          last_used_at: string | null
          max_redemptions: number | null
          redeemed_count: number
          stackable: boolean
          stripe_coupon_id: string | null
          type: string
          valid_from: string | null
          valid_to: string | null
          value: number
        }
        Insert: {
          applicable_plan_id?: string | null
          code: string
          created_at?: string
          duration_type: string
          duration_value?: number | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          max_redemptions?: number | null
          redeemed_count?: number
          stackable?: boolean
          stripe_coupon_id?: string | null
          type: string
          valid_from?: string | null
          valid_to?: string | null
          value: number
        }
        Update: {
          applicable_plan_id?: string | null
          code?: string
          created_at?: string
          duration_type?: string
          duration_value?: number | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          max_redemptions?: number | null
          redeemed_count?: number
          stackable?: boolean
          stripe_coupon_id?: string | null
          type?: string
          valid_from?: string | null
          valid_to?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_applicable_plan_id_fkey"
            columns: ["applicable_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          address: string | null
          created_at: string | null
          deactivated_at: string | null
          email: string | null
          full_name: string
          id: string
          institution_id: string | null
          is_active: boolean
          license_number: string | null
          normalized_name: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          specialty: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          license_number?: string | null
          normalized_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          license_number?: string | null
          normalized_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string
          id: string
          key: string
          plan_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          plan_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          plan_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      file_attachments: {
        Row: {
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          file_name: string
          file_url: string
          id: string
          mime_type: string | null
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_attachments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address: string | null
          created_at: string | null
          deactivated_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          type: Database["public"]["Enums"]["institution_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          type?: Database["public"]["Enums"]["institution_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          type?: Database["public"]["Enums"]["institution_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          provider: string
          status: string
          stripe_invoice_id: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: string
          status: string
          stripe_invoice_id: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: string
          status?: string
          stripe_invoice_id?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_logs: {
        Row: {
          created_at: string | null
          id: string
          medication_id: string
          profile_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["medication_log_status"] | null
          taken_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          medication_id: string
          profile_id?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["medication_log_status"] | null
          taken_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          medication_id?: string
          profile_id?: string | null
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
          {
            foreignKeyName: "medication_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string | null
          diagnosis_id: string | null
          dose_text: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          profile_id: string | null
          schedule_type: Database["public"]["Enums"]["medication_schedule_type"]
          start_date: string | null
          status: Database["public"]["Enums"]["medication_status"] | null
          times: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          diagnosis_id?: string | null
          dose_text: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          profile_id?: string | null
          schedule_type: Database["public"]["Enums"]["medication_schedule_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["medication_status"] | null
          times?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          diagnosis_id?: string | null
          dose_text?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          profile_id?: string | null
          schedule_type?: Database["public"]["Enums"]["medication_schedule_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["medication_status"] | null
          times?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_overrides: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by_email: string
          id: string
          notes: string | null
          plan_code: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by_email: string
          id?: string
          notes?: string | null
          plan_code?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by_email?: string
          id?: string
          notes?: string | null
          plan_code?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_cycle: string
          code: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          price_cents: number
          stripe_price_id: string | null
        }
        Insert: {
          billing_cycle?: string
          code: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Update: {
          billing_cycle?: string
          code?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
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
          professional_status: Database["public"]["Enums"]["professional_status"]
          profile_id: string | null
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
          professional_status?: Database["public"]["Enums"]["professional_status"]
          profile_id?: string | null
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
          professional_status?: Database["public"]["Enums"]["professional_status"]
          profile_id?: string | null
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
          {
            foreignKeyName: "procedures_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          profile_id: string
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
          profile_id: string
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
          profile_id?: string
          role?: Database["public"]["Enums"]["sharing_role"]
          shared_with_email?: string
          shared_with_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_shares_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          owner_user_id: string
          phone: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
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
          owner_user_id: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          owner_user_id?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      promo_code_redemptions: {
        Row: {
          discount_id: string
          id: string
          override_id: string | null
          redeemed_at: string
          source: string
          user_id: string
        }
        Insert: {
          discount_id: string
          id?: string
          override_id?: string | null
          redeemed_at?: string
          source?: string
          user_id: string
        }
        Update: {
          discount_id?: string
          id?: string
          override_id?: string | null
          redeemed_at?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_override_id_fkey"
            columns: ["override_id"]
            isOneToOne: false
            referencedRelation: "plan_overrides"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          first_payment_at: string | null
          id: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          reward_applied_at: string | null
          reward_discount_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          first_payment_at?: string | null
          id?: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          reward_applied_at?: string | null
          reward_discount_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          first_payment_at?: string | null
          id?: string
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_applied_at?: string | null
          reward_discount_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_reward_discount_id_fkey"
            columns: ["reward_discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          due_date_time: string
          id: string
          is_completed: boolean | null
          notes: string | null
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
          repeat_rule?: Database["public"]["Enums"]["repeat_rule"] | null
          title?: string
          type?: Database["public"]["Enums"]["reminder_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_discounts: {
        Row: {
          applied_by: string
          created_at: string
          discount_id: string
          ends_at: string | null
          id: string
          starts_at: string
          status: string
          subscription_id: string
        }
        Insert: {
          applied_by?: string
          created_at?: string
          discount_id: string
          ends_at?: string | null
          id?: string
          starts_at?: string
          status?: string
          subscription_id: string
        }
        Update: {
          applied_by?: string
          created_at?: string
          discount_id?: string
          ends_at?: string | null
          id?: string
          starts_at?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_discounts_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_discounts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          default_payment_method_last4: string | null
          id: string
          last_verified_at: string | null
          plan_id: string
          provider: string
          provider_product_id: string | null
          provider_subscription_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          default_payment_method_last4?: string | null
          id?: string
          last_verified_at?: string | null
          plan_id: string
          provider?: string
          provider_product_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          default_payment_method_last4?: string | null
          id?: string
          last_verified_at?: string | null
          plan_id?: string
          provider?: string
          provider_product_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string | null
          date: string
          doctor_id: string | null
          id: string
          institution_id: string | null
          notes: string | null
          professional_status: Database["public"]["Enums"]["professional_status"]
          profile_id: string | null
          status: Database["public"]["Enums"]["test_status"] | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          doctor_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          professional_status?: Database["public"]["Enums"]["professional_status"]
          profile_id?: string | null
          status?: Database["public"]["Enums"]["test_status"] | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          doctor_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          professional_status?: Database["public"]["Enums"]["professional_status"]
          profile_id?: string | null
          status?: Database["public"]["Enums"]["test_status"] | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      can_access_profile_by_id: {
        Args: { _profile_id: string; _user_id: string }
        Returns: boolean
      }
      can_modify_data: {
        Args: { _profile_owner_id: string; _user_id: string }
        Returns: boolean
      }
      can_modify_profile_by_id: {
        Args: { _profile_id: string; _user_id: string }
        Returns: boolean
      }
      get_admin_promo_codes: {
        Args: never
        Returns: {
          code: string
          created_at: string
          duration_type: string
          duration_value: number
          id: string
          is_active: boolean
          last_used_at: string
          max_redemptions: number
          redeemed_count: number
          stripe_coupon_id: string
          type: string
          valid_from: string
          valid_to: string
          value: number
        }[]
      }
      get_admin_user_list: {
        Args: never
        Returns: {
          effective_plan: string
          email: string
          override_created_at: string
          override_expires_at: string
          override_granted_by: string
          override_id: string
          plan_code: string
          plan_name: string
          stripe_subscription_id: string
          subscription_status: string
          user_created_at: string
          user_id: string
        }[]
      }
      get_current_user_email: { Args: never; Returns: string }
      get_my_billing_status: {
        Args: never
        Returns: {
          cancel_at_period_end: boolean
          current_period_end: string
          plan_code: string
          plan_name: string
          status: string
          user_id: string
        }[]
      }
      get_profile_for_role: { Args: { _profile_id: string }; Returns: Json }
      get_sharing_role: {
        Args: { _profile_owner_id: string; _user_id: string }
        Returns: string
      }
      has_active_override: { Args: { _user_id: string }; Returns: boolean }
      has_admin_role: { Args: { _user_id: string }; Returns: boolean }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_data_owner: {
        Args: { _data_owner_id: string; _user_id: string }
        Returns: boolean
      }
      is_profile_owner: {
        Args: { _profile_id: string; _user_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      validate_promo_code: {
        Args: { _code: string; _user_id: string }
        Returns: {
          discount_id: string
          discount_type: string
          discount_value: number
          duration_type: string
          duration_value: number
          error_message: string
          stripe_coupon_id: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      appointment_status: "Upcoming" | "Completed" | "Cancelled"
      diagnosis_status: "active" | "resolved"
      entity_type: "Appointment" | "TestStudy" | "Procedure"
      institution_type: "Clinic" | "Lab" | "Hospital" | "Other"
      medication_log_status: "Taken" | "Skipped"
      medication_schedule_type: "Daily" | "Weekly" | "As needed"
      medication_status: "Active" | "Paused" | "Completed"
      procedure_type: "Surgery" | "Hospitalization" | "Vaccine"
      professional_status:
        | "assigned"
        | "unassigned"
        | "unknown"
        | "not_recorded"
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
      diagnosis_status: ["active", "resolved"],
      entity_type: ["Appointment", "TestStudy", "Procedure"],
      institution_type: ["Clinic", "Lab", "Hospital", "Other"],
      medication_log_status: ["Taken", "Skipped"],
      medication_schedule_type: ["Daily", "Weekly", "As needed"],
      medication_status: ["Active", "Paused", "Completed"],
      procedure_type: ["Surgery", "Hospitalization", "Vaccine"],
      professional_status: [
        "assigned",
        "unassigned",
        "unknown",
        "not_recorded",
      ],
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

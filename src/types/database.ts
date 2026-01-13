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
      appliances: {
        Row: {
          buildium_appliance_id: number | null
          created_at: string
          description: string | null
          id: string
          installation_date: string | null
          is_active: boolean | null
          last_service_date: string | null
          manufacturer: string | null
          model_number: string | null
          name: string
          notes: string | null
          public_id: number
          serial_number: string | null
          type: string
          unit_id: string
          updated_at: string
          warranty_expiration_date: string | null
        }
        Insert: {
          buildium_appliance_id?: number | null
          created_at?: string
          description?: string | null
          id?: string
          installation_date?: string | null
          is_active?: boolean | null
          last_service_date?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name: string
          notes?: string | null
          public_id?: number
          serial_number?: string | null
          type: string
          unit_id: string
          updated_at: string
          warranty_expiration_date?: string | null
        }
        Update: {
          buildium_appliance_id?: number | null
          created_at?: string
          description?: string | null
          id?: string
          installation_date?: string | null
          is_active?: boolean | null
          last_service_date?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          notes?: string | null
          public_id?: number
          serial_number?: string | null
          type?: string
          unit_id?: string
          updated_at?: string
          warranty_expiration_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appliances_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_register_state: {
        Row: {
          bank_gl_account_id: string
          buildium_transaction_id: number | null
          cleared_at: string | null
          cleared_by_user_id: string | null
          created_at: string
          current_reconciliation_log_id: string | null
          org_id: string
          reconciled_at: string | null
          reconciled_by_user_id: string | null
          status: Database["public"]["Enums"]["bank_entry_status_enum"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          bank_gl_account_id: string
          buildium_transaction_id?: number | null
          cleared_at?: string | null
          cleared_by_user_id?: string | null
          created_at?: string
          current_reconciliation_log_id?: string | null
          org_id: string
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          status?: Database["public"]["Enums"]["bank_entry_status_enum"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          bank_gl_account_id?: string
          buildium_transaction_id?: number | null
          cleared_at?: string | null
          cleared_by_user_id?: string | null
          created_at?: string
          current_reconciliation_log_id?: string | null
          org_id?: string
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          status?: Database["public"]["Enums"]["bank_entry_status_enum"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_register_state_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_current_reconciliation_log_id_fkey"
            columns: ["current_reconciliation_log_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_current_reconciliation_log_id_fkey"
            columns: ["current_reconciliation_log_id"]
            isOneToOne: false
            referencedRelation: "v_reconciliation_transactions"
            referencedColumns: ["reconciliation_id"]
          },
          {
            foreignKeyName: "bank_register_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      banking_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          bank_gl_account_id: string | null
          created_at: string
          field_changes: Json | null
          id: string
          org_id: string
          reconciliation_id: string | null
          transaction_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          bank_gl_account_id?: string | null
          created_at?: string
          field_changes?: Json | null
          id?: string
          org_id: string
          reconciliation_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          bank_gl_account_id?: string | null
          created_at?: string
          field_changes?: Json | null
          id?: string
          org_id?: string
          reconciliation_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banking_audit_log_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_audit_log_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_audit_log_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "v_reconciliation_transactions"
            referencedColumns: ["reconciliation_id"]
          },
          {
            foreignKeyName: "banking_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "banking_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      bill_applications: {
        Row: {
          applied_amount: number
          applied_at: string
          bill_transaction_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          org_id: string
          source_transaction_id: string
          source_type: string
          updated_at: string
        }
        Insert: {
          applied_amount: number
          applied_at?: string
          bill_transaction_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          org_id: string
          source_transaction_id: string
          source_type: string
          updated_at?: string
        }
        Update: {
          applied_amount?: number
          applied_at?: string
          bill_transaction_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          org_id?: string
          source_transaction_id?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_applications_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_applications_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_applications_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_applications_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "bill_applications_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "bill_applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_applications_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_applications_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_applications_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_applications_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "bill_applications_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      bill_approval_audit: {
        Row: {
          action: string
          bill_transaction_id: string
          created_at: string
          from_state: Database["public"]["Enums"]["approval_state_enum"] | null
          id: string
          notes: string | null
          to_state: Database["public"]["Enums"]["approval_state_enum"] | null
          user_id: string | null
        }
        Insert: {
          action: string
          bill_transaction_id: string
          created_at?: string
          from_state?: Database["public"]["Enums"]["approval_state_enum"] | null
          id?: string
          notes?: string | null
          to_state?: Database["public"]["Enums"]["approval_state_enum"] | null
          user_id?: string | null
        }
        Update: {
          action?: string
          bill_transaction_id?: string
          created_at?: string
          from_state?: Database["public"]["Enums"]["approval_state_enum"] | null
          id?: string
          notes?: string | null
          to_state?: Database["public"]["Enums"]["approval_state_enum"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_approval_audit_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_approval_audit_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_approval_audit_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_approval_audit_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "bill_approval_audit_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      bill_categories: {
        Row: {
          buildium_category_id: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          public_id: number
          updated_at: string | null
        }
        Insert: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          public_id?: number
          updated_at?: string | null
        }
        Update: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          public_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      bill_workflow: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state_enum"]
          approved_at: string | null
          approved_by_user_id: string | null
          bill_transaction_id: string
          created_at: string
          org_id: string
          rejected_at: string | null
          rejected_by_user_id: string | null
          rejection_reason: string | null
          reversal_transaction_id: string | null
          submitted_at: string | null
          submitted_by_user_id: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_user_id: string | null
        }
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state_enum"]
          approved_at?: string | null
          approved_by_user_id?: string | null
          bill_transaction_id: string
          created_at?: string
          org_id: string
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          reversal_transaction_id?: string | null
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_user_id?: string | null
        }
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state_enum"]
          approved_at?: string | null
          approved_by_user_id?: string | null
          bill_transaction_id?: string
          created_at?: string
          org_id?: string
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          reversal_transaction_id?: string | null
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_workflow_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_workflow_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_workflow_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_workflow_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "bill_workflow_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "bill_workflow_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_workflow_reversal_transaction_id_fkey"
            columns: ["reversal_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_workflow_reversal_transaction_id_fkey"
            columns: ["reversal_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_workflow_reversal_transaction_id_fkey"
            columns: ["reversal_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_workflow_reversal_transaction_id_fkey"
            columns: ["reversal_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "bill_workflow_reversal_transaction_id_fkey"
            columns: ["reversal_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount: number
          assignment_id: string | null
          calculated_at: string | null
          charge_type: string | null
          created_at: string | null
          id: string
          invoiced_at: string | null
          offering_id: string | null
          org_id: string
          period_end: string
          period_start: string
          plan_id: Database["public"]["Enums"]["service_plan_enum"] | null
          property_id: string | null
          public_id: number
          rent_amount: number | null
          rent_basis: Database["public"]["Enums"]["rent_basis_enum"] | null
          service_period_end: string | null
          service_period_start: string | null
          source_basis: Database["public"]["Enums"]["billing_basis_enum"]
          transaction_id: string | null
          unit_id: string | null
        }
        Insert: {
          amount: number
          assignment_id?: string | null
          calculated_at?: string | null
          charge_type?: string | null
          created_at?: string | null
          id?: string
          invoiced_at?: string | null
          offering_id?: string | null
          org_id: string
          period_end: string
          period_start: string
          plan_id?: Database["public"]["Enums"]["service_plan_enum"] | null
          property_id?: string | null
          public_id?: number
          rent_amount?: number | null
          rent_basis?: Database["public"]["Enums"]["rent_basis_enum"] | null
          service_period_end?: string | null
          service_period_start?: string | null
          source_basis: Database["public"]["Enums"]["billing_basis_enum"]
          transaction_id?: string | null
          unit_id?: string | null
        }
        Update: {
          amount?: number
          assignment_id?: string | null
          calculated_at?: string | null
          charge_type?: string | null
          created_at?: string | null
          id?: string
          invoiced_at?: string | null
          offering_id?: string | null
          org_id?: string
          period_end?: string
          period_start?: string
          plan_id?: Database["public"]["Enums"]["service_plan_enum"] | null
          property_id?: string | null
          public_id?: number
          rent_amount?: number | null
          rent_basis?: Database["public"]["Enums"]["rent_basis_enum"] | null
          service_period_end?: string | null
          service_period_start?: string | null
          source_basis?: Database["public"]["Enums"]["billing_basis_enum"]
          transaction_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "service_plan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "billing_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "billing_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "billing_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      building_permits: {
        Row: {
          act_as_superintendent: string | null
          applicant_business_address: string | null
          applicant_business_name: string | null
          applicant_license: string | null
          approved_date: string | null
          apt_condo_no_s: string | null
          bbl: string | null
          bin: string | null
          bldg_type: string | null
          block: string | null
          borough: string | null
          building_id: string | null
          c_b_no: string | null
          census_tract: number | null
          community_board: number | null
          council_district: number | null
          created_at: string
          dataset_id: string
          dataset_run_date: string | null
          estimated_job_costs: string | null
          expiration_date: string | null
          expired_date: string | null
          filing_date: string | null
          filing_reason: string | null
          filing_representative_business_name: string | null
          filing_status: string | null
          hic_license: string | null
          house_no: string | null
          id: string
          issuance_date: string | null
          issued_date: string | null
          job_description: string | null
          job_doc_number: string | null
          job_filing_number: string
          job_number: string | null
          job_start_date: string | null
          job_type: string | null
          latitude: number | null
          longitude: number | null
          lot: string | null
          metadata: Json
          non_profit: string | null
          nta: string | null
          oil_gas: string | null
          org_id: string
          owner_business_name: string | null
          owner_business_type: string | null
          owner_city: string | null
          owner_first_name: string | null
          owner_house_city: string | null
          owner_house_number: string | null
          owner_house_phone: string | null
          owner_house_state: string | null
          owner_house_street_name: string | null
          owner_house_zip_code: string | null
          owner_last_name: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_state: string | null
          owner_street_address: string | null
          owner_zip_code: string | null
          permit_sequence: string | null
          permit_sequence_number: string | null
          permit_si_no: string | null
          permit_status: string | null
          permit_subtype: string | null
          permit_type: string | null
          permittee_business_name: string | null
          permittee_first_name: string | null
          permittee_last_name: string | null
          permittee_license_number: string | null
          permittee_license_type: string | null
          permittee_other_title: string | null
          permittee_phone: string | null
          property_id: string | null
          public_id: number
          residential: string | null
          self_cert: string | null
          sequence_number: string | null
          site_fill: string | null
          site_safety_mgr_business_name: string | null
          site_safety_mgr_first_name: string | null
          site_safety_mgr_last_name: string | null
          source: string
          source_record_id: string | null
          special_district_1: string | null
          special_district_2: string | null
          street_name: string | null
          superintendent_business_name: string | null
          superintendent_name: string | null
          tracking_number: string | null
          updated_at: string
          work_on_floor: string | null
          work_permit: string | null
          work_type: string | null
          zip_code: string | null
        }
        Insert: {
          act_as_superintendent?: string | null
          applicant_business_address?: string | null
          applicant_business_name?: string | null
          applicant_license?: string | null
          approved_date?: string | null
          apt_condo_no_s?: string | null
          bbl?: string | null
          bin?: string | null
          bldg_type?: string | null
          block?: string | null
          borough?: string | null
          building_id?: string | null
          c_b_no?: string | null
          census_tract?: number | null
          community_board?: number | null
          council_district?: number | null
          created_at?: string
          dataset_id?: string
          dataset_run_date?: string | null
          estimated_job_costs?: string | null
          expiration_date?: string | null
          expired_date?: string | null
          filing_date?: string | null
          filing_reason?: string | null
          filing_representative_business_name?: string | null
          filing_status?: string | null
          hic_license?: string | null
          house_no?: string | null
          id?: string
          issuance_date?: string | null
          issued_date?: string | null
          job_description?: string | null
          job_doc_number?: string | null
          job_filing_number: string
          job_number?: string | null
          job_start_date?: string | null
          job_type?: string | null
          latitude?: number | null
          longitude?: number | null
          lot?: string | null
          metadata?: Json
          non_profit?: string | null
          nta?: string | null
          oil_gas?: string | null
          org_id: string
          owner_business_name?: string | null
          owner_business_type?: string | null
          owner_city?: string | null
          owner_first_name?: string | null
          owner_house_city?: string | null
          owner_house_number?: string | null
          owner_house_phone?: string | null
          owner_house_state?: string | null
          owner_house_street_name?: string | null
          owner_house_zip_code?: string | null
          owner_last_name?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_state?: string | null
          owner_street_address?: string | null
          owner_zip_code?: string | null
          permit_sequence?: string | null
          permit_sequence_number?: string | null
          permit_si_no?: string | null
          permit_status?: string | null
          permit_subtype?: string | null
          permit_type?: string | null
          permittee_business_name?: string | null
          permittee_first_name?: string | null
          permittee_last_name?: string | null
          permittee_license_number?: string | null
          permittee_license_type?: string | null
          permittee_other_title?: string | null
          permittee_phone?: string | null
          property_id?: string | null
          public_id?: number
          residential?: string | null
          self_cert?: string | null
          sequence_number?: string | null
          site_fill?: string | null
          site_safety_mgr_business_name?: string | null
          site_safety_mgr_first_name?: string | null
          site_safety_mgr_last_name?: string | null
          source?: string
          source_record_id?: string | null
          special_district_1?: string | null
          special_district_2?: string | null
          street_name?: string | null
          superintendent_business_name?: string | null
          superintendent_name?: string | null
          tracking_number?: string | null
          updated_at?: string
          work_on_floor?: string | null
          work_permit?: string | null
          work_type?: string | null
          zip_code?: string | null
        }
        Update: {
          act_as_superintendent?: string | null
          applicant_business_address?: string | null
          applicant_business_name?: string | null
          applicant_license?: string | null
          approved_date?: string | null
          apt_condo_no_s?: string | null
          bbl?: string | null
          bin?: string | null
          bldg_type?: string | null
          block?: string | null
          borough?: string | null
          building_id?: string | null
          c_b_no?: string | null
          census_tract?: number | null
          community_board?: number | null
          council_district?: number | null
          created_at?: string
          dataset_id?: string
          dataset_run_date?: string | null
          estimated_job_costs?: string | null
          expiration_date?: string | null
          expired_date?: string | null
          filing_date?: string | null
          filing_reason?: string | null
          filing_representative_business_name?: string | null
          filing_status?: string | null
          hic_license?: string | null
          house_no?: string | null
          id?: string
          issuance_date?: string | null
          issued_date?: string | null
          job_description?: string | null
          job_doc_number?: string | null
          job_filing_number?: string
          job_number?: string | null
          job_start_date?: string | null
          job_type?: string | null
          latitude?: number | null
          longitude?: number | null
          lot?: string | null
          metadata?: Json
          non_profit?: string | null
          nta?: string | null
          oil_gas?: string | null
          org_id?: string
          owner_business_name?: string | null
          owner_business_type?: string | null
          owner_city?: string | null
          owner_first_name?: string | null
          owner_house_city?: string | null
          owner_house_number?: string | null
          owner_house_phone?: string | null
          owner_house_state?: string | null
          owner_house_street_name?: string | null
          owner_house_zip_code?: string | null
          owner_last_name?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_state?: string | null
          owner_street_address?: string | null
          owner_zip_code?: string | null
          permit_sequence?: string | null
          permit_sequence_number?: string | null
          permit_si_no?: string | null
          permit_status?: string | null
          permit_subtype?: string | null
          permit_type?: string | null
          permittee_business_name?: string | null
          permittee_first_name?: string | null
          permittee_last_name?: string | null
          permittee_license_number?: string | null
          permittee_license_type?: string | null
          permittee_other_title?: string | null
          permittee_phone?: string | null
          property_id?: string | null
          public_id?: number
          residential?: string | null
          self_cert?: string | null
          sequence_number?: string | null
          site_fill?: string | null
          site_safety_mgr_business_name?: string | null
          site_safety_mgr_first_name?: string | null
          site_safety_mgr_last_name?: string | null
          source?: string
          source_record_id?: string | null
          special_district_1?: string | null
          special_district_2?: string | null
          street_name?: string | null
          superintendent_business_name?: string | null
          superintendent_name?: string | null
          tracking_number?: string | null
          updated_at?: string
          work_on_floor?: string | null
          work_permit?: string | null
          work_type?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_permits_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_permits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_permits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_permits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      buildings: {
        Row: {
          bbl: string | null
          bin: string | null
          borough: string | null
          borough_code: string | null
          city: string | null
          condo_num: string | null
          coop_num: string | null
          country: string | null
          created_at: string
          ease_digit: string | null
          enrichment_errors: Json
          geoservice: Json | null
          geoservice_response_at: string | null
          heat_sensor_program: boolean
          house_number: string | null
          hpd: Json | null
          hpd_building: Json | null
          hpd_registration: Json | null
          hpd_registration_response_at: string | null
          hpd_response_at: string | null
          id: string
          is_one_two_family: boolean | null
          is_private_residence_building: boolean | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          normalized_address_key: string | null
          nta: Json | null
          nta_code: string | null
          nta_name: string | null
          nta_response_at: string | null
          occupancy_description: string | null
          occupancy_group: string | null
          parid: string | null
          pluto: Json | null
          pluto_response_at: string | null
          public_id: number
          raw_address: string | null
          residential_units: number | null
          state: string | null
          street_name: string | null
          street_name_normalized: string | null
          tax_block: string | null
          tax_lot: string | null
          tax_map: string | null
          tax_section: string | null
          tax_volume: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          bbl?: string | null
          bin?: string | null
          borough?: string | null
          borough_code?: string | null
          city?: string | null
          condo_num?: string | null
          coop_num?: string | null
          country?: string | null
          created_at?: string
          ease_digit?: string | null
          enrichment_errors?: Json
          geoservice?: Json | null
          geoservice_response_at?: string | null
          heat_sensor_program?: boolean
          house_number?: string | null
          hpd?: Json | null
          hpd_building?: Json | null
          hpd_registration?: Json | null
          hpd_registration_response_at?: string | null
          hpd_response_at?: string | null
          id?: string
          is_one_two_family?: boolean | null
          is_private_residence_building?: boolean | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          normalized_address_key?: string | null
          nta?: Json | null
          nta_code?: string | null
          nta_name?: string | null
          nta_response_at?: string | null
          occupancy_description?: string | null
          occupancy_group?: string | null
          parid?: string | null
          pluto?: Json | null
          pluto_response_at?: string | null
          public_id?: number
          raw_address?: string | null
          residential_units?: number | null
          state?: string | null
          street_name?: string | null
          street_name_normalized?: string | null
          tax_block?: string | null
          tax_lot?: string | null
          tax_map?: string | null
          tax_section?: string | null
          tax_volume?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          bbl?: string | null
          bin?: string | null
          borough?: string | null
          borough_code?: string | null
          city?: string | null
          condo_num?: string | null
          coop_num?: string | null
          country?: string | null
          created_at?: string
          ease_digit?: string | null
          enrichment_errors?: Json
          geoservice?: Json | null
          geoservice_response_at?: string | null
          heat_sensor_program?: boolean
          house_number?: string | null
          hpd?: Json | null
          hpd_building?: Json | null
          hpd_registration?: Json | null
          hpd_registration_response_at?: string | null
          hpd_response_at?: string | null
          id?: string
          is_one_two_family?: boolean | null
          is_private_residence_building?: boolean | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          normalized_address_key?: string | null
          nta?: Json | null
          nta_code?: string | null
          nta_name?: string | null
          nta_response_at?: string | null
          occupancy_description?: string | null
          occupancy_group?: string | null
          parid?: string | null
          pluto?: Json | null
          pluto_response_at?: string | null
          public_id?: number
          raw_address?: string | null
          residential_units?: number | null
          state?: string | null
          street_name?: string | null
          street_name_normalized?: string | null
          tax_block?: string | null
          tax_lot?: string | null
          tax_map?: string | null
          tax_section?: string | null
          tax_volume?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      buildium_api_log: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          id: string
          method: string
          public_id: number
          request_data: Json | null
          response_data: Json | null
          response_status: number | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          method: string
          public_id?: number
          request_data?: Json | null
          response_data?: Json | null
          response_status?: number | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          method?: string
          public_id?: number
          request_data?: Json | null
          response_data?: Json | null
          response_status?: number | null
        }
        Relationships: []
      }
      buildium_failure_codes: {
        Row: {
          description: string | null
          failure_category: string | null
          normalized_code: string
          raw_code: string
        }
        Insert: {
          description?: string | null
          failure_category?: string | null
          normalized_code: string
          raw_code: string
        }
        Update: {
          description?: string | null
          failure_category?: string | null
          normalized_code?: string
          raw_code?: string
        }
        Relationships: []
      }
      buildium_integration_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          field_changes: Json | null
          id: string
          org_id: string
          public_id: number
          test_result: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          field_changes?: Json | null
          id?: string
          org_id: string
          public_id?: number
          test_result?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          field_changes?: Json | null
          id?: string
          org_id?: string
          public_id?: number
          test_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildium_integration_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buildium_integrations: {
        Row: {
          base_url: string
          client_id_encrypted: string
          client_secret_encrypted: string
          created_at: string
          disabled_at: string | null
          deleted_at: string | null
          config_version: number
          id: string
          is_enabled: boolean
          last_tested_at: string | null
          org_id: string
          public_id: number
          updated_at: string
          webhook_secret_encrypted: string
          webhook_secret_rotated_at: string | null
        }
        Insert: {
          base_url: string
          client_id_encrypted: string
          client_secret_encrypted: string
          created_at?: string
          disabled_at?: string | null
          deleted_at?: string | null
          config_version?: number
          id?: string
          is_enabled?: boolean
          last_tested_at?: string | null
          org_id: string
          public_id?: number
          updated_at?: string
          webhook_secret_encrypted: string
          webhook_secret_rotated_at?: string | null
        }
        Update: {
          base_url?: string
          client_id_encrypted?: string
          client_secret_encrypted?: string
          created_at?: string
          disabled_at?: string | null
          deleted_at?: string | null
          config_version?: number
          id?: string
          is_enabled?: boolean
          last_tested_at?: string | null
          org_id?: string
          public_id?: number
          updated_at?: string
          webhook_secret_encrypted?: string
          webhook_secret_rotated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildium_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buildium_sync_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_count: number | null
          errors: Json | null
          finished_at: string | null
          id: string
          job_type: string
          linked_count: number | null
          org_id: string | null
          public_id: number
          scanned_count: number | null
          started_at: string
          status: string
          upserted_count: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          job_type?: string
          linked_count?: number | null
          org_id?: string | null
          public_id?: number
          scanned_count?: number | null
          started_at?: string
          status?: string
          upserted_count?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          job_type?: string
          linked_count?: number | null
          org_id?: string | null
          public_id?: number
          scanned_count?: number | null
          started_at?: string
          status?: string
          upserted_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buildium_sync_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buildium_sync_status: {
        Row: {
          buildium_id: number | null
          created_at: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          last_synced_at: string | null
          org_id: string | null
          public_id: number
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          buildium_id?: number | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          org_id?: string | null
          public_id?: number
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          buildium_id?: number | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          org_id?: string | null
          public_id?: number
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildium_sync_status_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buildium_webhook_events: {
        Row: {
          buildium_webhook_id: string
          created_at: string | null
          error: string | null
          error_message: string | null
          event_created_at: string
          event_data: Json
          event_entity_id: string
          event_id: string | null
          event_name: string
          event_type: string
          id: string
          max_retries: number | null
          org_id: string | null
          payload: Json | null
          processed: boolean
          processed_at: string | null
          public_id: number
          received_at: string | null
          retry_count: number | null
          signature: string | null
          status: string | null
          updated_at: string | null
          webhook_type: string | null
        }
        Insert: {
          buildium_webhook_id: string
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          event_created_at: string
          event_data: Json
          event_entity_id: string
          event_id?: string | null
          event_name: string
          event_type: string
          id?: string
          max_retries?: number | null
          org_id?: string | null
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          public_id?: number
          received_at?: string | null
          retry_count?: number | null
          signature?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_type?: string | null
        }
        Update: {
          buildium_webhook_id?: string
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          event_created_at?: string
          event_data?: Json
          event_entity_id?: string
          event_id?: string | null
          event_name?: string
          event_type?: string
          id?: string
          max_retries?: number | null
          org_id?: string | null
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          public_id?: number
          received_at?: string | null
          retry_count?: number | null
          signature?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildium_webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_schedules: {
        Row: {
          amount: number
          charge_type: Database["public"]["Enums"]["charge_type_enum"]
          created_at: string
          description: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["rent_cycle_enum"]
          gl_account_id: string
          id: string
          is_active: boolean | null
          lease_id: number
          max_occurrences: number | null
          org_id: string
          start_date: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          charge_type: Database["public"]["Enums"]["charge_type_enum"]
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency: Database["public"]["Enums"]["rent_cycle_enum"]
          gl_account_id: string
          id?: string
          is_active?: boolean | null
          lease_id: number
          max_occurrences?: number | null
          org_id: string
          start_date: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_type?: Database["public"]["Enums"]["charge_type_enum"]
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["rent_cycle_enum"]
          gl_account_id?: string
          id?: string
          is_active?: boolean | null
          lease_id?: number
          max_occurrences?: number | null
          org_id?: string
          start_date?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_schedules_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_schedules_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_telemetry_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event: string
          lease_id: number | null
          org_id: string | null
          prefills: Json | null
          source: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event: string
          lease_id?: number | null
          org_id?: string | null
          prefills?: Json | null
          source?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event?: string
          lease_id?: number | null
          org_id?: string | null
          prefills?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      charges: {
        Row: {
          amount: number
          amount_open: number
          base_amount: number | null
          buildium_charge_id: number | null
          charge_schedule_id: string | null
          charge_type: Database["public"]["Enums"]["charge_type_enum"]
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          external_id: string | null
          id: string
          is_prorated: boolean | null
          lease_id: number
          org_id: string
          paid_amount: number | null
          parent_charge_id: string | null
          proration_days: number | null
          source: string | null
          status: Database["public"]["Enums"]["charge_status_enum"]
          transaction_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          amount_open: number
          base_amount?: number | null
          buildium_charge_id?: number | null
          charge_schedule_id?: string | null
          charge_type: Database["public"]["Enums"]["charge_type_enum"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          external_id?: string | null
          id?: string
          is_prorated?: boolean | null
          lease_id: number
          org_id: string
          paid_amount?: number | null
          parent_charge_id?: string | null
          proration_days?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["charge_status_enum"]
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          amount_open?: number
          base_amount?: number | null
          buildium_charge_id?: number | null
          charge_schedule_id?: string | null
          charge_type?: Database["public"]["Enums"]["charge_type_enum"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          external_id?: string | null
          id?: string
          is_prorated?: boolean | null
          lease_id?: number
          org_id?: string
          paid_amount?: number | null
          parent_charge_id?: string | null
          proration_days?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["charge_status_enum"]
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_charge_schedule_id_fkey"
            columns: ["charge_schedule_id"]
            isOneToOne: false
            referencedRelation: "charge_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_parent_charge_id_fkey"
            columns: ["parent_charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      compliance_assets: {
        Row: {
          active: boolean
          asset_type: Database["public"]["Enums"]["compliance_asset_type"]
          created_at: string
          device_category: string | null
          device_subtype: string | null
          device_technology: string | null
          external_source: string | null
          external_source_id: string | null
          id: string
          is_private_residence: boolean | null
          location_notes: string | null
          metadata: Json | null
          name: string
          org_id: string
          property_id: string
          public_id: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_type: Database["public"]["Enums"]["compliance_asset_type"]
          created_at?: string
          device_category?: string | null
          device_subtype?: string | null
          device_technology?: string | null
          external_source?: string | null
          external_source_id?: string | null
          id?: string
          is_private_residence?: boolean | null
          location_notes?: string | null
          metadata?: Json | null
          name: string
          org_id: string
          property_id: string
          public_id?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_type?: Database["public"]["Enums"]["compliance_asset_type"]
          created_at?: string
          device_category?: string | null
          device_subtype?: string | null
          device_technology?: string | null
          external_source?: string | null
          external_source_id?: string | null
          id?: string
          is_private_residence?: boolean | null
          location_notes?: string | null
          metadata?: Json | null
          name?: string
          org_id?: string
          property_id?: string
          public_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_events: {
        Row: {
          asset_id: string | null
          compliance_status: string | null
          created_at: string
          defects: boolean
          event_type: Database["public"]["Enums"]["compliance_event_type"]
          external_tracking_number: string | null
          filed_date: string | null
          id: string
          inspection_date: string | null
          inspection_type: string | null
          inspector_company: string | null
          inspector_name: string | null
          item_id: string | null
          org_id: string
          property_id: string
          public_id: number
          raw_source: Json | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          compliance_status?: string | null
          created_at?: string
          defects?: boolean
          event_type: Database["public"]["Enums"]["compliance_event_type"]
          external_tracking_number?: string | null
          filed_date?: string | null
          id?: string
          inspection_date?: string | null
          inspection_type?: string | null
          inspector_company?: string | null
          inspector_name?: string | null
          item_id?: string | null
          org_id: string
          property_id: string
          public_id?: number
          raw_source?: Json | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          compliance_status?: string | null
          created_at?: string
          defects?: boolean
          event_type?: Database["public"]["Enums"]["compliance_event_type"]
          external_tracking_number?: string | null
          filed_date?: string | null
          id?: string
          inspection_date?: string | null
          inspection_type?: string | null
          inspector_company?: string | null
          inspector_name?: string | null
          item_id?: string | null
          org_id?: string
          property_id?: string
          public_id?: number
          raw_source?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "compliance_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_item_work_orders: {
        Row: {
          created_at: string
          id: string
          item_id: string
          org_id: string
          public_id: number
          role: Database["public"]["Enums"]["compliance_work_order_role"]
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          org_id: string
          public_id?: number
          role?: Database["public"]["Enums"]["compliance_work_order_role"]
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          org_id?: string
          public_id?: number
          role?: Database["public"]["Enums"]["compliance_work_order_role"]
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_item_work_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_item_work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_item_work_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_active_work_orders_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_item_work_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_items: {
        Row: {
          asset_id: string | null
          created_at: string
          defect_flag: boolean
          due_date: string
          external_tracking_number: string | null
          id: string
          next_action: string | null
          notes: string | null
          org_id: string
          period_end: string
          period_start: string
          primary_work_order_id: string | null
          program_id: string
          property_id: string
          public_id: number
          result: string | null
          source: Database["public"]["Enums"]["compliance_item_source"]
          status: Database["public"]["Enums"]["compliance_item_status"]
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          defect_flag?: boolean
          due_date: string
          external_tracking_number?: string | null
          id?: string
          next_action?: string | null
          notes?: string | null
          org_id: string
          period_end: string
          period_start: string
          primary_work_order_id?: string | null
          program_id: string
          property_id: string
          public_id?: number
          result?: string | null
          source?: Database["public"]["Enums"]["compliance_item_source"]
          status?: Database["public"]["Enums"]["compliance_item_status"]
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          defect_flag?: boolean
          due_date?: string
          external_tracking_number?: string | null
          id?: string
          next_action?: string | null
          notes?: string | null
          org_id?: string
          period_end?: string
          period_start?: string
          primary_work_order_id?: string | null
          program_id?: string
          property_id?: string
          public_id?: number
          result?: string | null
          source?: Database["public"]["Enums"]["compliance_item_source"]
          status?: Database["public"]["Enums"]["compliance_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "compliance_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_primary_work_order_id_fkey"
            columns: ["primary_work_order_id"]
            isOneToOne: false
            referencedRelation: "v_active_work_orders_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_primary_work_order_id_fkey"
            columns: ["primary_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "compliance_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_program_templates: {
        Row: {
          applies_to: Database["public"]["Enums"]["compliance_applies_to"]
          code: string
          created_at: string
          criteria: Json | null
          frequency_months: number
          id: string
          is_active: boolean
          jurisdiction: Database["public"]["Enums"]["compliance_jurisdiction"]
          lead_time_days: number
          name: string
          notes: string | null
          public_id: number
          severity_score: number
          updated_at: string
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["compliance_applies_to"]
          code: string
          created_at?: string
          criteria?: Json | null
          frequency_months: number
          id?: string
          is_active?: boolean
          jurisdiction: Database["public"]["Enums"]["compliance_jurisdiction"]
          lead_time_days?: number
          name: string
          notes?: string | null
          public_id?: number
          severity_score: number
          updated_at?: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["compliance_applies_to"]
          code?: string
          created_at?: string
          criteria?: Json | null
          frequency_months?: number
          id?: string
          is_active?: boolean
          jurisdiction?: Database["public"]["Enums"]["compliance_jurisdiction"]
          lead_time_days?: number
          name?: string
          notes?: string | null
          public_id?: number
          severity_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      compliance_programs: {
        Row: {
          applies_to: Database["public"]["Enums"]["compliance_applies_to"]
          code: string
          created_at: string
          criteria: Json | null
          frequency_months: number
          id: string
          is_enabled: boolean
          jurisdiction: Database["public"]["Enums"]["compliance_jurisdiction"]
          lead_time_days: number
          name: string
          notes: string | null
          org_id: string
          override_fields: Json | null
          public_id: number
          severity_score: number
          template_id: string | null
          updated_at: string
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["compliance_applies_to"]
          code: string
          created_at?: string
          criteria?: Json | null
          frequency_months: number
          id?: string
          is_enabled?: boolean
          jurisdiction: Database["public"]["Enums"]["compliance_jurisdiction"]
          lead_time_days?: number
          name: string
          notes?: string | null
          org_id: string
          override_fields?: Json | null
          public_id?: number
          severity_score: number
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["compliance_applies_to"]
          code?: string
          created_at?: string
          criteria?: Json | null
          frequency_months?: number
          id?: string
          is_enabled?: boolean
          jurisdiction?: Database["public"]["Enums"]["compliance_jurisdiction"]
          lead_time_days?: number
          name?: string
          notes?: string | null
          org_id?: string
          override_fields?: Json | null
          public_id?: number
          severity_score?: number
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_programs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "compliance_program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_property_program_overrides: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string
          id: string
          is_assigned: boolean
          is_enabled: boolean | null
          org_id: string
          program_id: string
          property_id: string
          public_id: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_assigned?: boolean
          is_enabled?: boolean | null
          org_id: string
          program_id: string
          property_id: string
          public_id?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_assigned?: boolean
          is_enabled?: boolean | null
          org_id?: string
          program_id?: string
          property_id?: string
          public_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_property_program_overrides_org_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_property_program_overrides_program_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "compliance_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_property_program_overrides_property_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_property_program_overrides_property_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      compliance_violations: {
        Row: {
          agency: Database["public"]["Enums"]["compliance_violation_agency"]
          asset_id: string | null
          category: Database["public"]["Enums"]["compliance_violation_category"]
          cleared_date: string | null
          created_at: string
          cure_by_date: string | null
          description: string
          id: string
          issue_date: string
          linked_item_id: string | null
          linked_work_order_id: string | null
          metadata: Json | null
          org_id: string
          property_id: string
          public_id: number
          severity_score: number | null
          status: Database["public"]["Enums"]["compliance_violation_status"]
          updated_at: string
          violation_number: string
        }
        Insert: {
          agency: Database["public"]["Enums"]["compliance_violation_agency"]
          asset_id?: string | null
          category?: Database["public"]["Enums"]["compliance_violation_category"]
          cleared_date?: string | null
          created_at?: string
          cure_by_date?: string | null
          description: string
          id?: string
          issue_date: string
          linked_item_id?: string | null
          linked_work_order_id?: string | null
          metadata?: Json | null
          org_id: string
          property_id: string
          public_id?: number
          severity_score?: number | null
          status?: Database["public"]["Enums"]["compliance_violation_status"]
          updated_at?: string
          violation_number: string
        }
        Update: {
          agency?: Database["public"]["Enums"]["compliance_violation_agency"]
          asset_id?: string | null
          category?: Database["public"]["Enums"]["compliance_violation_category"]
          cleared_date?: string | null
          created_at?: string
          cure_by_date?: string | null
          description?: string
          id?: string
          issue_date?: string
          linked_item_id?: string | null
          linked_work_order_id?: string | null
          metadata?: Json | null
          org_id?: string
          property_id?: string
          public_id?: number
          severity_score?: number | null
          status?: Database["public"]["Enums"]["compliance_violation_status"]
          updated_at?: string
          violation_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_violations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "compliance_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_linked_item_id_fkey"
            columns: ["linked_item_id"]
            isOneToOne: false
            referencedRelation: "compliance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_linked_work_order_id_fkey"
            columns: ["linked_work_order_id"]
            isOneToOne: false
            referencedRelation: "v_active_work_orders_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_linked_work_order_id_fkey"
            columns: ["linked_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      contacts: {
        Row: {
          alt_address_line_1: string | null
          alt_address_line_2: string | null
          alt_address_line_3: string | null
          alt_city: string | null
          alt_country: Database["public"]["Enums"]["countries"] | null
          alt_email: string | null
          alt_phone: string | null
          alt_postal_code: string | null
          alt_state: string | null
          buildium_contact_id: number | null
          company_name: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          id: number
          is_company: boolean
          last_name: string | null
          mailing_preference: string | null
          primary_address_line_1: string | null
          primary_address_line_2: string | null
          primary_address_line_3: string | null
          primary_city: string | null
          primary_country: Database["public"]["Enums"]["countries"] | null
          primary_email: string | null
          primary_phone: string | null
          primary_postal_code: string | null
          primary_state: string | null
          public_id: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alt_address_line_1?: string | null
          alt_address_line_2?: string | null
          alt_address_line_3?: string | null
          alt_city?: string | null
          alt_country?: Database["public"]["Enums"]["countries"] | null
          alt_email?: string | null
          alt_phone?: string | null
          alt_postal_code?: string | null
          alt_state?: string | null
          buildium_contact_id?: number | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: number
          is_company?: boolean
          last_name?: string | null
          mailing_preference?: string | null
          primary_address_line_1?: string | null
          primary_address_line_2?: string | null
          primary_address_line_3?: string | null
          primary_city?: string | null
          primary_country?: Database["public"]["Enums"]["countries"] | null
          primary_email?: string | null
          primary_phone?: string | null
          primary_postal_code?: string | null
          primary_state?: string | null
          public_id?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alt_address_line_1?: string | null
          alt_address_line_2?: string | null
          alt_address_line_3?: string | null
          alt_city?: string | null
          alt_country?: Database["public"]["Enums"]["countries"] | null
          alt_email?: string | null
          alt_phone?: string | null
          alt_postal_code?: string | null
          alt_state?: string | null
          buildium_contact_id?: number | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: number
          is_company?: boolean
          last_name?: string | null
          mailing_preference?: string | null
          primary_address_line_1?: string | null
          primary_address_line_2?: string | null
          primary_address_line_3?: string | null
          primary_city?: string | null
          primary_country?: Database["public"]["Enums"]["countries"] | null
          primary_email?: string | null
          primary_phone?: string | null
          primary_postal_code?: string | null
          primary_state?: string | null
          public_id?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          created_at: string
          dataset_id: string
          deleted_at: string | null
          description: string | null
          id: string
          is_enabled: boolean
          key: string
          public_id: number
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          public_id?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          public_id?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deposit_items: {
        Row: {
          amount: number
          buildium_payment_transaction_id: number | null
          created_at: string
          deposit_transaction_id: string
          id: string
          payment_transaction_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          buildium_payment_transaction_id?: number | null
          created_at?: string
          deposit_transaction_id: string
          id?: string
          payment_transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buildium_payment_transaction_id?: number | null
          created_at?: string
          deposit_transaction_id?: string
          id?: string
          payment_transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_items_deposit_transaction_id_fkey"
            columns: ["deposit_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_items_deposit_transaction_id_fkey"
            columns: ["deposit_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_items_deposit_transaction_id_fkey"
            columns: ["deposit_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_items_deposit_transaction_id_fkey"
            columns: ["deposit_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "deposit_items_deposit_transaction_id_fkey"
            columns: ["deposit_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "deposit_items_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_items_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_items_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_items_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "deposit_items_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: true
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      deposit_meta: {
        Row: {
          buildium_deposit_id: number | null
          buildium_last_synced_at: string | null
          buildium_sync_error: string | null
          buildium_sync_status: string | null
          created_at: string
          created_by: string | null
          deposit_id: string
          id: string
          org_id: string
          status: Database["public"]["Enums"]["deposit_status_enum"]
          transaction_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          buildium_deposit_id?: number | null
          buildium_last_synced_at?: string | null
          buildium_sync_error?: string | null
          buildium_sync_status?: string | null
          created_at?: string
          created_by?: string | null
          deposit_id: string
          id?: string
          org_id: string
          status?: Database["public"]["Enums"]["deposit_status_enum"]
          transaction_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          buildium_deposit_id?: number | null
          buildium_last_synced_at?: string | null
          buildium_sync_error?: string | null
          buildium_sync_status?: string | null
          created_at?: string
          created_by?: string | null
          deposit_id?: string
          id?: string
          org_id?: string
          status?: Database["public"]["Enums"]["deposit_status_enum"]
          transaction_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_meta_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_meta_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_meta_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_meta_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_meta_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "deposit_meta_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      deposit_migration_marker: {
        Row: {
          completed_at: string
          id: string
          migration_name: string
          rows_processed: number
        }
        Insert: {
          completed_at?: string
          id?: string
          migration_name: string
          rows_processed: number
        }
        Update: {
          completed_at?: string
          id?: string
          migration_name?: string
          rows_processed?: number
        }
        Relationships: []
      }
      device_type_normalization: {
        Row: {
          created_at: string
          default_is_private_residence: boolean | null
          id: number
          normalized_category: string
          normalized_subtype: string | null
          normalized_technology: string | null
          public_id: number
          raw_description: string | null
          raw_device_type: string
          source_system: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_is_private_residence?: boolean | null
          id?: number
          normalized_category: string
          normalized_subtype?: string | null
          normalized_technology?: string | null
          public_id?: number
          raw_description?: string | null
          raw_device_type: string
          source_system: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_is_private_residence?: boolean | null
          id?: number
          normalized_category?: string
          normalized_subtype?: string | null
          normalized_technology?: string | null
          public_id?: number
          raw_description?: string | null
          raw_device_type?: string
          source_system?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          available_variables: Json
          body_html_template: string
          body_text_template: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          name: string
          org_id: string
          public_id: number
          status: string
          subject_template: string
          template_key: string
          updated_at: string
          updated_by_user_id: string
        }
        Insert: {
          available_variables?: Json
          body_html_template: string
          body_text_template?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          public_id?: number
          status?: string
          subject_template: string
          template_key: string
          updated_at?: string
          updated_by_user_id: string
        }
        Update: {
          available_variables?: Json
          body_html_template?: string
          body_text_template?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          public_id?: number
          status?: string
          subject_template?: string
          template_key?: string
          updated_at?: string
          updated_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_sync_state: {
        Row: {
          created_at: string
          id: string
          last_cursor: string | null
          last_error: string | null
          last_run_at: string | null
          last_seen_at: string | null
          org_id: string
          public_id: number
          source: Database["public"]["Enums"]["external_sync_source"]
          status: Database["public"]["Enums"]["external_sync_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_cursor?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_seen_at?: string | null
          org_id: string
          public_id?: number
          source: Database["public"]["Enums"]["external_sync_source"]
          status?: Database["public"]["Enums"]["external_sync_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_cursor?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_seen_at?: string | null
          org_id?: string
          public_id?: number
          source?: Database["public"]["Enums"]["external_sync_source"]
          status?: Database["public"]["Enums"]["external_sync_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_sync_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      file_categories: {
        Row: {
          buildium_category_id: number | null
          category_name: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          org_id: string
          public_id: number
          updated_at: string
        }
        Insert: {
          buildium_category_id?: number | null
          category_name: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          org_id: string
          public_id?: number
          updated_at?: string
        }
        Update: {
          buildium_category_id?: number | null
          category_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string
          public_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string | null
          buildium_category_id: number | null
          buildium_file_id: number | null
          buildium_href: string | null
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          entity_id: number
          entity_type: Database["public"]["Enums"]["files_entity_type_enum"]
          external_url: string | null
          file_name: string
          id: string
          is_private: boolean
          mime_type: string | null
          org_id: string
          public_id: number
          sha256: string | null
          size_bytes: number | null
          storage_key: string | null
          storage_provider: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bucket?: string | null
          buildium_category_id?: number | null
          buildium_file_id?: number | null
          buildium_href?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          entity_id: number
          entity_type: Database["public"]["Enums"]["files_entity_type_enum"]
          external_url?: string | null
          file_name: string
          id?: string
          is_private?: boolean
          mime_type?: string | null
          org_id: string
          public_id?: number
          sha256?: string | null
          size_bytes?: number | null
          storage_key?: string | null
          storage_provider?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bucket?: string | null
          buildium_category_id?: number | null
          buildium_file_id?: number | null
          buildium_href?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          entity_id?: number
          entity_type?: Database["public"]["Enums"]["files_entity_type_enum"]
          external_url?: string | null
          file_name?: string
          id?: string
          is_private?: boolean
          mime_type?: string | null
          org_id?: string
          public_id?: number
          sha256?: string | null
          size_bytes?: number | null
          storage_key?: string | null
          storage_provider?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "file_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_account_balances: {
        Row: {
          as_of_date: string
          balance: number
          computed_at: string
          gl_account_id: string
          id: string
          org_id: string
          payload: Json | null
          property_id: string | null
          source: string
        }
        Insert: {
          as_of_date: string
          balance: number
          computed_at?: string
          gl_account_id: string
          id?: string
          org_id: string
          payload?: Json | null
          property_id?: string | null
          source?: string
        }
        Update: {
          as_of_date?: string
          balance?: number
          computed_at?: string
          gl_account_id?: string
          id?: string
          org_id?: string
          payload?: Json | null
          property_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_account_balances_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_account_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_account_balances_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_account_balances_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      gl_account_category: {
        Row: {
          category: Database["public"]["Enums"]["gl_category"]
          gl_account_id: string
          public_id: number
        }
        Insert: {
          category: Database["public"]["Enums"]["gl_category"]
          gl_account_id: string
          public_id?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["gl_category"]
          gl_account_id?: string
          public_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gl_account_category_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: true
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          account_number: string | null
          bank_account_number: string | null
          bank_account_type:
            | Database["public"]["Enums"]["bank_account_type_enum"]
            | null
          bank_balance: number | null
          bank_buildium_balance: number | null
          bank_check_printing_info: Json | null
          bank_country: Database["public"]["Enums"]["countries"] | null
          bank_electronic_payments: Json | null
          bank_last_source:
            | Database["public"]["Enums"]["sync_source_enum"]
            | null
          bank_last_source_ts: string | null
          bank_routing_number: string | null
          buildium_gl_account_id: number
          buildium_parent_gl_account_id: number | null
          cash_flow_classification: string | null
          created_at: string
          default_account_name: string | null
          description: string | null
          exclude_from_cash_balances: boolean | null
          id: string
          is_active: boolean | null
          is_bank_account: boolean | null
          is_contra_account: boolean | null
          is_credit_card_account: boolean | null
          is_default_gl_account: boolean | null
          is_security_deposit_liability: boolean
          name: string
          org_id: string | null
          property_id: string | null
          public_id: number
          sub_accounts: string[] | null
          sub_type: string | null
          type: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_account_number?: string | null
          bank_account_type?:
            | Database["public"]["Enums"]["bank_account_type_enum"]
            | null
          bank_balance?: number | null
          bank_buildium_balance?: number | null
          bank_check_printing_info?: Json | null
          bank_country?: Database["public"]["Enums"]["countries"] | null
          bank_electronic_payments?: Json | null
          bank_last_source?:
            | Database["public"]["Enums"]["sync_source_enum"]
            | null
          bank_last_source_ts?: string | null
          bank_routing_number?: string | null
          buildium_gl_account_id: number
          buildium_parent_gl_account_id?: number | null
          cash_flow_classification?: string | null
          created_at?: string
          default_account_name?: string | null
          description?: string | null
          exclude_from_cash_balances?: boolean | null
          id?: string
          is_active?: boolean | null
          is_bank_account?: boolean | null
          is_contra_account?: boolean | null
          is_credit_card_account?: boolean | null
          is_default_gl_account?: boolean | null
          is_security_deposit_liability?: boolean
          name: string
          org_id?: string | null
          property_id?: string | null
          public_id?: number
          sub_accounts?: string[] | null
          sub_type?: string | null
          type: string
          unit_id?: string | null
          updated_at: string
        }
        Update: {
          account_number?: string | null
          bank_account_number?: string | null
          bank_account_type?:
            | Database["public"]["Enums"]["bank_account_type_enum"]
            | null
          bank_balance?: number | null
          bank_buildium_balance?: number | null
          bank_check_printing_info?: Json | null
          bank_country?: Database["public"]["Enums"]["countries"] | null
          bank_electronic_payments?: Json | null
          bank_last_source?:
            | Database["public"]["Enums"]["sync_source_enum"]
            | null
          bank_last_source_ts?: string | null
          bank_routing_number?: string | null
          buildium_gl_account_id?: number
          buildium_parent_gl_account_id?: number | null
          cash_flow_classification?: string | null
          created_at?: string
          default_account_name?: string | null
          description?: string | null
          exclude_from_cash_balances?: boolean | null
          id?: string
          is_active?: boolean | null
          is_bank_account?: boolean | null
          is_contra_account?: boolean | null
          is_credit_card_account?: boolean | null
          is_default_gl_account?: boolean | null
          is_security_deposit_liability?: boolean
          name?: string
          org_id?: string | null
          property_id?: string | null
          public_id?: number
          sub_accounts?: string[] | null
          sub_type?: string | null
          type?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "gl_accounts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_import_cursors: {
        Row: {
          key: string
          last_imported_at: string
          public_id: number
          updated_at: string
          window_days: number
        }
        Insert: {
          key: string
          last_imported_at?: string
          public_id?: number
          updated_at?: string
          window_days?: number
        }
        Update: {
          key?: string
          last_imported_at?: string
          public_id?: number
          updated_at?: string
          window_days?: number
        }
        Relationships: []
      }
      gmail_integrations: {
        Row: {
          access_token_encrypted: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          org_id: string
          public_id: number
          refresh_token_encrypted: string | null
          scope: string
          staff_id: number
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          org_id: string
          public_id?: number
          refresh_token_encrypted?: string | null
          scope: string
          staff_id: number
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          org_id?: string
          public_id?: number
          refresh_token_encrypted?: string | null
          scope?: string
          staff_id?: number
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_integrations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_integrations: {
        Row: {
          access_token_encrypted: string
          calendar_id: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          org_id: string
          public_id: number
          refresh_token_encrypted: string | null
          scope: string
          staff_id: number
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          calendar_id?: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          org_id: string
          public_id?: number
          refresh_token_encrypted?: string | null
          scope: string
          staff_id: number
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          calendar_id?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          org_id?: string
          public_id?: number
          refresh_token_encrypted?: string | null
          scope?: string
          staff_id?: number
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_integrations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          last_used_at: string
          org_id: string | null
          public_id: number
          response: Json | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          last_used_at?: string
          org_id?: string | null
          public_id?: number
          response?: Json | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          last_used_at?: string
          org_id?: string | null
          public_id?: number
          response?: Json | null
        }
        Relationships: []
      }
      inspections: {
        Row: {
          created_at: string
          id: string
          inspection_date: string
          property: string
          public_id: number
          status: Database["public"]["Enums"]["inspection_status_enum"]
          type: Database["public"]["Enums"]["inspection_type_enum"]
          unit: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_date: string
          property: string
          public_id?: number
          status: Database["public"]["Enums"]["inspection_status_enum"]
          type: Database["public"]["Enums"]["inspection_type_enum"]
          unit: string
          unit_id: string
          updated_at: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_date?: string
          property?: string
          public_id?: number
          status?: Database["public"]["Enums"]["inspection_status_enum"]
          type?: Database["public"]["Enums"]["inspection_type_enum"]
          unit?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          buildium_gl_entry_id: number | null
          check_number: string | null
          created_at: string
          date: string
          id: string
          memo: string | null
          org_id: string | null
          property_id: string | null
          public_id: number
          total_amount: number
          transaction_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          buildium_gl_entry_id?: number | null
          check_number?: string | null
          created_at?: string
          date: string
          id?: string
          memo?: string | null
          org_id?: string | null
          property_id?: string | null
          public_id?: number
          total_amount?: number
          transaction_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          buildium_gl_entry_id?: number | null
          check_number?: string | null
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          org_id?: string | null
          property_id?: string | null
          public_id?: number
          total_amount?: number
          transaction_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_property_id_fkey1"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_property_id_fkey1"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey1"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey1"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey1"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey1"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey1"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "journal_entries_unit_id_fkey1"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lease: {
        Row: {
          automatically_move_out_tenants: boolean | null
          buildium_created_at: string | null
          buildium_lease_id: number | null
          buildium_property_id: number | null
          buildium_unit_id: number | null
          buildium_updated_at: string | null
          comment: string | null
          created_at: string
          current_number_of_occupants: number | null
          id: number
          is_eviction_pending: boolean | null
          lease_charges: string | null
          lease_from_date: string
          lease_to_date: string | null
          lease_type: string | null
          org_id: string | null
          payment_due_day: number | null
          property_id: string
          prorated_first_month_rent: number | null
          prorated_last_month_rent: number | null
          public_id: number
          renewal_offer_status: string | null
          rent_amount: number | null
          security_deposit: number | null
          status: string
          term_type: string | null
          unit_id: string
          unit_number: string | null
          updated_at: string
        }
        Insert: {
          automatically_move_out_tenants?: boolean | null
          buildium_created_at?: string | null
          buildium_lease_id?: number | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          buildium_updated_at?: string | null
          comment?: string | null
          created_at?: string
          current_number_of_occupants?: number | null
          id?: number
          is_eviction_pending?: boolean | null
          lease_charges?: string | null
          lease_from_date: string
          lease_to_date?: string | null
          lease_type?: string | null
          org_id?: string | null
          payment_due_day?: number | null
          property_id: string
          prorated_first_month_rent?: number | null
          prorated_last_month_rent?: number | null
          public_id?: number
          renewal_offer_status?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          status?: string
          term_type?: string | null
          unit_id: string
          unit_number?: string | null
          updated_at: string
        }
        Update: {
          automatically_move_out_tenants?: boolean | null
          buildium_created_at?: string | null
          buildium_lease_id?: number | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          buildium_updated_at?: string | null
          comment?: string | null
          created_at?: string
          current_number_of_occupants?: number | null
          id?: number
          is_eviction_pending?: boolean | null
          lease_charges?: string | null
          lease_from_date?: string
          lease_to_date?: string | null
          lease_type?: string | null
          org_id?: string | null
          payment_due_day?: number | null
          property_id?: string
          prorated_first_month_rent?: number | null
          prorated_last_month_rent?: number | null
          public_id?: number
          renewal_offer_status?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          status?: string
          term_type?: string | null
          unit_id?: string
          unit_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lease_property_id"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lease_property_id"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "fk_lease_unit_id"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Lease_propertyId_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Lease_propertyId_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "Lease_unitId_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_contacts: {
        Row: {
          created_at: string
          id: string
          is_rent_responsible: boolean | null
          lease_id: number
          move_in_date: string | null
          move_out_date: string | null
          notice_given_date: string | null
          org_id: string | null
          public_id: number
          role: Database["public"]["Enums"]["lease_contact_role_enum"]
          status: Database["public"]["Enums"]["lease_contact_status_enum"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_rent_responsible?: boolean | null
          lease_id: number
          move_in_date?: string | null
          move_out_date?: string | null
          notice_given_date?: string | null
          org_id?: string | null
          public_id?: number
          role?: Database["public"]["Enums"]["lease_contact_role_enum"]
          status?: Database["public"]["Enums"]["lease_contact_status_enum"]
          tenant_id: string
          updated_at: string
        }
        Update: {
          created_at?: string
          id?: string
          is_rent_responsible?: boolean | null
          lease_id?: number
          move_in_date?: string | null
          move_out_date?: string | null
          notice_given_date?: string | null
          org_id?: string | null
          public_id?: number
          role?: Database["public"]["Enums"]["lease_contact_role_enum"]
          status?: Database["public"]["Enums"]["lease_contact_status_enum"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_contacts_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_notes: {
        Row: {
          body: string | null
          buildium_lease_id: number | null
          buildium_note_id: number | null
          created_at: string | null
          id: string
          is_private: boolean | null
          lease_id: number
          public_id: number
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          buildium_lease_id?: number | null
          buildium_note_id?: number | null
          created_at?: string | null
          id?: string
          is_private?: boolean | null
          lease_id: number
          public_id?: number
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          buildium_lease_id?: number | null
          buildium_note_id?: number | null
          created_at?: string | null
          id?: string
          is_private?: boolean | null
          lease_id?: number
          public_id?: number
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_notes_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_recurring_transactions: {
        Row: {
          amount: number | null
          buildium_lease_id: number | null
          buildium_recurring_id: number | null
          created_at: string | null
          description: string | null
          end_date: string | null
          frequency: string | null
          id: string
          lease_id: number
          public_id: number
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          buildium_lease_id?: number | null
          buildium_recurring_id?: number | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          lease_id: number
          public_id?: number
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          buildium_lease_id?: number | null
          buildium_recurring_id?: number | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          lease_id?: number
          public_id?: number
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_recurring_transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_telemetry_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event: string
          lease_id: number | null
          org_id: string | null
          prefills: Json | null
          source: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event: string
          lease_id?: number | null
          org_id?: string | null
          prefills?: Json | null
          source?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event?: string
          lease_id?: number | null
          org_id?: string | null
          prefills?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      manual_payment_events: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          event_data: Json
          id: string
          normalized_event_type: string | null
          occurred_at: string
          org_id: string
          payment_id: string | null
          payment_intent_id: string | null
          raw_event_type: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          event_data: Json
          id?: string
          normalized_event_type?: string | null
          occurred_at: string
          org_id: string
          payment_id?: string | null
          payment_intent_id?: string | null
          raw_event_type: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          event_data?: Json
          id?: string
          normalized_event_type?: string | null
          occurred_at?: string
          org_id?: string
          payment_id?: string | null
          payment_intent_id?: string | null
          raw_event_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_payment_events_intent_fk"
            columns: ["org_id", "payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intent"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "manual_payment_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_events_payment_fk"
            columns: ["org_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payment"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "manual_payment_events_payment_fk"
            columns: ["org_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payment_lifecycle_projection"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      membership_roles: {
        Row: {
          created_at: string
          org_id: string
          public_id: number
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          public_id?: number
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          public_id?: number
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_log_task_rules: {
        Row: {
          assigned_to_staff_id: number | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description_template: string | null
          due_anchor: string | null
          due_offset_days: number | null
          frequency: string | null
          id: string
          interval: number | null
          is_active: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          org_id: string
          priority: string | null
          property_conditions: Json | null
          public_id: number
          service_offering_id: string | null
          stage_trigger: Database["public"]["Enums"]["monthly_log_stage"] | null
          status_default: string | null
          subject_template: string
          trigger_on_service_activation: boolean | null
          unit_conditions: Json | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_staff_id?: number | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_template?: string | null
          due_anchor?: string | null
          due_offset_days?: number | null
          frequency?: string | null
          id?: string
          interval?: number | null
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          org_id: string
          priority?: string | null
          property_conditions?: Json | null
          public_id?: number
          service_offering_id?: string | null
          stage_trigger?:
            | Database["public"]["Enums"]["monthly_log_stage"]
            | null
          status_default?: string | null
          subject_template: string
          trigger_on_service_activation?: boolean | null
          unit_conditions?: Json | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_staff_id?: number | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_template?: string | null
          due_anchor?: string | null
          due_offset_days?: number | null
          frequency?: string | null
          id?: string
          interval?: number | null
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          org_id?: string
          priority?: string | null
          property_conditions?: Json | null
          public_id?: number
          service_offering_id?: string | null
          stage_trigger?:
            | Database["public"]["Enums"]["monthly_log_stage"]
            | null
          status_default?: string | null
          subject_template?: string
          trigger_on_service_activation?: boolean | null
          unit_conditions?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_log_task_rules_assigned_to_staff_id_fkey"
            columns: ["assigned_to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_log_task_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_log_task_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_log_task_rules_service_offering_id_fkey"
            columns: ["service_offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_logs: {
        Row: {
          bills_amount: number
          charges_amount: number
          created_at: string
          escrow_amount: number
          id: string
          lease_id: number | null
          management_fees_amount: number
          notes: string | null
          org_id: string
          owner_distribution_amount: number
          owner_statement_amount: number
          payments_amount: number
          pdf_url: string | null
          period_start: string
          previous_lease_balance: number
          property_id: string
          public_id: number
          sort_index: number
          stage: Database["public"]["Enums"]["monthly_log_stage"]
          status: Database["public"]["Enums"]["monthly_log_status"]
          tenant_id: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          bills_amount?: number
          charges_amount?: number
          created_at?: string
          escrow_amount?: number
          id?: string
          lease_id?: number | null
          management_fees_amount?: number
          notes?: string | null
          org_id: string
          owner_distribution_amount?: number
          owner_statement_amount?: number
          payments_amount?: number
          pdf_url?: string | null
          period_start: string
          previous_lease_balance?: number
          property_id: string
          public_id?: number
          sort_index?: number
          stage?: Database["public"]["Enums"]["monthly_log_stage"]
          status?: Database["public"]["Enums"]["monthly_log_status"]
          tenant_id?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          bills_amount?: number
          charges_amount?: number
          created_at?: string
          escrow_amount?: number
          id?: string
          lease_id?: number | null
          management_fees_amount?: number
          notes?: string | null
          org_id?: string
          owner_distribution_amount?: number
          owner_statement_amount?: number
          payments_amount?: number
          pdf_url?: string | null
          period_start?: string
          previous_lease_balance?: number
          property_id?: string
          public_id?: number
          sort_index?: number
          stage?: Database["public"]["Enums"]["monthly_log_stage"]
          status?: Database["public"]["Enums"]["monthly_log_status"]
          tenant_id?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_logs_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "monthly_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      org_accounting_config: {
        Row: {
          auto_lock_on_post: boolean | null
          enforce_immutability: boolean | null
          org_id: string
          updated_at: string | null
        }
        Insert: {
          auto_lock_on_post?: boolean | null
          enforce_immutability?: boolean | null
          org_id: string
          updated_at?: string | null
        }
        Update: {
          auto_lock_on_post?: boolean | null
          enforce_immutability?: boolean | null
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_accounting_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_control_accounts: {
        Row: {
          ar_account_id: string
          created_at: string
          late_fee_income_account_id: string | null
          org_id: string
          rent_income_account_id: string
          undeposited_funds_account_id: string | null
          updated_at: string
        }
        Insert: {
          ar_account_id: string
          created_at?: string
          late_fee_income_account_id?: string | null
          org_id: string
          rent_income_account_id: string
          undeposited_funds_account_id?: string | null
          updated_at?: string
        }
        Update: {
          ar_account_id?: string
          created_at?: string
          late_fee_income_account_id?: string | null
          org_id?: string
          rent_income_account_id?: string
          undeposited_funds_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_control_accounts_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_control_accounts_late_fee_income_account_id_fkey"
            columns: ["late_fee_income_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_control_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_control_accounts_rent_income_account_id_fkey"
            columns: ["rent_income_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_control_accounts_undeposited_funds_account_id_fkey"
            columns: ["undeposited_funds_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          public_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          public_id?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          public_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accounting_book_id: number | null
          ap_gl_account_id: string | null
          buildium_org_id: number | null
          company_name: string | null
          contact_address_line1: string | null
          contact_address_line2: string | null
          contact_address_line3: string | null
          contact_city: string | null
          contact_country: Database["public"]["Enums"]["countries"] | null
          contact_first_name: string | null
          contact_last_name: string | null
          contact_phone_number: string | null
          contact_postal_code: string | null
          contact_state: string | null
          created_at: string
          default_accounting_basis: Database["public"]["Enums"]["accounting_basis_enum"]
          default_bank_account_id: number | null
          fiscal_year_end_day: number | null
          fiscal_year_end_month: number | null
          id: string
          name: string
          public_id: number
          slug: string
          trust_account_warning: Database["public"]["Enums"]["trust_account_warning_enum"]
          updated_at: string
          url: string | null
        }
        Insert: {
          accounting_book_id?: number | null
          ap_gl_account_id?: string | null
          buildium_org_id?: number | null
          company_name?: string | null
          contact_address_line1?: string | null
          contact_address_line2?: string | null
          contact_address_line3?: string | null
          contact_city?: string | null
          contact_country?: Database["public"]["Enums"]["countries"] | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone_number?: string | null
          contact_postal_code?: string | null
          contact_state?: string | null
          created_at?: string
          default_accounting_basis?: Database["public"]["Enums"]["accounting_basis_enum"]
          default_bank_account_id?: number | null
          fiscal_year_end_day?: number | null
          fiscal_year_end_month?: number | null
          id?: string
          name: string
          public_id?: number
          slug: string
          trust_account_warning?: Database["public"]["Enums"]["trust_account_warning_enum"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          accounting_book_id?: number | null
          ap_gl_account_id?: string | null
          buildium_org_id?: number | null
          company_name?: string | null
          contact_address_line1?: string | null
          contact_address_line2?: string | null
          contact_address_line3?: string | null
          contact_city?: string | null
          contact_country?: Database["public"]["Enums"]["countries"] | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone_number?: string | null
          contact_postal_code?: string | null
          contact_state?: string | null
          created_at?: string
          default_accounting_basis?: Database["public"]["Enums"]["accounting_basis_enum"]
          default_bank_account_id?: number | null
          fiscal_year_end_day?: number | null
          fiscal_year_end_month?: number | null
          id?: string
          name?: string
          public_id?: number
          slug?: string
          trust_account_warning?: Database["public"]["Enums"]["trust_account_warning_enum"]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_ap_gl_account_id_fkey"
            columns: ["ap_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          buildium_created_at: string | null
          buildium_owner_id: number | null
          buildium_updated_at: string | null
          comment: string | null
          contact_id: number | null
          created_at: string
          etf_account_number: number | null
          etf_account_type:
            | Database["public"]["Enums"]["etf_account_type_enum"]
            | null
          etf_routing_number: number | null
          id: string
          is_active: boolean | null
          last_contacted: string | null
          management_agreement_end_date: string | null
          management_agreement_start_date: string | null
          org_id: string | null
          public_id: string
          tax_address_line1: string | null
          tax_address_line2: string | null
          tax_address_line3: string | null
          tax_city: string | null
          tax_country: Database["public"]["Enums"]["countries"] | null
          tax_include1099: boolean | null
          tax_payer_id: string | null
          tax_payer_name1: string | null
          tax_payer_name2: string | null
          tax_payer_type: Database["public"]["Enums"]["tax_payer_type"] | null
          tax_postal_code: string | null
          tax_state: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          buildium_created_at?: string | null
          buildium_owner_id?: number | null
          buildium_updated_at?: string | null
          comment?: string | null
          contact_id?: number | null
          created_at?: string
          etf_account_number?: number | null
          etf_account_type?:
            | Database["public"]["Enums"]["etf_account_type_enum"]
            | null
          etf_routing_number?: number | null
          id?: string
          is_active?: boolean | null
          last_contacted?: string | null
          management_agreement_end_date?: string | null
          management_agreement_start_date?: string | null
          org_id?: string | null
          public_id?: string
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_city?: string | null
          tax_country?: Database["public"]["Enums"]["countries"] | null
          tax_include1099?: boolean | null
          tax_payer_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?: Database["public"]["Enums"]["tax_payer_type"] | null
          tax_postal_code?: string | null
          tax_state?: string | null
          updated_at: string
          user_id?: string | null
        }
        Update: {
          buildium_created_at?: string | null
          buildium_owner_id?: number | null
          buildium_updated_at?: string | null
          comment?: string | null
          contact_id?: number | null
          created_at?: string
          etf_account_number?: number | null
          etf_account_type?:
            | Database["public"]["Enums"]["etf_account_type_enum"]
            | null
          etf_routing_number?: number | null
          id?: string
          is_active?: boolean | null
          last_contacted?: string | null
          management_agreement_end_date?: string | null
          management_agreement_start_date?: string | null
          org_id?: string | null
          public_id?: string
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_city?: string | null
          tax_country?: Database["public"]["Enums"]["countries"] | null
          tax_include1099?: boolean | null
          tax_payer_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?: Database["public"]["Enums"]["tax_payer_type"] | null
          tax_postal_code?: string | null
          tax_state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owners_contact_fk"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_contact_fk"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "owners_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ownerships: {
        Row: {
          created_at: string
          disbursement_percentage: number
          id: string
          org_id: string
          owner_id: string
          ownership_percentage: number
          primary: boolean
          property_id: string
          total_properties: number
          total_units: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          disbursement_percentage: number
          id?: string
          org_id: string
          owner_id: string
          ownership_percentage: number
          primary?: boolean
          property_id: string
          total_properties?: number
          total_units?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          disbursement_percentage?: number
          id?: string
          org_id?: string
          owner_id?: string
          ownership_percentage?: number
          primary?: boolean
          property_id?: string
          total_properties?: number
          total_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownerships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownerships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownerships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownerships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      payer_restriction_methods: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payer_restriction_id: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payer_restriction_id: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payer_restriction_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_restriction_methods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payer_restriction_methods_parent_fk"
            columns: ["org_id", "payer_restriction_id"]
            isOneToOne: false
            referencedRelation: "payer_restrictions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      payer_restrictions: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          org_id: string
          payer_id: string | null
          payer_type: string | null
          reason: string | null
          restricted_until: string | null
          restriction_type: string
          source_event_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          payer_id?: string | null
          payer_type?: string | null
          reason?: string | null
          restricted_until?: string | null
          restriction_type: string
          source_event_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          payer_id?: string | null
          payer_type?: string | null
          reason?: string | null
          restricted_until?: string | null
          restriction_type?: string
          source_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_restrictions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount: number | null
          chargeback_id: string | null
          created_at: string
          disputed_at: string | null
          gateway_transaction_id: string | null
          id: string
          normalized_return_reason_code: string | null
          normalized_state: string | null
          org_id: string
          payer_id: string | null
          payer_type: string | null
          payment_intent_id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          raw_return_reason_code: string | null
          returned_at: string | null
          settled_at: string | null
          state: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          chargeback_id?: string | null
          created_at?: string
          disputed_at?: string | null
          gateway_transaction_id?: string | null
          id?: string
          normalized_return_reason_code?: string | null
          normalized_state?: string | null
          org_id: string
          payer_id?: string | null
          payer_type?: string | null
          payment_intent_id: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          raw_return_reason_code?: string | null
          returned_at?: string | null
          settled_at?: string | null
          state?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          chargeback_id?: string | null
          created_at?: string
          disputed_at?: string | null
          gateway_transaction_id?: string | null
          id?: string
          normalized_return_reason_code?: string | null
          normalized_state?: string | null
          org_id?: string
          payer_id?: string | null
          payer_type?: string | null
          payment_intent_id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          raw_return_reason_code?: string | null
          returned_at?: string | null
          settled_at?: string | null
          state?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intent_fk"
            columns: ["org_id", "payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intent"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "payment_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          allocation_order: number
          charge_id: string
          created_at: string
          created_by: string | null
          external_id: string | null
          id: string
          org_id: string
          payment_transaction_id: string
          source: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allocated_amount: number
          allocation_order: number
          charge_id: string
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          org_id: string
          payment_transaction_id: string
          source?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allocated_amount?: number
          allocation_order?: number
          charge_id?: string
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          org_id?: string
          payment_transaction_id?: string
          source?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      payment_intent: {
        Row: {
          allocation_plan: Json | null
          amount: number
          bypass_udf: boolean
          created_at: string
          gateway_intent_id: string | null
          gateway_provider: string | null
          id: string
          idempotency_key: string
          metadata: Json
          org_id: string
          payer_id: string | null
          payer_type: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          state: Database["public"]["Enums"]["payment_intent_state_enum"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          allocation_plan?: Json | null
          amount: number
          bypass_udf?: boolean
          created_at?: string
          gateway_intent_id?: string | null
          gateway_provider?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          org_id: string
          payer_id?: string | null
          payer_type?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          state?: Database["public"]["Enums"]["payment_intent_state_enum"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          allocation_plan?: Json | null
          amount?: number
          bypass_udf?: boolean
          created_at?: string
          gateway_intent_id?: string | null
          gateway_provider?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          org_id?: string
          payer_id?: string | null
          payer_type?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          state?: Database["public"]["Enums"]["payment_intent_state_enum"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intent_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string | null
          date_format: string | null
          display_name: string | null
          email: string | null
          favorite_properties: string[]
          full_name: string | null
          landing_page: string | null
          locale: string | null
          notification_preferences: Json
          number_format: string | null
          personal_integrations: Json
          phone: string | null
          primary_work_role: string | null
          public_id: number
          timezone: string | null
          two_factor_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string | null
          date_format?: string | null
          display_name?: string | null
          email?: string | null
          favorite_properties?: string[]
          full_name?: string | null
          landing_page?: string | null
          locale?: string | null
          notification_preferences?: Json
          number_format?: string | null
          personal_integrations?: Json
          phone?: string | null
          primary_work_role?: string | null
          public_id?: number
          timezone?: string | null
          two_factor_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string | null
          date_format?: string | null
          display_name?: string | null
          email?: string | null
          favorite_properties?: string[]
          full_name?: string | null
          landing_page?: string | null
          locale?: string | null
          notification_preferences?: Json
          number_format?: string | null
          personal_integrations?: Json
          phone?: string | null
          primary_work_role?: string | null
          public_id?: number
          timezone?: string | null
          two_factor_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_line3: string | null
          available_balance: number | null
          bbl: string | null
          bill_administration:
            | Database["public"]["Enums"]["bill_administration_option"][]
            | null
          bill_administration_notes: string | null
          bill_pay_list: string | null
          bill_pay_notes: string | null
          bin: string | null
          block: number | null
          borough: string | null
          borough_code: number | null
          building_id: string | null
          buildium_created_at: string | null
          buildium_property_id: number | null
          buildium_updated_at: string | null
          cash_balance: number | null
          cash_updated_at: string | null
          city: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at: string
          deposit_trust_gl_account_id: string | null
          hpd_building_id: number | null
          hpd_registration_id: number | null
          id: string
          is_active: boolean | null
          latitude: number | null
          location_verified: boolean | null
          longitude: number | null
          lot: number | null
          management_scope:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          name: string
          neighborhood: string | null
          normalized_address_key: string | null
          occupancy_rate: number | null
          operating_bank_gl_account_id: string | null
          org_id: string
          postal_code: string
          primary_owner: string | null
          property_type:
            | Database["public"]["Enums"]["property_type_enum"]
            | null
          public_id: number
          rental_owner_ids: number[] | null
          rental_type: string | null
          reserve: number | null
          security_deposits: number | null
          service_assignment: Database["public"]["Enums"]["assignment_level"]
          state: string | null
          statement_recipients: Json | null
          status: Database["public"]["Enums"]["property_status"]
          structure_description: string | null
          total_active_units: number
          total_inactive_units: number
          total_occupied_units: number
          total_units: number
          total_vacant_units: number
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_line3?: string | null
          available_balance?: number | null
          bbl?: string | null
          bill_administration?:
            | Database["public"]["Enums"]["bill_administration_option"][]
            | null
          bill_administration_notes?: string | null
          bill_pay_list?: string | null
          bill_pay_notes?: string | null
          bin?: string | null
          block?: number | null
          borough?: string | null
          borough_code?: number | null
          building_id?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_updated_at?: string | null
          cash_balance?: number | null
          cash_updated_at?: string | null
          city?: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposit_trust_gl_account_id?: string | null
          hpd_building_id?: number | null
          hpd_registration_id?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          lot?: number | null
          management_scope?:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          name: string
          neighborhood?: string | null
          normalized_address_key?: string | null
          occupancy_rate?: number | null
          operating_bank_gl_account_id?: string | null
          org_id: string
          postal_code: string
          primary_owner?: string | null
          property_type?:
            | Database["public"]["Enums"]["property_type_enum"]
            | null
          public_id?: number
          rental_owner_ids?: number[] | null
          rental_type?: string | null
          reserve?: number | null
          security_deposits?: number | null
          service_assignment: Database["public"]["Enums"]["assignment_level"]
          state?: string | null
          statement_recipients?: Json | null
          status?: Database["public"]["Enums"]["property_status"]
          structure_description?: string | null
          total_active_units?: number
          total_inactive_units?: number
          total_occupied_units?: number
          total_units?: number
          total_vacant_units?: number
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_line3?: string | null
          available_balance?: number | null
          bbl?: string | null
          bill_administration?:
            | Database["public"]["Enums"]["bill_administration_option"][]
            | null
          bill_administration_notes?: string | null
          bill_pay_list?: string | null
          bill_pay_notes?: string | null
          bin?: string | null
          block?: number | null
          borough?: string | null
          borough_code?: number | null
          building_id?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_updated_at?: string | null
          cash_balance?: number | null
          cash_updated_at?: string | null
          city?: string | null
          country?: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposit_trust_gl_account_id?: string | null
          hpd_building_id?: number | null
          hpd_registration_id?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          lot?: number | null
          management_scope?:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          name?: string
          neighborhood?: string | null
          normalized_address_key?: string | null
          occupancy_rate?: number | null
          operating_bank_gl_account_id?: string | null
          org_id?: string
          postal_code?: string
          primary_owner?: string | null
          property_type?:
            | Database["public"]["Enums"]["property_type_enum"]
            | null
          public_id?: number
          rental_owner_ids?: number[] | null
          rental_type?: string | null
          reserve?: number | null
          security_deposits?: number | null
          service_assignment?: Database["public"]["Enums"]["assignment_level"]
          state?: string | null
          statement_recipients?: Json | null
          status?: Database["public"]["Enums"]["property_status"]
          structure_description?: string | null
          total_active_units?: number
          total_inactive_units?: number
          total_occupied_units?: number
          total_units?: number
          total_vacant_units?: number
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_deposit_trust_gl_account_id_fkey"
            columns: ["deposit_trust_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_operating_bank_gl_account_id_fkey"
            columns: ["operating_bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          buildium_image_id: number | null
          created_at: string
          description: string | null
          file_size: number | null
          file_type: string | null
          href: string | null
          id: string
          is_private: boolean | null
          name: string | null
          property_id: string
          public_id: number
          sort_index: number | null
          updated_at: string
        }
        Insert: {
          buildium_image_id?: number | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          href?: string | null
          id?: string
          is_private?: boolean | null
          name?: string | null
          property_id: string
          public_id?: number
          sort_index?: number | null
          updated_at?: string
        }
        Update: {
          buildium_image_id?: number | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          href?: string | null
          id?: string
          is_private?: boolean | null
          name?: string | null
          property_id?: string
          public_id?: number
          sort_index?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          is_private: boolean
          property_id: string
          public_id: number
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_private?: boolean
          property_id: string
          public_id?: number
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          is_private?: boolean
          property_id?: string
          public_id?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_ownerships_cache: {
        Row: {
          contact_id: number
          disbursement_percentage: number
          display_name: string | null
          owner_id: string
          ownership_id: string
          ownership_percentage: number
          primary: boolean
          primary_email: string | null
          property_id: string
          public_id: number
          updated_at: string
        }
        Insert: {
          contact_id: number
          disbursement_percentage: number
          display_name?: string | null
          owner_id: string
          ownership_id: string
          ownership_percentage: number
          primary?: boolean
          primary_email?: string | null
          property_id: string
          public_id?: number
          updated_at?: string
        }
        Update: {
          contact_id?: number
          disbursement_percentage?: number
          display_name?: string | null
          owner_id?: string
          ownership_id?: string
          ownership_percentage?: number
          primary?: boolean
          primary_email?: string | null
          property_id?: string
          public_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      property_staff: {
        Row: {
          created_at: string
          property_id: string
          public_id: number
          role: Database["public"]["Enums"]["staff_roles"]
          staff_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          property_id: string
          public_id?: number
          role?: Database["public"]["Enums"]["staff_roles"]
          staff_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          property_id?: string
          public_id?: number
          role?: Database["public"]["Enums"]["staff_roles"]
          staff_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_staff_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_staff_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          external_id: string | null
          id: string
          lease_id: number
          org_id: string
          outstanding_amount: number | null
          paid_amount: number
          receivable_type: Database["public"]["Enums"]["receivable_type_enum"]
          source: string | null
          status: Database["public"]["Enums"]["receivable_status_enum"]
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          external_id?: string | null
          id?: string
          lease_id: number
          org_id: string
          outstanding_amount?: number | null
          paid_amount?: number
          receivable_type: Database["public"]["Enums"]["receivable_type_enum"]
          source?: string | null
          status?: Database["public"]["Enums"]["receivable_status_enum"]
          total_amount: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          external_id?: string | null
          id?: string
          lease_id?: number
          org_id?: string
          outstanding_amount?: number | null
          paid_amount?: number
          receivable_type?: Database["public"]["Enums"]["receivable_type_enum"]
          source?: string | null
          status?: Database["public"]["Enums"]["receivable_status_enum"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_log: {
        Row: {
          as_of: string | null
          bank_gl_account_id: string | null
          book_balance_snapshot: number | null
          buildium_bank_account_id: number | null
          buildium_reconciliation_id: number | null
          created_at: string
          ending_balance: number | null
          gl_account_id: string | null
          id: string
          is_finished: boolean
          last_sync_error: string | null
          last_synced_at: string | null
          locked_at: string | null
          locked_by_user_id: string | null
          notes: string | null
          performed_by: string | null
          property_id: string | null
          public_id: number
          statement_ending_date: string | null
          statement_start_date: string | null
          total_checks_withdrawals: number | null
          total_deposits_additions: number | null
          unmatched_buildium_transaction_ids: number[] | null
        }
        Insert: {
          as_of?: string | null
          bank_gl_account_id?: string | null
          book_balance_snapshot?: number | null
          buildium_bank_account_id?: number | null
          buildium_reconciliation_id?: number | null
          created_at?: string
          ending_balance?: number | null
          gl_account_id?: string | null
          id?: string
          is_finished?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          notes?: string | null
          performed_by?: string | null
          property_id?: string | null
          public_id?: number
          statement_ending_date?: string | null
          statement_start_date?: string | null
          total_checks_withdrawals?: number | null
          total_deposits_additions?: number | null
          unmatched_buildium_transaction_ids?: number[] | null
        }
        Update: {
          as_of?: string | null
          bank_gl_account_id?: string | null
          book_balance_snapshot?: number | null
          buildium_bank_account_id?: number | null
          buildium_reconciliation_id?: number | null
          created_at?: string
          ending_balance?: number | null
          gl_account_id?: string | null
          id?: string
          is_finished?: boolean
          last_sync_error?: string | null
          last_synced_at?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          notes?: string | null
          performed_by?: string | null
          property_id?: string | null
          public_id?: number
          statement_ending_date?: string | null
          statement_start_date?: string | null
          total_checks_withdrawals?: number | null
          total_deposits_additions?: number | null
          unmatched_buildium_transaction_ids?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_log_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          amount: number
          buildium_recurring_id: number | null
          created_at: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["rent_cycle_enum"]
          id: string
          lease_id: number | null
          memo: string | null
          public_id: number
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          buildium_recurring_id?: number | null
          created_at?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["rent_cycle_enum"]
          id?: string
          lease_id?: number | null
          memo?: string | null
          public_id?: number
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buildium_recurring_id?: number | null
          created_at?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["rent_cycle_enum"]
          id?: string
          lease_id?: number | null
          memo?: string | null
          public_id?: number
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_schedules: {
        Row: {
          backdate_charges: boolean
          buildium_rent_id: number | null
          created_at: string
          end_date: string | null
          id: string
          lease_id: number
          public_id: number
          rent_cycle: Database["public"]["Enums"]["rent_cycle_enum"]
          start_date: string
          status: Database["public"]["Enums"]["rent_schedule_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          backdate_charges?: boolean
          buildium_rent_id?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          lease_id: number
          public_id?: number
          rent_cycle: Database["public"]["Enums"]["rent_cycle_enum"]
          start_date: string
          status?: Database["public"]["Enums"]["rent_schedule_status"]
          total_amount: number
          updated_at: string
        }
        Update: {
          backdate_charges?: boolean
          buildium_rent_id?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          lease_id?: number
          public_id?: number
          rent_cycle?: Database["public"]["Enums"]["rent_cycle_enum"]
          start_date?: string
          status?: Database["public"]["Enums"]["rent_schedule_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_schedules_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
        ]
      }
      returned_payment_policies: {
        Row: {
          auto_create_nsf_fee: boolean | null
          created_at: string
          nsf_fee_amount: number | null
          nsf_fee_gl_account_id: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          auto_create_nsf_fee?: boolean | null
          created_at?: string
          nsf_fee_amount?: number | null
          nsf_fee_gl_account_id?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          auto_create_nsf_fee?: boolean | null
          created_at?: string
          nsf_fee_amount?: number | null
          nsf_fee_gl_account_id?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returned_payment_policies_nsf_fee_gl_account_id_fkey"
            columns: ["nsf_fee_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returned_payment_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          public_id: number
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          public_id?: number
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          public_id?: number
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profile_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_profile_permissions_profile_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          org_id: string | null
          public_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          org_id?: string | null
          public_id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          org_id?: string | null
          public_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_automation_rules: {
        Row: {
          charge_template: Json | null
          conditions: Json | null
          created_at: string | null
          frequency: Database["public"]["Enums"]["automation_frequency_enum"]
          id: string
          is_active: boolean | null
          offering_id: string
          public_id: number
          rule_type: Database["public"]["Enums"]["automation_rule_type_enum"]
          task_template: Json | null
          updated_at: string | null
        }
        Insert: {
          charge_template?: Json | null
          conditions?: Json | null
          created_at?: string | null
          frequency: Database["public"]["Enums"]["automation_frequency_enum"]
          id?: string
          is_active?: boolean | null
          offering_id: string
          public_id?: number
          rule_type: Database["public"]["Enums"]["automation_rule_type_enum"]
          task_template?: Json | null
          updated_at?: string | null
        }
        Update: {
          charge_template?: Json | null
          conditions?: Json | null
          created_at?: string | null
          frequency?: Database["public"]["Enums"]["automation_frequency_enum"]
          id?: string
          is_active?: boolean | null
          offering_id?: string
          public_id?: number
          rule_type?: Database["public"]["Enums"]["automation_rule_type_enum"]
          task_template?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_automation_rules_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_offering_assignments: {
        Row: {
          amount: number | null
          assignment_id: string
          created_at: string | null
          frequency:
            | Database["public"]["Enums"]["billing_frequency_enum"]
            | null
          id: string
          is_active: boolean | null
          offering_id: string
          override_amount: boolean | null
          override_frequency: boolean | null
          public_id: number
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          assignment_id: string
          created_at?: string | null
          frequency?:
            | Database["public"]["Enums"]["billing_frequency_enum"]
            | null
          id?: string
          is_active?: boolean | null
          offering_id: string
          override_amount?: boolean | null
          override_frequency?: boolean | null
          public_id?: number
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          assignment_id?: string
          created_at?: string | null
          frequency?:
            | Database["public"]["Enums"]["billing_frequency_enum"]
            | null
          id?: string
          is_active?: boolean | null
          offering_id?: string
          override_amount?: boolean | null
          override_frequency?: boolean | null
          public_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_assignment_selected_services_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "service_plan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_assignment_selected_services_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_offerings: {
        Row: {
          category: string
          created_at: string | null
          default_freq: Database["public"]["Enums"]["billing_frequency_enum"]
          default_rate: number | null
          description: string | null
          fee_type: Database["public"]["Enums"]["fee_type_enum"] | null
          hourly_min_hours: number | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          markup_pct: number | null
          markup_pct_cap: number | null
          name: string
          org_id: string
          public_id: number
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          default_freq: Database["public"]["Enums"]["billing_frequency_enum"]
          default_rate?: number | null
          description?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type_enum"] | null
          hourly_min_hours?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          markup_pct?: number | null
          markup_pct_cap?: number | null
          name: string
          org_id: string
          public_id?: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          default_freq?: Database["public"]["Enums"]["billing_frequency_enum"]
          default_rate?: number | null
          description?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type_enum"] | null
          hourly_min_hours?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          markup_pct?: number | null
          markup_pct_cap?: number | null
          name?: string
          org_id?: string
          public_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_offerings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plan_assignments: {
        Row: {
          created_at: string | null
          effective_end: string | null
          effective_start: string
          id: string
          is_active: boolean | null
          org_id: string
          plan_fee_amount: number | null
          plan_fee_frequency: Database["public"]["Enums"]["billing_frequency_enum"]
          plan_fee_percent: number | null
          plan_id: string
          property_id: string | null
          public_id: number
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_end?: string | null
          effective_start?: string
          id?: string
          is_active?: boolean | null
          org_id: string
          plan_fee_amount?: number | null
          plan_fee_frequency: Database["public"]["Enums"]["billing_frequency_enum"]
          plan_fee_percent?: number | null
          plan_id: string
          property_id?: string | null
          public_id?: number
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_end?: string | null
          effective_start?: string
          id?: string
          is_active?: boolean | null
          org_id?: string
          plan_fee_amount?: number | null
          plan_fee_frequency?: Database["public"]["Enums"]["billing_frequency_enum"]
          plan_fee_percent?: number | null
          plan_id?: string
          property_id?: string | null
          public_id?: number
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_plan_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plan_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plan_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "service_plan_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plan_services: {
        Row: {
          billing_basis:
            | Database["public"]["Enums"]["billing_basis_enum"]
            | null
          created_at: string | null
          default_amount: number | null
          default_frequency: Database["public"]["Enums"]["billing_frequency_enum"]
          default_included: boolean | null
          hourly_min_hours: number | null
          hourly_rate: number | null
          id: string
          is_required: boolean | null
          markup_pct: number | null
          markup_pct_cap: number | null
          offering_id: string
          plan_id: string
          public_id: number
          rent_basis: Database["public"]["Enums"]["rent_basis_enum"] | null
          updated_at: string | null
        }
        Insert: {
          billing_basis?:
            | Database["public"]["Enums"]["billing_basis_enum"]
            | null
          created_at?: string | null
          default_amount?: number | null
          default_frequency: Database["public"]["Enums"]["billing_frequency_enum"]
          default_included?: boolean | null
          hourly_min_hours?: number | null
          hourly_rate?: number | null
          id?: string
          is_required?: boolean | null
          markup_pct?: number | null
          markup_pct_cap?: number | null
          offering_id: string
          plan_id: string
          public_id?: number
          rent_basis?: Database["public"]["Enums"]["rent_basis_enum"] | null
          updated_at?: string | null
        }
        Update: {
          billing_basis?:
            | Database["public"]["Enums"]["billing_basis_enum"]
            | null
          created_at?: string | null
          default_amount?: number | null
          default_frequency?: Database["public"]["Enums"]["billing_frequency_enum"]
          default_included?: boolean | null
          hourly_min_hours?: number | null
          hourly_rate?: number | null
          id?: string
          is_required?: boolean | null
          markup_pct?: number | null
          markup_pct_cap?: number | null
          offering_id?: string
          plan_id?: string
          public_id?: number
          rent_basis?: Database["public"]["Enums"]["rent_basis_enum"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_plan_services_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plan_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plans: {
        Row: {
          amount_type: Database["public"]["Enums"]["plan_amount_type"]
          created_at: string | null
          default_fee_amount: number | null
          default_fee_percent: number | null
          gl_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          percent_basis:
            | Database["public"]["Enums"]["plan_percent_basis"]
            | null
          public_id: number
          updated_at: string | null
        }
        Insert: {
          amount_type: Database["public"]["Enums"]["plan_amount_type"]
          created_at?: string | null
          default_fee_amount?: number | null
          default_fee_percent?: number | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          percent_basis?:
            | Database["public"]["Enums"]["plan_percent_basis"]
            | null
          public_id?: number
          updated_at?: string | null
        }
        Update: {
          amount_type?: Database["public"]["Enums"]["plan_amount_type"]
          created_at?: string | null
          default_fee_amount?: number | null
          default_fee_percent?: number | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          percent_basis?:
            | Database["public"]["Enums"]["plan_percent_basis"]
            | null
          public_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_plans_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          buildium_staff_id: number | null
          buildium_user_id: number | null
          created_at: string
          email: string | null
          first_name: string | null
          id: number
          is_active: boolean
          last_name: string | null
          phone: string | null
          public_id: number
          role: Database["public"]["Enums"]["staff_roles"]
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          buildium_staff_id?: number | null
          buildium_user_id?: number | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          public_id?: number
          role?: Database["public"]["Enums"]["staff_roles"]
          title?: string | null
          updated_at: string
          user_id?: string | null
        }
        Update: {
          buildium_staff_id?: number | null
          buildium_user_id?: number | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          public_id?: number
          role?: Database["public"]["Enums"]["staff_roles"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      statement_emails: {
        Row: {
          created_at: string
          email_provider_id: string | null
          error_message: string | null
          id: string
          monthly_log_id: string
          pdf_url: string | null
          public_id: number
          recipients: Json
          sent_at: string
          sent_by_user_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email_provider_id?: string | null
          error_message?: string | null
          id?: string
          monthly_log_id: string
          pdf_url?: string | null
          public_id?: number
          recipients: Json
          sent_at?: string
          sent_by_user_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email_provider_id?: string | null
          error_message?: string | null
          id?: string
          monthly_log_id?: string
          pdf_url?: string | null
          public_id?: number
          recipients?: Json
          sent_at?: string
          sent_by_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_emails_monthly_log_id_fkey"
            columns: ["monthly_log_id"]
            isOneToOne: false
            referencedRelation: "monthly_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_operations: {
        Row: {
          attempts: number
          buildium_id: number
          created_at: string | null
          data: Json
          dependencies: string[] | null
          entity: string
          error: string | null
          id: string
          last_attempt: string | null
          local_id: string | null
          org_id: string | null
          public_id: number
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          buildium_id: number
          created_at?: string | null
          data: Json
          dependencies?: string[] | null
          entity: string
          error?: string | null
          id?: string
          last_attempt?: string | null
          local_id?: string | null
          org_id?: string | null
          public_id?: number
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          buildium_id?: number
          created_at?: string | null
          data?: Json
          dependencies?: string[] | null
          entity?: string
          error?: string | null
          id?: string
          last_attempt?: string | null
          local_id?: string | null
          org_id?: string | null
          public_id?: number
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_operations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          buildium_category_id: number | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          public_id: number
          updated_at: string | null
        }
        Insert: {
          buildium_category_id?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          public_id?: number
          updated_at?: string | null
        }
        Update: {
          buildium_category_id?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          public_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_categories_parent_fk"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          assigned_to: string | null
          buildium_history_id: number | null
          completed_date: string | null
          created_at: string | null
          id: string
          notes: string | null
          public_id: number
          status: string
          task_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          buildium_history_id?: number | null
          completed_date?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          public_id?: number
          status: string
          task_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          buildium_history_id?: number | null
          completed_date?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          public_id?: number
          status?: string
          task_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          assigned_to_staff_id: number | null
          buildium_assigned_to_user_id: number | null
          buildium_lease_id: number | null
          buildium_owner_id: number | null
          buildium_property_id: number | null
          buildium_task_id: number | null
          buildium_tenant_id: number | null
          buildium_unit_id: number | null
          category: string | null
          completed_date: string | null
          condition_snapshot: Json | null
          created_at: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          lease_id: number | null
          monthly_log_id: string | null
          monthly_log_rule_id: string | null
          notes: string | null
          owner_id: string | null
          priority: string | null
          property_id: string | null
          public_id: number
          requested_by_buildium_id: number | null
          requested_by_contact_id: number | null
          requested_by_type: string | null
          scheduled_date: string | null
          source: Database["public"]["Enums"]["task_source_enum"] | null
          status: string | null
          subcategory: string | null
          subject: string
          task_category_id: string | null
          task_kind: Database["public"]["Enums"]["task_kind_enum"] | null
          tenant_id: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          assigned_to_staff_id?: number | null
          buildium_assigned_to_user_id?: number | null
          buildium_lease_id?: number | null
          buildium_owner_id?: number | null
          buildium_property_id?: number | null
          buildium_task_id?: number | null
          buildium_tenant_id?: number | null
          buildium_unit_id?: number | null
          category?: string | null
          completed_date?: string | null
          condition_snapshot?: Json | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          lease_id?: number | null
          monthly_log_id?: string | null
          monthly_log_rule_id?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          public_id?: number
          requested_by_buildium_id?: number | null
          requested_by_contact_id?: number | null
          requested_by_type?: string | null
          scheduled_date?: string | null
          source?: Database["public"]["Enums"]["task_source_enum"] | null
          status?: string | null
          subcategory?: string | null
          subject: string
          task_category_id?: string | null
          task_kind?: Database["public"]["Enums"]["task_kind_enum"] | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          assigned_to_staff_id?: number | null
          buildium_assigned_to_user_id?: number | null
          buildium_lease_id?: number | null
          buildium_owner_id?: number | null
          buildium_property_id?: number | null
          buildium_task_id?: number | null
          buildium_tenant_id?: number | null
          buildium_unit_id?: number | null
          category?: string | null
          completed_date?: string | null
          condition_snapshot?: Json | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          lease_id?: number | null
          monthly_log_id?: string | null
          monthly_log_rule_id?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          public_id?: number
          requested_by_buildium_id?: number | null
          requested_by_contact_id?: number | null
          requested_by_type?: string | null
          scheduled_date?: string | null
          source?: Database["public"]["Enums"]["task_source_enum"] | null
          status?: string | null
          subcategory?: string | null
          subject?: string
          task_category_id?: string | null
          task_kind?: Database["public"]["Enums"]["task_kind_enum"] | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_staff_fk"
            columns: ["assigned_to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lease_fk"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_monthly_log_id_fkey"
            columns: ["monthly_log_id"]
            isOneToOne: false
            referencedRelation: "monthly_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_monthly_log_rule_id_fkey"
            columns: ["monthly_log_rule_id"]
            isOneToOne: false
            referencedRelation: "monthly_log_task_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_fk"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "tasks_requested_by_contact_fk"
            columns: ["requested_by_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_requested_by_contact_fk"
            columns: ["requested_by_contact_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "tasks_subcategory_fkey"
            columns: ["subcategory"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_category_fk"
            columns: ["task_category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notes: {
        Row: {
          buildium_created_at: string | null
          buildium_note_id: number | null
          buildium_tenant_id: number | null
          buildium_updated_at: string | null
          created_at: string
          id: string
          note: string | null
          public_id: number
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          buildium_created_at?: string | null
          buildium_note_id?: number | null
          buildium_tenant_id?: number | null
          buildium_updated_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          public_id?: number
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          buildium_created_at?: string | null
          buildium_note_id?: number | null
          buildium_tenant_id?: number | null
          buildium_updated_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          public_id?: number
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          buildium_tenant_id: number | null
          comment: string | null
          contact_id: number
          created_at: string
          emergency_contact_email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          id: string
          org_id: string | null
          public_id: number
          sms_opt_in_status: boolean | null
          tax_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          buildium_tenant_id?: number | null
          comment?: string | null
          contact_id: number
          created_at?: string
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          id?: string
          org_id?: string | null
          public_id?: number
          sms_opt_in_status?: boolean | null
          tax_id?: string | null
          updated_at: string
          user_id?: string | null
        }
        Update: {
          buildium_tenant_id?: number | null
          comment?: string | null
          contact_id?: number
          created_at?: string
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          id?: string
          org_id?: string | null
          public_id?: number
          sms_opt_in_status?: boolean | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "tenants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_files: {
        Row: {
          added_by: string | null
          created_at: string
          file_id: string
          id: string
          org_id: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          file_id: string
          id?: string
          org_id: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          file_id?: string
          id?: string
          org_id?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_files_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_files_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_files_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_files_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "transaction_files_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      transaction_lines: {
        Row: {
          account_entity_id: number | null
          account_entity_type: Database["public"]["Enums"]["entity_type_enum"]
          accounting_entity_type_raw: string | null
          amount: number | null
          applied_period_start: string | null
          buildium_lease_id: number | null
          buildium_property_id: number | null
          buildium_unit_id: number | null
          created_at: string
          date: string
          gl_account_id: string | null
          id: string
          is_cash_posting: boolean | null
          lease_id: number | null
          memo: string | null
          posting_type: string
          property_id: string | null
          public_id: number
          reference_number: string | null
          transaction_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_entity_id?: number | null
          account_entity_type?: Database["public"]["Enums"]["entity_type_enum"]
          accounting_entity_type_raw?: string | null
          amount?: number | null
          applied_period_start?: string | null
          buildium_lease_id?: number | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          created_at?: string
          date: string
          gl_account_id?: string | null
          id?: string
          is_cash_posting?: boolean | null
          lease_id?: number | null
          memo?: string | null
          posting_type: string
          property_id?: string | null
          public_id?: number
          reference_number?: string | null
          transaction_id?: string | null
          unit_id?: string | null
          updated_at: string
        }
        Update: {
          account_entity_id?: number | null
          account_entity_type?: Database["public"]["Enums"]["entity_type_enum"]
          accounting_entity_type_raw?: string | null
          amount?: number | null
          applied_period_start?: string | null
          buildium_lease_id?: number | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          created_at?: string
          date?: string
          gl_account_id?: string | null
          id?: string
          is_cash_posting?: boolean | null
          lease_id?: number | null
          memo?: string | null
          posting_type?: string
          property_id?: string | null
          public_id?: number
          reference_number?: string | null
          transaction_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "journal_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payment_transactions: {
        Row: {
          accounting_entity_href: string | null
          accounting_entity_id: number | null
          accounting_entity_type: string | null
          accounting_unit_href: string | null
          accounting_unit_id: number | null
          amount: number | null
          buildium_payment_transaction_id: number | null
          created_at: string
          id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          accounting_entity_href?: string | null
          accounting_entity_id?: number | null
          accounting_entity_type?: string | null
          accounting_unit_href?: string | null
          accounting_unit_id?: number | null
          amount?: number | null
          buildium_payment_transaction_id?: number | null
          created_at?: string
          id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          accounting_entity_href?: string | null
          accounting_entity_id?: number | null
          accounting_entity_type?: string | null
          accounting_unit_href?: string | null
          accounting_unit_id?: number | null
          amount?: number | null
          buildium_payment_transaction_id?: number | null
          created_at?: string
          id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payment_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payment_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payment_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payment_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "transaction_payment_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      transaction_type_sign: {
        Row: {
          public_id: number
          sign: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
        }
        Insert: {
          public_id?: number
          sign: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
        }
        Update: {
          public_id?: number
          sign?: number
          transaction_type?: Database["public"]["Enums"]["transaction_type_enum"]
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_entity_id: number | null
          account_entity_type:
            | Database["public"]["Enums"]["entity_type_enum"]
            | null
          bank_gl_account_buildium_id: number | null
          bank_gl_account_id: string | null
          bill_transaction_id: string | null
          buildium_application_id: number | null
          buildium_bill_id: number | null
          buildium_last_updated_at: string | null
          buildium_lease_id: number | null
          buildium_transaction_id: number | null
          buildium_unit_id: number | null
          buildium_unit_number: string | null
          category_id: string | null
          check_number: string | null
          created_at: string
          date: string
          due_date: string | null
          email_receipt: boolean
          fee_category: Database["public"]["Enums"]["fee_category_enum"] | null
          id: string
          idempotency_key: string | null
          internal_transaction_is_pending: boolean | null
          internal_transaction_result_code: string | null
          internal_transaction_result_date: string | null
          is_internal_transaction: boolean | null
          is_reconciled: boolean | null
          is_recurring: boolean | null
          lease_id: number | null
          legacy_memo: string | null
          locked_at: string | null
          locked_by_user_id: string | null
          locked_reason: string | null
          memo: string | null
          metadata: Json | null
          monthly_log_id: string | null
          org_id: string
          paid_by_accounting_entity_href: string | null
          paid_by_accounting_entity_id: number | null
          paid_by_accounting_entity_type: string | null
          paid_by_accounting_unit_href: string | null
          paid_by_accounting_unit_id: number | null
          paid_by_label: string | null
          paid_date: string | null
          paid_to_buildium_id: number | null
          paid_to_href: string | null
          paid_to_name: string | null
          paid_to_tenant_id: string | null
          paid_to_type: string | null
          paid_to_vendor_id: string | null
          payee_buildium_id: number | null
          payee_buildium_type: string | null
          payee_href: string | null
          payee_name: string | null
          payee_tenant_id: number | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_method_raw: string | null
          plan_id: Database["public"]["Enums"]["service_plan_enum"] | null
          print_receipt: boolean
          property_id: string | null
          public_id: number
          recurring_schedule: Json | null
          reference_number: string | null
          reversal_of_transaction_id: string | null
          service_offering_id: string | null
          status: Database["public"]["Enums"]["transaction_status_enum"]
          tenant_id: string | null
          total_amount: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
          unit_agreement_href: string | null
          unit_agreement_id: number | null
          unit_agreement_type: string | null
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
          work_order_id: string | null
        }
        Insert: {
          account_entity_id?: number | null
          account_entity_type?:
            | Database["public"]["Enums"]["entity_type_enum"]
            | null
          bank_gl_account_buildium_id?: number | null
          bank_gl_account_id?: string | null
          bill_transaction_id?: string | null
          buildium_application_id?: number | null
          buildium_bill_id?: number | null
          buildium_last_updated_at?: string | null
          buildium_lease_id?: number | null
          buildium_transaction_id?: number | null
          buildium_unit_id?: number | null
          buildium_unit_number?: string | null
          category_id?: string | null
          check_number?: string | null
          created_at?: string
          date: string
          due_date?: string | null
          email_receipt?: boolean
          fee_category?: Database["public"]["Enums"]["fee_category_enum"] | null
          id?: string
          idempotency_key?: string | null
          internal_transaction_is_pending?: boolean | null
          internal_transaction_result_code?: string | null
          internal_transaction_result_date?: string | null
          is_internal_transaction?: boolean | null
          is_reconciled?: boolean | null
          is_recurring?: boolean | null
          lease_id?: number | null
          legacy_memo?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          locked_reason?: string | null
          memo?: string | null
          metadata?: Json | null
          monthly_log_id?: string | null
          org_id: string
          paid_by_accounting_entity_href?: string | null
          paid_by_accounting_entity_id?: number | null
          paid_by_accounting_entity_type?: string | null
          paid_by_accounting_unit_href?: string | null
          paid_by_accounting_unit_id?: number | null
          paid_by_label?: string | null
          paid_date?: string | null
          paid_to_buildium_id?: number | null
          paid_to_href?: string | null
          paid_to_name?: string | null
          paid_to_tenant_id?: string | null
          paid_to_type?: string | null
          paid_to_vendor_id?: string | null
          payee_buildium_id?: number | null
          payee_buildium_type?: string | null
          payee_href?: string | null
          payee_name?: string | null
          payee_tenant_id?: number | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_method_raw?: string | null
          plan_id?: Database["public"]["Enums"]["service_plan_enum"] | null
          print_receipt?: boolean
          property_id?: string | null
          public_id?: number
          recurring_schedule?: Json | null
          reference_number?: string | null
          reversal_of_transaction_id?: string | null
          service_offering_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status_enum"]
          tenant_id?: string | null
          total_amount?: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
          unit_agreement_href?: string | null
          unit_agreement_id?: number | null
          unit_agreement_type?: string | null
          unit_id?: string | null
          updated_at: string
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          account_entity_id?: number | null
          account_entity_type?:
            | Database["public"]["Enums"]["entity_type_enum"]
            | null
          bank_gl_account_buildium_id?: number | null
          bank_gl_account_id?: string | null
          bill_transaction_id?: string | null
          buildium_application_id?: number | null
          buildium_bill_id?: number | null
          buildium_last_updated_at?: string | null
          buildium_lease_id?: number | null
          buildium_transaction_id?: number | null
          buildium_unit_id?: number | null
          buildium_unit_number?: string | null
          category_id?: string | null
          check_number?: string | null
          created_at?: string
          date?: string
          due_date?: string | null
          email_receipt?: boolean
          fee_category?: Database["public"]["Enums"]["fee_category_enum"] | null
          id?: string
          idempotency_key?: string | null
          internal_transaction_is_pending?: boolean | null
          internal_transaction_result_code?: string | null
          internal_transaction_result_date?: string | null
          is_internal_transaction?: boolean | null
          is_reconciled?: boolean | null
          is_recurring?: boolean | null
          lease_id?: number | null
          legacy_memo?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          locked_reason?: string | null
          memo?: string | null
          metadata?: Json | null
          monthly_log_id?: string | null
          org_id?: string
          paid_by_accounting_entity_href?: string | null
          paid_by_accounting_entity_id?: number | null
          paid_by_accounting_entity_type?: string | null
          paid_by_accounting_unit_href?: string | null
          paid_by_accounting_unit_id?: number | null
          paid_by_label?: string | null
          paid_date?: string | null
          paid_to_buildium_id?: number | null
          paid_to_href?: string | null
          paid_to_name?: string | null
          paid_to_tenant_id?: string | null
          paid_to_type?: string | null
          paid_to_vendor_id?: string | null
          payee_buildium_id?: number | null
          payee_buildium_type?: string | null
          payee_href?: string | null
          payee_name?: string | null
          payee_tenant_id?: number | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_method_raw?: string | null
          plan_id?: Database["public"]["Enums"]["service_plan_enum"] | null
          print_receipt?: boolean
          property_id?: string | null
          public_id?: number
          recurring_schedule?: Json | null
          reference_number?: string | null
          reversal_of_transaction_id?: string | null
          service_offering_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status_enum"]
          tenant_id?: string | null
          total_amount?: number
          transaction_type?: Database["public"]["Enums"]["transaction_type_enum"]
          unit_agreement_href?: string | null
          unit_agreement_id?: number | null
          unit_agreement_type?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "bill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_monthly_log_id_fkey"
            columns: ["monthly_log_id"]
            isOneToOne: false
            referencedRelation: "monthly_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paid_to_tenant_id_fkey"
            columns: ["paid_to_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paid_to_vendor_id_fkey"
            columns: ["paid_to_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transactions_service_offering_id_fkey"
            columns: ["service_offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_active_work_orders_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_images: {
        Row: {
          buildium_image_id: number | null
          created_at: string
          description: string | null
          file_size: number | null
          file_type: string | null
          href: string | null
          id: string
          is_private: boolean | null
          name: string | null
          public_id: number
          sort_index: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          buildium_image_id?: number | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          href?: string | null
          id?: string
          is_private?: boolean | null
          name?: string | null
          public_id?: number
          sort_index?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          buildium_image_id?: number | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          href?: string | null
          id?: string
          is_private?: boolean | null
          name?: string | null
          public_id?: number
          sort_index?: number | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_images_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_notes: {
        Row: {
          body: string | null
          buildium_note_id: number
          created_at: string
          id: string
          is_private: boolean | null
          public_id: number
          subject: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          buildium_note_id: number
          created_at?: string
          id?: string
          is_private?: boolean | null
          public_id?: number
          subject?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          buildium_note_id?: number
          created_at?: string
          id?: string
          is_private?: boolean | null
          public_id?: number
          subject?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_notes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_line3: string | null
          balance: number | null
          balance_updated_at: string | null
          bill_administration:
            | Database["public"]["Enums"]["bill_administration_option"][]
            | null
          bill_administration_notes: string | null
          bill_pay_list: string | null
          bill_pay_notes: string | null
          building_name: string | null
          buildium_created_at: string | null
          buildium_property_id: number | null
          buildium_unit_id: number | null
          buildium_updated_at: string | null
          city: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at: string
          deposits_held_balance: number | null
          description: string | null
          id: string
          is_active: boolean | null
          last_inspection_date: string | null
          market_rent: number | null
          next_inspection_date: string | null
          org_id: string
          postal_code: string
          prepayments_balance: number | null
          property_id: string
          public_id: number
          service_end: string | null
          service_start: string | null
          state: string | null
          status: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_name: string | null
          unit_number: string
          unit_size: number | null
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_line3?: string | null
          balance?: number | null
          balance_updated_at?: string | null
          bill_administration?:
            | Database["public"]["Enums"]["bill_administration_option"][]
            | null
          bill_administration_notes?: string | null
          bill_pay_list?: string | null
          bill_pay_notes?: string | null
          building_name?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposits_held_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_inspection_date?: string | null
          market_rent?: number | null
          next_inspection_date?: string | null
          org_id: string
          postal_code: string
          prepayments_balance?: number | null
          property_id: string
          public_id?: number
          service_end?: string | null
          service_start?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms?: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms?: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_name?: string | null
          unit_number: string
          unit_size?: number | null
          unit_type?: string | null
          updated_at: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_line3?: string | null
          balance?: number | null
          balance_updated_at?: string | null
          bill_administration?:
            | Database["public"]["Enums"]["bill_administration_option"][]
            | null
          bill_administration_notes?: string | null
          bill_pay_list?: string | null
          bill_pay_notes?: string | null
          building_name?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country?: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposits_held_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_inspection_date?: string | null
          market_rent?: number | null
          next_inspection_date?: string | null
          org_id?: string
          postal_code?: string
          prepayments_balance?: number | null
          property_id?: string
          public_id?: number
          service_end?: string | null
          service_start?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms?: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms?: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_name?: string | null
          unit_number?: string
          unit_size?: number | null
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      vendor_categories: {
        Row: {
          buildium_category_id: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          public_id: number
          updated_at: string | null
        }
        Insert: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          public_id?: number
          updated_at?: string | null
        }
        Update: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          public_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          account_number: string | null
          buildium_category_id: number | null
          buildium_vendor_id: number | null
          contact_id: number
          created_at: string | null
          expense_gl_account_id: number | null
          gl_account: string | null
          id: string
          include_1099: boolean | null
          insurance_expiration_date: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          is_active: boolean | null
          notes: string | null
          payment_terms_days: number | null
          public_id: number
          tax_address_city: string | null
          tax_address_country: string | null
          tax_address_line1: string | null
          tax_address_line2: string | null
          tax_address_line3: string | null
          tax_address_postal_code: string | null
          tax_address_state: string | null
          tax_id: string | null
          tax_payer_name1: string | null
          tax_payer_name2: string | null
          tax_payer_type: Database["public"]["Enums"]["tax_payer_type"] | null
          updated_at: string | null
          vendor_category: string | null
          website: string | null
        }
        Insert: {
          account_number?: string | null
          buildium_category_id?: number | null
          buildium_vendor_id?: number | null
          contact_id: number
          created_at?: string | null
          expense_gl_account_id?: number | null
          gl_account?: string | null
          id?: string
          include_1099?: boolean | null
          insurance_expiration_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean | null
          notes?: string | null
          payment_terms_days?: number | null
          public_id?: number
          tax_address_city?: string | null
          tax_address_country?: string | null
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_address_postal_code?: string | null
          tax_address_state?: string | null
          tax_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?: Database["public"]["Enums"]["tax_payer_type"] | null
          updated_at?: string | null
          vendor_category?: string | null
          website?: string | null
        }
        Update: {
          account_number?: string | null
          buildium_category_id?: number | null
          buildium_vendor_id?: number | null
          contact_id?: number
          created_at?: string | null
          expense_gl_account_id?: number | null
          gl_account?: string | null
          id?: string
          include_1099?: boolean | null
          insurance_expiration_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean | null
          notes?: string | null
          payment_terms_days?: number | null
          public_id?: number
          tax_address_city?: string | null
          tax_address_country?: string | null
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_address_postal_code?: string | null
          tax_address_state?: string | null
          tax_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?: Database["public"]["Enums"]["tax_payer_type"] | null
          updated_at?: string | null
          vendor_category?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "vendors_gl_account_fkey"
            columns: ["gl_account"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_vendor_category_fkey"
            columns: ["vendor_category"]
            isOneToOne: false
            referencedRelation: "vendor_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_event_flags: {
        Row: {
          created_at: string
          enabled: boolean
          event_type: string
          public_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_type: string
          public_id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_type?: string
          public_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          buildium_work_order_id: number | null
          category: string | null
          completed_date: string | null
          created_at: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          notes: string | null
          org_id: string | null
          priority: string | null
          property_id: string | null
          public_id: number
          scheduled_date: string | null
          status: string | null
          subject: string
          unit_id: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          buildium_work_order_id?: number | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          priority?: string | null
          property_id?: string | null
          public_id?: number
          scheduled_date?: string | null
          status?: string | null
          subject: string
          unit_id?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          buildium_work_order_id?: number | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          priority?: string | null
          property_id?: string | null
          public_id?: number
          scheduled_date?: string | null
          status?: string | null
          subject?: string
          unit_id?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      column_info_cache: {
        Row: {
          comment: string | null
          data_type: string | null
          default_value: string | null
          format: unknown
          id: string | null
          is_identity: boolean | null
          is_nullable: boolean | null
          name: unknown
          ordinal_position: number | null
          schema: unknown
          table_id: number | null
          table_name: unknown
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          normalized_event_type: string | null
          normalized_result_code: string | null
          occurred_at: string | null
          org_id: string | null
          payment_id: string | null
          payment_intent_id: string | null
          provider: string | null
          raw_event_type: string | null
          raw_result_code: string | null
          source_event_id: string | null
        }
        Relationships: []
      }
      payment_lifecycle_projection: {
        Row: {
          amount: number | null
          chargeback_id: string | null
          created_at: string | null
          derived_normalized_state: string | null
          derived_settled_at: string | null
          disputed_at: string | null
          gateway_transaction_id: string | null
          id: string | null
          internal_transaction_is_pending: boolean | null
          internal_transaction_result_date: string | null
          is_internal_transaction: boolean | null
          normalized_result_code: string | null
          normalized_return_reason_code: string | null
          normalized_state: string | null
          org_id: string | null
          payer_id: string | null
          payer_type: string | null
          payment_intent_id: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          raw_result_code: string | null
          raw_return_reason_code: string | null
          returned_at: string | null
          settled_at: string | null
          state: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intent_fk"
            columns: ["org_id", "payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intent"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "payment_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "payment_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      table_info_cache: {
        Row: {
          bytes: number | null
          comment: string | null
          dead_rows_estimate: number | null
          id: number | null
          live_rows_estimate: number | null
          name: unknown
          rls_enabled: boolean | null
          rls_forced: boolean | null
          schema: unknown
          size: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          contact_email: string | null
          contact_id: number | null
          contact_phone: string | null
          currency: string | null
          date_format: string | null
          display_name: string | null
          email: string | null
          favorite_properties: string[] | null
          first_name: string | null
          full_name: string | null
          landing_page: string | null
          last_name: string | null
          locale: string | null
          notification_preferences: Json | null
          number_format: string | null
          personal_integrations: Json | null
          phone: string | null
          primary_work_role: string | null
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_active_work_orders_ranked: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          buildium_work_order_id: number | null
          category: string | null
          completed_date: string | null
          created_at: string | null
          description: string | null
          estimated_cost: number | null
          id: string | null
          notes: string | null
          org_id: string | null
          priority: string | null
          property_id: string | null
          rn: number | null
          scheduled_date: string | null
          status: string | null
          subject: string | null
          unit_id: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ar_gl_balance: {
        Row: {
          ar_gl_balance: number | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ar_receivables: {
        Row: {
          amount_open_total: number | null
          lease_id: number | null
          oldest_due_date: string | null
          open_charge_count: number | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ar_reconciliation: {
        Row: {
          ar_gl_balance: number | null
          ar_subledger_balance: number | null
          org_id: string | null
          variance: number | null
        }
        Relationships: []
      }
      v_ar_subledger: {
        Row: {
          ar_subledger_balance: number | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bank_register_transactions: {
        Row: {
          bank_amount: number | null
          bank_entry_status:
            | Database["public"]["Enums"]["bank_entry_status_enum"]
            | null
          bank_gl_account_id: string | null
          bank_posting_type: string | null
          cleared_at: string | null
          current_reconciliation_log_id: string | null
          date: string | null
          id: string | null
          is_transfer: boolean | null
          memo: string | null
          paid_by_label: string | null
          paid_to_buildium_id: number | null
          paid_to_name: string | null
          paid_to_type: string | null
          payee_buildium_id: number | null
          payee_buildium_type: string | null
          payee_name: string | null
          reconciled_at: string | null
          reference_number: string | null
          total_amount: number | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type_enum"]
            | null
          transfer_other_bank_gl_account_id: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_dashboard_kpis: {
        Row: {
          active_leases: number | null
          available_units: number | null
          growth_rate: number | null
          monthly_rent_roll: number | null
          occupancy_rate: number | null
          occupied_units: number | null
          open_work_orders: number | null
          org_id: string | null
          total_properties: number | null
          total_units: number | null
          urgent_work_orders: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lease_renewals_summary: {
        Row: {
          critical: number | null
          future: number | null
          org_id: string | null
          upcoming: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recent_transactions_ranked: {
        Row: {
          bank_gl_account_id: string | null
          buildium_bill_id: number | null
          buildium_lease_id: number | null
          buildium_transaction_id: number | null
          category_id: string | null
          check_number: string | null
          created_at: string | null
          date: string | null
          due_date: string | null
          email_receipt: boolean | null
          fee_category: Database["public"]["Enums"]["fee_category_enum"] | null
          id: string | null
          is_recurring: boolean | null
          lease_id: number | null
          legacy_memo: string | null
          memo: string | null
          monthly_log_id: string | null
          org_id: string | null
          paid_date: string | null
          payee_tenant_id: number | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          plan_id: Database["public"]["Enums"]["service_plan_enum"] | null
          print_receipt: boolean | null
          recurring_schedule: Json | null
          reference_number: string | null
          rn: number | null
          service_offering_id: string | null
          status: Database["public"]["Enums"]["transaction_status_enum"] | null
          total_amount: number | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type_enum"]
            | null
          updated_at: string | null
          vendor_id: string | null
          work_order_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "bill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_monthly_log_id_fkey"
            columns: ["monthly_log_id"]
            isOneToOne: false
            referencedRelation: "monthly_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_service_offering_id_fkey"
            columns: ["service_offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_active_work_orders_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reconciliation_transactions: {
        Row: {
          bank_amount: number | null
          bank_gl_account_id: string | null
          bank_posting_type: string | null
          cleared_at: string | null
          entry_date: string | null
          locked_at: string | null
          reconciled_at: string | null
          reconciliation_id: string | null
          statement_ending_date: string | null
          statement_start_date: string | null
          status: Database["public"]["Enums"]["bank_entry_status_enum"] | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_register_state_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "bank_register_state_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      v_reconciliation_variance_alerts: {
        Row: {
          as_of: string | null
          gl_account_id: string | null
          over_24h: boolean | null
          property_id: string | null
          variance: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      v_reconciliation_variances: {
        Row: {
          as_of: string | null
          buildium_ending_balance: number | null
          gl_account_id: string | null
          ledger_balance: number | null
          property_id: string | null
          variance: number | null
        }
        Insert: {
          as_of?: string | null
          buildium_ending_balance?: number | null
          gl_account_id?: string | null
          ledger_balance?: never
          property_id?: string | null
          variance?: never
        }
        Update: {
          as_of?: string | null
          buildium_ending_balance?: number | null
          gl_account_id?: string | null
          ledger_balance?: never
          property_id?: string | null
          variance?: never
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      v_rent_roll_current_month: {
        Row: {
          org_id: string | null
          rent_roll_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rent_roll_previous_month: {
        Row: {
          org_id: string | null
          rent_roll_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_service_costs: {
        Row: {
          hourly_cost_amount: number | null
          job_cost_amount: number | null
          offering_id: string | null
          org_id: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          total_cost_amount: number | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "billing_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_service_profitability: {
        Row: {
          cost_amount: number | null
          margin_amount: number | null
          margin_percentage: number | null
          offering_id: string | null
          org_id: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          revenue_amount: number | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "billing_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_service_revenue_by_offering: {
        Row: {
          category: string | null
          offering_id: string | null
          offering_name: string | null
          org_id: string | null
          period_end: string | null
          period_start: string | null
          property_count: number | null
          revenue_amount: number | null
          unit_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      v_service_revenue_by_owner: {
        Row: {
          offering_id: string | null
          org_id: string | null
          owner_id: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          revenue_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownerships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      v_service_revenue_by_property: {
        Row: {
          billing_event_count: number | null
          offering_id: string | null
          org_id: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          revenue_amount: number | null
          unit_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
        ]
      }
      v_service_revenue_by_unit: {
        Row: {
          billing_event_count: number | null
          offering_id: string | null
          org_id: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          revenue_amount: number | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "billing_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_transaction_with_reversal: {
        Row: {
          account_entity_id: number | null
          account_entity_type:
            | Database["public"]["Enums"]["entity_type_enum"]
            | null
          bank_gl_account_buildium_id: number | null
          bank_gl_account_id: string | null
          bill_transaction_id: string | null
          buildium_application_id: number | null
          buildium_bill_id: number | null
          buildium_last_updated_at: string | null
          buildium_lease_id: number | null
          buildium_transaction_id: number | null
          buildium_unit_id: number | null
          buildium_unit_number: string | null
          category_id: string | null
          check_number: string | null
          created_at: string | null
          date: string | null
          due_date: string | null
          email_receipt: boolean | null
          fee_category: Database["public"]["Enums"]["fee_category_enum"] | null
          id: string | null
          idempotency_key: string | null
          internal_transaction_is_pending: boolean | null
          internal_transaction_result_code: string | null
          internal_transaction_result_date: string | null
          is_internal_transaction: boolean | null
          is_recurring: boolean | null
          lease_id: number | null
          legacy_memo: string | null
          locked_at: string | null
          locked_by_user_id: string | null
          locked_reason: string | null
          memo: string | null
          monthly_log_id: string | null
          org_id: string | null
          paid_by_accounting_entity_href: string | null
          paid_by_accounting_entity_id: number | null
          paid_by_accounting_entity_type: string | null
          paid_by_accounting_unit_href: string | null
          paid_by_accounting_unit_id: number | null
          paid_by_label: string | null
          paid_date: string | null
          paid_to_buildium_id: number | null
          paid_to_href: string | null
          paid_to_name: string | null
          paid_to_tenant_id: string | null
          paid_to_type: string | null
          paid_to_vendor_id: string | null
          payee_buildium_id: number | null
          payee_buildium_type: string | null
          payee_href: string | null
          payee_name: string | null
          payee_tenant_id: number | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_method_raw: string | null
          plan_id: Database["public"]["Enums"]["service_plan_enum"] | null
          print_receipt: boolean | null
          property_id: string | null
          public_id: number | null
          recurring_schedule: Json | null
          reference_number: string | null
          reversal_date: string | null
          reversal_id: string | null
          reversal_locked_at: string | null
          reversal_memo: string | null
          reversal_of_transaction_id: string | null
          service_offering_id: string | null
          status: Database["public"]["Enums"]["transaction_status_enum"] | null
          tenant_id: string | null
          total_amount: number | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type_enum"]
            | null
          unit_agreement_href: string | null
          unit_agreement_id: number | null
          unit_agreement_type: string | null
          unit_id: string | null
          updated_at: string | null
          vendor_id: string | null
          work_order_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "transactions_bill_transaction_id_fkey"
            columns: ["bill_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "bill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "lease"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_monthly_log_id_fkey"
            columns: ["monthly_log_id"]
            isOneToOne: false
            referencedRelation: "monthly_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paid_to_tenant_id_fkey"
            columns: ["paid_to_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paid_to_vendor_id_fkey"
            columns: ["paid_to_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_transaction_with_reversal"
            referencedColumns: ["reversal_id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_undeposited_payments"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transactions_service_offering_id_fkey"
            columns: ["service_offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "v_active_work_orders_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      v_udf_warnings: {
        Row: {
          avg_age_days: number | null
          max_age_days: number | null
          org_id: string | null
          payment_count: number | null
          total_amount: number | null
          warning_level: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_undeposited_payments: {
        Row: {
          age_days: number | null
          is_undeposited: boolean | null
          memo: string | null
          org_id: string | null
          paid_to_tenant_id: string | null
          payment_date: string | null
          tenant_id: string | null
          total_amount: number | null
          transaction_id: string | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type_enum"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paid_to_tenant_id_fkey"
            columns: ["paid_to_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _column_exists: {
        Args: { p_column: string; p_schema: string; p_table: string }
        Returns: boolean
      }
      _parse_bool: { Args: { p_value: string }; Returns: boolean }
      _parse_date: { Args: { p_value: string }; Returns: string }
      _parse_timestamptz: { Args: { p_value: string }; Returns: string }
      acquire_compliance_lock: { Args: { lock_key: string }; Returns: boolean }
      backfill_deposit_items_from_transaction_payment_transactions: {
        Args: never
        Returns: number
      }
      backfill_deposit_meta_from_transactions: { Args: never; Returns: number }
      calculate_book_balance: {
        Args: {
          p_as_of?: string
          p_bank_gl_account_id: string
          p_org_id?: string
        }
        Returns: number
      }
      calculate_owner_total_properties: {
        Args: { owner_uuid: string }
        Returns: number
      }
      calculate_owner_total_units: {
        Args: { owner_uuid: string }
        Returns: number
      }
      calculate_vendor_1099_total: {
        Args: { p_tax_year: number; p_vendor_id: string }
        Returns: number
      }
      check_payment_reconciliation_status: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
      cleanup_audit_logs: { Args: never; Returns: undefined }
      clear_expired_buildium_cache: { Args: never; Returns: number }
      count_active_units_for_property: {
        Args: { property_uuid: string }
        Returns: number
      }
      delete_transaction_safe: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      enforce_same_org: {
        Args: { child_name: string; child_org: string; parent_org: string }
        Returns: undefined
      }
      ensure_public_ids: {
        Args: { target_schema?: string }
        Returns: undefined
      }
      find_duplicate_buildium_ids: {
        Args: { buildium_field: string; table_name: string }
        Returns: {
          buildium_id: number
          count: number
        }[]
      }
      find_duplicate_ownerships: {
        Args: never
        Returns: {
          count: number
          owner_id: string
          property_id: string
        }[]
      }
      find_duplicate_units: {
        Args: never
        Returns: {
          count: number
          property_id: string
          unit_number: string
        }[]
      }
      fn_calculate_transaction_total: {
        Args: { p_transaction_id: string }
        Returns: number
      }
      fn_create_lease_aggregate: { Args: { payload: Json }; Returns: Json }
      fn_create_lease_full: {
        Args: { new_people?: Json; payload: Json }
        Returns: Json
      }
      fn_recalculate_property_financials: {
        Args: { p_property_id: string }
        Returns: undefined
      }
      fn_recalculate_unit_financials: {
        Args: { p_unit_id: string }
        Returns: undefined
      }
      generate_deposit_id: {
        Args: { transaction_id_param: string }
        Returns: string
      }
      generate_display_name: {
        Args: { company_name: string; first_name: string; last_name: string }
        Returns: string
      }
      generate_public_id: { Args: { target_table: string }; Returns: unknown }
      get_buildium_api_cache: {
        Args: { p_endpoint: string; p_parameters?: Json }
        Returns: Json
      }
      get_foreign_keys: {
        Args: { p_schema?: string }
        Returns: {
          constraint_name: string
          source_column: string
          source_table: string
          target_column: string
          target_table: string
        }[]
      }
      get_my_claims: { Args: never; Returns: Json }
      get_property_financials: {
        Args: { p_as_of?: string; p_property_id: string }
        Returns: Json
      }
      get_property_summary: { Args: { p_property_id: string }; Returns: Json }
      get_table_columns: {
        Args: { p_schema?: string; p_table_name: string }
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          is_identity: boolean
          is_nullable: boolean
        }[]
      }
      get_table_stats: {
        Args: { p_schema?: string }
        Returns: {
          index_size: string
          row_count: number
          table_name: string
          table_size: string
          total_size: string
        }[]
      }
      gl_account_activity:
        | {
            Args: { p_from: string; p_to: string }
            Returns: {
              account_number: string
              credits: number
              debits: number
              gl_account_id: string
              name: string
              net_change: number
            }[]
          }
        | {
            Args: {
              p_from: string
              p_gl_account_ids?: string[]
              p_property_id: string
              p_to: string
            }
            Returns: {
              credits: number
              debits: number
              gl_account_id: string
              gl_account_name: string
              net: number
            }[]
          }
        | {
            Args: {
              p_from: string
              p_gl_account_ids?: string[]
              p_property_id: string
              p_to: string
              p_unit_id?: string
            }
            Returns: {
              credits: number
              debits: number
              gl_account_id: string
              gl_account_name: string
              net: number
            }[]
          }
      gl_account_activity_cash_basis: {
        Args: {
          p_from: string
          p_gl_account_ids?: string[]
          p_property_id: string
          p_to: string
          p_unit_id?: string
        }
        Returns: {
          credits: number
          debits: number
          gl_account_id: string
          gl_account_name: string
          net: number
        }[]
      }
      gl_account_balance_as_of: {
        Args: {
          p_as_of: string
          p_entity_type?: Database["public"]["Enums"]["entity_type_enum"]
          p_gl_account_id: string
          p_org_id: string
          p_property_id?: string
        }
        Returns: number
      }
      gl_ledger_balance_as_of:
        | {
            Args: {
              p_as_of: string
              p_gl_account_id: string
              p_property_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_as_of: string
              p_exclude_unreconciled?: boolean
              p_gl_account_id: string
              p_property_id: string
              p_unit_id?: string
            }
            Returns: number
          }
      gl_trial_balance_as_of:
        | {
            Args: { p_as_of_date: string }
            Returns: {
              account_number: string
              balance: number
              buildium_gl_account_id: number
              credits: number
              debits: number
              gl_account_id: string
              name: string
              sub_type: string
              type: string
            }[]
          }
        | {
            Args: {
              p_as_of_date: string
              p_property_id?: string
              p_unit_id?: string
            }
            Returns: {
              account_number: string
              balance: number
              buildium_gl_account_id: number
              credits: number
              debits: number
              gl_account_id: string
              name: string
              sub_type: string
              type: string
            }[]
          }
      handle_lease_payment_webhook: {
        Args: { event_data: Json }
        Returns: undefined
      }
      handle_owner_webhook_update: {
        Args: { event_data: Json }
        Returns: undefined
      }
      handle_property_webhook_update: {
        Args: { event_data: Json }
        Returns: undefined
      }
      handle_task_status_webhook: {
        Args: { event_data: Json }
        Returns: undefined
      }
      handle_unit_webhook_update: {
        Args: { event_data: Json }
        Returns: undefined
      }
      has_permission: {
        Args: { p_org_id: string; p_permission_key: string; p_user_id: string }
        Returns: boolean
      }
      has_reconciled_bank_lines: {
        Args: { p_bank_gl_account_id?: string; p_transaction_id: string }
        Returns: boolean
      }
      identify_permissive_policies_to_consolidate: {
        Args: never
        Returns: {
          cmd: string
          policies: string[]
          policy_count: number
          table_name: string
        }[]
      }
      is_org_admin: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_admin_or_manager: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_valid_country:
        | {
            Args: { val: Database["public"]["Enums"]["countries"] }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.is_valid_country(val => text), public.is_valid_country(val => countries). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { val: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.is_valid_country(val => text), public.is_valid_country(val => countries). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      jwt_custom_claims: { Args: never; Returns: Json }
      list_1099_candidates: {
        Args: { p_tax_year: number; p_threshold?: number }
        Returns: {
          include_1099: boolean
          org_id: string
          total: number
          vendor_id: string
          vendor_name: string
        }[]
      }
      lock_transaction: {
        Args: { p_reason: string; p_transaction_id: string; p_user_id?: string }
        Returns: undefined
      }
      map_bill_to_buildium: { Args: { p_bill_id: string }; Returns: Json }
      map_event_status_to_item_status: {
        Args: {
          p_compliance_status: string
          p_event_type: Database["public"]["Enums"]["compliance_event_type"]
        }
        Returns: Database["public"]["Enums"]["compliance_item_status"]
      }
      map_owner_to_buildium: { Args: { p_owner_id: string }; Returns: Json }
      map_property_to_buildium: {
        Args: { p_property_id: string }
        Returns: Json
      }
      map_task_to_buildium: { Args: { p_task_id: string }; Returns: Json }
      map_unit_to_buildium: { Args: { p_unit_id: string }; Returns: Json }
      map_vendor_to_buildium: { Args: { p_vendor_id: string }; Returns: Json }
      map_work_order_to_buildium: {
        Args: { p_work_order_id: string }
        Returns: Json
      }
      monthly_log_transaction_bundle: {
        Args: { p_monthly_log_id: string }
        Returns: Json
      }
      normalize_country: { Args: { val: string }; Returns: string }
      post_transaction: {
        Args: {
          p_header: Json
          p_idempotency_key?: string
          p_lines: Json
          p_validate_balance?: boolean
        }
        Returns: string
      }
      process_buildium_webhook_event: {
        Args: { p_event_data: Json; p_event_id: string; p_event_type: string }
        Returns: boolean
      }
      recompute_bill_status: {
        Args: { p_bill_transaction_id: string }
        Returns: undefined
      }
      reconcile_monthly_log_balance: {
        Args: { p_monthly_log_id: string }
        Returns: undefined
      }
      refresh_schema_cache: { Args: never; Returns: undefined }
      refresh_unit_status_from_leases: {
        Args: { p_unit_id: string }
        Returns: undefined
      }
      release_compliance_lock: { Args: { lock_key: string }; Returns: boolean }
      replace_transaction_lines: {
        Args: {
          p_lines: Json
          p_transaction_id: string
          p_validate_balance?: boolean
        }
        Returns: undefined
      }
      resolve_ap_gl_account_id: { Args: { p_org_id: string }; Returns: string }
      resolve_compliance_program: {
        Args: { p_org_id: string; p_template_id: string }
        Returns: {
          applies_to: Database["public"]["Enums"]["compliance_applies_to"]
          code: string
          frequency_months: number
          id: string
          is_enabled: boolean
          jurisdiction: Database["public"]["Enums"]["compliance_jurisdiction"]
          lead_time_days: number
          name: string
          org_id: string
          severity_score: number
          template_id: string
        }[]
      }
      set_buildium_api_cache: {
        Args: {
          p_cache_duration_minutes?: number
          p_endpoint: string
          p_parameters: Json
          p_response_data: Json
        }
        Returns: undefined
      }
      set_buildium_property_id:
        | {
            Args: {
              p_buildium_property_id: number
              p_entity_id: string
              p_entity_type: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_buildium_property_id: number
              p_entity_id: string
              p_entity_type: string
            }
            Returns: undefined
          }
      update_all_owners_total_fields: { Args: never; Returns: undefined }
      update_all_properties_total_units: { Args: never; Returns: undefined }
      update_buildium_sync_status: {
        Args: {
          p_buildium_id: number
          p_entity_id: string
          p_entity_type: string
          p_error_message?: string
          p_status: string
        }
        Returns: undefined
      }
      update_owner_total_fields: {
        Args: { owner_uuid: string }
        Returns: undefined
      }
      update_property_total_units: {
        Args: { property_uuid: string }
        Returns: undefined
      }
      update_property_unit_counts: {
        Args: { property_uuid: string }
        Returns: undefined
      }
      upsert_owners_list_cache: {
        Args: { p_owner_id: string }
        Returns: undefined
      }
      upsert_property_ownerships_cache: {
        Args: { p_ownership_id: string }
        Returns: undefined
      }
      v_gl_account_balances_as_of: {
        Args: { p_as_of: string; p_org_id: string }
        Returns: {
          account_number: string
          as_of_date: string
          balance: number
          buildium_gl_account_id: number
          buildium_parent_gl_account_id: number
          credits: number
          debits: number
          exclude_from_cash_balances: boolean
          gl_account_id: string
          is_active: boolean
          is_bank_account: boolean
          is_contra_account: boolean
          is_credit_card_account: boolean
          lines_count: number
          name: string
          org_id: string
          property_id: string
          sub_type: string
          type: string
        }[]
      }
      validate_bill_application: {
        Args: { p_amount: number; p_bill_id: string; p_source_id: string }
        Returns: undefined
      }
      validate_ownership_totals: {
        Args: { p_property_id: string }
        Returns: undefined
      }
      validate_transaction_balance: {
        Args: { p_tolerance?: number; p_transaction_id: string }
        Returns: undefined
      }
      void_bill: {
        Args: {
          p_bill_transaction_id: string
          p_reason?: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      accounting_basis_enum: "Accrual" | "Cash"
      appliance_service_type_enum:
        | "Maintenance"
        | "Repair"
        | "Replacement"
        | "Installation"
        | "Inspection"
        | "Other"
      appliance_type_enum:
        | "Refrigerator"
        | "Freezer"
        | "Stove"
        | "Microwave"
        | "Dishwasher"
        | "Washer/Dryer"
      approval_state_enum:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "voided"
      assignment_level: "Property Level" | "Unit Level"
      assignment_level_enum: "Building" | "Unit"
      automation_frequency_enum:
        | "monthly"
        | "quarterly"
        | "annually"
        | "on_event"
        | "weekly"
        | "biweekly"
      automation_rule_type_enum:
        | "recurring_task"
        | "recurring_charge"
        | "workflow_trigger"
      bank_account_type_enum:
        | "checking"
        | "savings"
        | "money_market"
        | "certificate_of_deposit"
      bank_entry_status_enum: "uncleared" | "cleared" | "reconciled"
      bathroom_enum:
        | "1"
        | "1.5"
        | "2"
        | "2.5"
        | "3"
        | "3.5"
        | "4+"
        | "4.5"
        | "5"
        | "5+"
      bedroom_enum:
        | "Studio"
        | "1"
        | "2"
        | "3"
        | "4"
        | "5+"
        | "6"
        | "7"
        | "8"
        | "9+"
      bill_administration_option:
        | "Property Tax"
        | "Building Charges"
        | "Insurance"
        | "Utilities"
        | "Other"
      billing_basis_enum:
        | "per_property"
        | "per_unit"
        | "percent_rent"
        | "job_cost"
        | "hourly"
        | "one_time"
      billing_frequency_enum:
        | "Annual"
        | "Monthly"
        | "monthly"
        | "annually"
        | "one_time"
        | "per_event"
        | "per_job"
        | "quarterly"
      buildium_bank_account_type:
        | "Checking"
        | "Savings"
        | "MoneyMarket"
        | "CertificateOfDeposit"
      buildium_bill_status:
        | "Pending"
        | "Paid"
        | "Overdue"
        | "Cancelled"
        | "PartiallyPaid"
      buildium_lease_contact_role: "Tenant" | "Cosigner" | "Guarantor"
      buildium_lease_status: "Future" | "Active" | "Past" | "Cancelled"
      buildium_payment_method:
        | "Check"
        | "Cash"
        | "CreditCard"
        | "BankTransfer"
        | "OnlinePayment"
      buildium_property_type: "Rental" | "Association" | "Commercial"
      buildium_sync_status_type:
        | "pending"
        | "syncing"
        | "synced"
        | "failed"
        | "conflict"
      buildium_task_priority: "Low" | "Medium" | "High" | "Critical"
      buildium_task_status:
        | "Open"
        | "InProgress"
        | "Completed"
        | "Cancelled"
        | "OnHold"
      buildium_unit_type:
        | "Apartment"
        | "Condo"
        | "House"
        | "Townhouse"
        | "Office"
        | "Retail"
        | "Warehouse"
        | "Other"
      buildium_vendor_category:
        | "Contractor"
        | "Maintenance"
        | "Utilities"
        | "Insurance"
        | "Legal"
        | "Accounting"
        | "Marketing"
        | "Other"
      buildium_webhook_event_type:
        | "PropertyCreated"
        | "PropertyUpdated"
        | "PropertyDeleted"
        | "UnitCreated"
        | "UnitUpdated"
        | "UnitDeleted"
        | "OwnerCreated"
        | "OwnerUpdated"
        | "OwnerDeleted"
        | "LeaseCreated"
        | "LeaseUpdated"
        | "LeaseDeleted"
        | "BillCreated"
        | "BillUpdated"
        | "BillPaid"
        | "TaskCreated"
        | "TaskUpdated"
        | "TaskCompleted"
      charge_status_enum: "open" | "partial" | "paid" | "cancelled"
      charge_type_enum: "rent" | "late_fee" | "utility" | "other"
      compliance_applies_to: "property" | "asset" | "both"
      compliance_asset_type:
        | "elevator"
        | "boiler"
        | "facade"
        | "gas_piping"
        | "sprinkler"
        | "generic"
        | "other"
      compliance_event_type:
        | "inspection"
        | "filing"
        | "correction"
        | "violation_clearance"
      compliance_item_source:
        | "manual"
        | "dob_sync"
        | "hpd_sync"
        | "fdny_sync"
        | "open_data_sync"
      compliance_item_status:
        | "not_started"
        | "scheduled"
        | "in_progress"
        | "inspected"
        | "filed"
        | "accepted"
        | "accepted_with_defects"
        | "failed"
        | "overdue"
        | "closed"
      compliance_jurisdiction:
        | "NYC_DOB"
        | "NYC_HPD"
        | "FDNY"
        | "NYC_DEP"
        | "OTHER"
      compliance_violation_agency: "DOB" | "HPD" | "FDNY" | "DEP" | "OTHER"
      compliance_violation_category: "violation" | "complaint"
      compliance_violation_status: "open" | "in_progress" | "cleared" | "closed"
      compliance_work_order_role: "primary" | "related"
      countries:
        | "Afghanistan"
        | "Albania"
        | "Algeria"
        | "Andorra"
        | "Angola"
        | "Antigua and Barbuda"
        | "Argentina"
        | "Armenia"
        | "Australia"
        | "Austria"
        | "Azerbaijan"
        | "Bahamas"
        | "Bahrain"
        | "Bangladesh"
        | "Barbados"
        | "Belarus"
        | "Belgium"
        | "Belize"
        | "Benin"
        | "Bhutan"
        | "Bolivia"
        | "Bosnia and Herzegovina"
        | "Botswana"
        | "Brazil"
        | "Brunei"
        | "Bulgaria"
        | "Burkina Faso"
        | "Burundi"
        | "Cambodia"
        | "Cameroon"
        | "Canada"
        | "Cape Verde"
        | "Central African Republic"
        | "Chad"
        | "Chile"
        | "China"
        | "Colombia"
        | "Comoros"
        | "Congo (Republic of the Congo)"
        | "Costa Rica"
        | "Croatia"
        | "Cuba"
        | "Cyprus"
        | "Czech Republic (Czechia)"
        | "Democratic Republic of the Congo"
        | "Denmark"
        | "Djibouti"
        | "Dominica"
        | "Dominican Republic"
        | "East Timor (Timor-Leste)"
        | "Ecuador"
        | "Egypt"
        | "El Salvador"
        | "Equatorial Guinea"
        | "Eritrea"
        | "Estonia"
        | "Eswatini"
        | "Ethiopia"
        | "Fiji"
        | "Finland"
        | "France"
        | "Gabon"
        | "Gambia"
        | "Georgia"
        | "Germany"
        | "Ghana"
        | "Greece"
        | "Grenada"
        | "Guatemala"
        | "Guinea"
        | "Guinea-Bissau"
        | "Guyana"
        | "Haiti"
        | "Honduras"
        | "Hungary"
        | "Iceland"
        | "India"
        | "Indonesia"
        | "Iran"
        | "Iraq"
        | "Ireland"
        | "Israel"
        | "Italy"
        | "Ivory Coast (Côte d'Ivoire)"
        | "Jamaica"
        | "Japan"
        | "Jordan"
        | "Kazakhstan"
        | "Kenya"
        | "Kiribati"
        | "Korea (North Korea)"
        | "Korea (South Korea)"
        | "Kosovo"
        | "Kuwait"
        | "Kyrgyzstan"
        | "Laos"
        | "Latvia"
        | "Lebanon"
        | "Lesotho"
        | "Liberia"
        | "Libya"
        | "Liechtenstein"
        | "Lithuania"
        | "Luxembourg"
        | "Madagascar"
        | "Malawi"
        | "Malaysia"
        | "Maldives"
        | "Mali"
        | "Malta"
        | "Marshall Islands"
        | "Mauritania"
        | "Mauritius"
        | "Mexico"
        | "Micronesia"
        | "Moldova"
        | "Monaco"
        | "Mongolia"
        | "Montenegro"
        | "Morocco"
        | "Mozambique"
        | "Myanmar (Burma)"
        | "Namibia"
        | "Nauru"
        | "Nepal"
        | "Netherlands"
        | "New Zealand"
        | "Nicaragua"
        | "Niger"
        | "Nigeria"
        | "North Macedonia"
        | "Norway"
        | "Oman"
        | "Pakistan"
        | "Palau"
        | "Palestine"
        | "Panama"
        | "Papua New Guinea"
        | "Paraguay"
        | "Peru"
        | "Philippines"
        | "Poland"
        | "Portugal"
        | "Qatar"
        | "Romania"
        | "Russia"
        | "Rwanda"
        | "Saint Kitts and Nevis"
        | "Saint Lucia"
        | "Saint Vincent and the Grenadines"
        | "Samoa"
        | "San Marino"
        | "São Tomé and Príncipe"
        | "Saudi Arabia"
        | "Senegal"
        | "Serbia"
        | "Seychelles"
        | "Sierra Leone"
        | "Singapore"
        | "Slovakia"
        | "Slovenia"
        | "Solomon Islands"
        | "Somalia"
        | "South Africa"
        | "South Sudan"
        | "Spain"
        | "Sri Lanka"
        | "Sudan"
        | "Suriname"
        | "Sweden"
        | "Switzerland"
        | "Syria"
        | "Taiwan"
        | "Tajikistan"
        | "Tanzania"
        | "Thailand"
        | "Togo"
        | "Tonga"
        | "Trinidad and Tobago"
        | "Tunisia"
        | "Turkey"
        | "Turkmenistan"
        | "Tuvalu"
        | "Uganda"
        | "Ukraine"
        | "United Arab Emirates"
        | "United Kingdom"
        | "United States"
        | "Uruguay"
        | "Uzbekistan"
        | "Vanuatu"
        | "Vatican City (Holy See)"
        | "Venezuela"
        | "Vietnam"
        | "Yemen"
        | "Zambia"
        | "Zimbabwe"
      deposit_status_enum: "posted" | "reconciled" | "voided"
      dr_cr_enum: "DR" | "CR"
      email_template_key: "monthly_rental_statement"
      email_template_status: "active" | "inactive" | "archived"
      entity_type_enum: "Rental" | "Company"
      etf_account_type_enum: "Checking" | "Saving"
      external_sync_source: "dob_now" | "nyc_open_data" | "hpd" | "fdny"
      external_sync_status: "idle" | "running" | "error"
      fee_category_enum: "plan_fee" | "service_fee" | "override" | "legacy"
      fee_type_enum: "Percentage" | "Flat Rate"
      FeeFrequency: "Monthly" | "Annually"
      FeeType: "Percentage" | "Flat Rate"
      files_entity_type_enum:
        | "Properties"
        | "Units"
        | "Leases"
        | "Tenants"
        | "Rental Owners"
        | "Associations"
        | "Association Owners"
        | "Association Units"
        | "Ownership Accounts"
        | "Accounts"
        | "Vendors"
      gl_category:
        | "receivable"
        | "prepayment"
        | "deposit"
        | "income"
        | "expense"
        | "other"
      inspection_status_enum: "Scheduled" | "Completed"
      inspection_type_enum: "Periodic" | "Move-In" | "Move-Out"
      lease_contact_role_enum: "Tenant" | "Cosigner" | "Guarantor"
      lease_contact_status_enum: "Future" | "Active" | "Past"
      management_fee_type_enum: "percentage" | "flat"
      monthly_log_stage:
        | "charges"
        | "payments"
        | "bills"
        | "escrow"
        | "management_fees"
        | "owner_statements"
        | "owner_distributions"
      monthly_log_status: "pending" | "complete"
      onboarding_status_enum:
        | "IN_PROGRESS"
        | "PENDING_APPROVAL"
        | "OVERDUE"
        | "COMPLETED"
      onboarding_task_status_enum:
        | "PENDING"
        | "IN_PROGRESS"
        | "BLOCKED"
        | "DONE"
      payment_intent_state_enum:
        | "created"
        | "submitted"
        | "pending"
        | "authorized"
        | "settled"
        | "failed"
      payment_method_enum:
        | "Check"
        | "Cash"
        | "MoneyOrder"
        | "CashierCheck"
        | "DirectDeposit"
        | "CreditCard"
        | "ElectronicPayment"
      plan_amount_type: "flat" | "percent"
      plan_percent_basis: "lease_rent_amount" | "collected_rent"
      property_status: "Active" | "Inactive"
      property_type_enum:
        | "Condo"
        | "Co-op"
        | "Condop"
        | "Rental Building"
        | "Townhouse"
        | "Mult-Family"
      receivable_status_enum: "open" | "partial" | "paid" | "cancelled"
      receivable_type_enum: "rent" | "fee" | "utility" | "other"
      rent_basis_enum: "scheduled" | "billed" | "collected"
      rent_cycle_enum:
        | "Monthly"
        | "Weekly"
        | "Every2Weeks"
        | "Quarterly"
        | "Yearly"
        | "Every2Months"
        | "Daily"
        | "Every6Months"
        | "OneTime"
      rent_schedule_status: "Past" | "Current" | "Future"
      service_plan_enum: "Full" | "Basic" | "A-la-carte" | "Custom"
      ServicePlan: "Full" | "Basic" | "A-la-carte"
      staff_role:
        | "PROPERTY_MANAGER"
        | "ASSISTANT_PROPERTY_MANAGER"
        | "MAINTENANCE_COORDINATOR"
        | "ACCOUNTANT"
        | "ADMINISTRATOR"
      staff_roles:
        | "Property Manager"
        | "Bookkeeper"
        | "Assistant Property Manager"
        | "Maintenance Coordinator"
        | "Accountant"
        | "Administrator"
      sync_source_enum: "local" | "buildium"
      task_kind_enum: "owner" | "resident" | "contact" | "todo" | "other"
      task_source_enum: "buildium" | "manual" | "monthly_log"
      tax_payer_type: "SSN" | "EIN"
      transaction_status_enum:
        | ""
        | "Overdue"
        | "Due"
        | "Partially paid"
        | "Paid"
        | "Cancelled"
      transaction_type_enum:
        | "Bill"
        | "Charge"
        | "Credit"
        | "Payment"
        | "JournalEntry"
        | "Check"
        | "Refund"
        | "ApplyDeposit"
        | "ElectronicFundsTransfer"
        | "Other"
        | "Deposit"
        | "GeneralJournalEntry"
        | "OwnerContribution"
        | "ReversePayment"
        | "ReverseElectronicFundsTransfer"
        | "VendorCredit"
        | "RentalApplicationFeePayment"
        | "ReverseRentalApplicationFeePayment"
        | "ReverseOwnerContribution"
        | "VendorRefund"
        | "UnreversedPayment"
        | "UnreversedElectronicFundsTransfer"
        | "UnreversedOwnerContribution"
        | "UnreversedRentalApplicationFeePayment"
        | "ReversedEftRefund"
      trust_account_warning_enum: "Off" | "ByProperty" | "ByRentalOwner"
      txn_type_enum: "Charge" | "Payment" | "Adjustment" | "Refund"
      unit_status_enum: "Occupied" | "Vacant" | "Inactive"
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
      accounting_basis_enum: ["Accrual", "Cash"],
      appliance_service_type_enum: [
        "Maintenance",
        "Repair",
        "Replacement",
        "Installation",
        "Inspection",
        "Other",
      ],
      appliance_type_enum: [
        "Refrigerator",
        "Freezer",
        "Stove",
        "Microwave",
        "Dishwasher",
        "Washer/Dryer",
      ],
      approval_state_enum: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "voided",
      ],
      assignment_level: ["Property Level", "Unit Level"],
      assignment_level_enum: ["Building", "Unit"],
      automation_frequency_enum: [
        "monthly",
        "quarterly",
        "annually",
        "on_event",
        "weekly",
        "biweekly",
      ],
      automation_rule_type_enum: [
        "recurring_task",
        "recurring_charge",
        "workflow_trigger",
      ],
      bank_account_type_enum: [
        "checking",
        "savings",
        "money_market",
        "certificate_of_deposit",
      ],
      bank_entry_status_enum: ["uncleared", "cleared", "reconciled"],
      bathroom_enum: [
        "1",
        "1.5",
        "2",
        "2.5",
        "3",
        "3.5",
        "4+",
        "4.5",
        "5",
        "5+",
      ],
      bedroom_enum: ["Studio", "1", "2", "3", "4", "5+", "6", "7", "8", "9+"],
      bill_administration_option: [
        "Property Tax",
        "Building Charges",
        "Insurance",
        "Utilities",
        "Other",
      ],
      billing_basis_enum: [
        "per_property",
        "per_unit",
        "percent_rent",
        "job_cost",
        "hourly",
        "one_time",
      ],
      billing_frequency_enum: [
        "Annual",
        "Monthly",
        "monthly",
        "annually",
        "one_time",
        "per_event",
        "per_job",
        "quarterly",
      ],
      buildium_bank_account_type: [
        "Checking",
        "Savings",
        "MoneyMarket",
        "CertificateOfDeposit",
      ],
      buildium_bill_status: [
        "Pending",
        "Paid",
        "Overdue",
        "Cancelled",
        "PartiallyPaid",
      ],
      buildium_lease_contact_role: ["Tenant", "Cosigner", "Guarantor"],
      buildium_lease_status: ["Future", "Active", "Past", "Cancelled"],
      buildium_payment_method: [
        "Check",
        "Cash",
        "CreditCard",
        "BankTransfer",
        "OnlinePayment",
      ],
      buildium_property_type: ["Rental", "Association", "Commercial"],
      buildium_sync_status_type: [
        "pending",
        "syncing",
        "synced",
        "failed",
        "conflict",
      ],
      buildium_task_priority: ["Low", "Medium", "High", "Critical"],
      buildium_task_status: [
        "Open",
        "InProgress",
        "Completed",
        "Cancelled",
        "OnHold",
      ],
      buildium_unit_type: [
        "Apartment",
        "Condo",
        "House",
        "Townhouse",
        "Office",
        "Retail",
        "Warehouse",
        "Other",
      ],
      buildium_vendor_category: [
        "Contractor",
        "Maintenance",
        "Utilities",
        "Insurance",
        "Legal",
        "Accounting",
        "Marketing",
        "Other",
      ],
      buildium_webhook_event_type: [
        "PropertyCreated",
        "PropertyUpdated",
        "PropertyDeleted",
        "UnitCreated",
        "UnitUpdated",
        "UnitDeleted",
        "OwnerCreated",
        "OwnerUpdated",
        "OwnerDeleted",
        "LeaseCreated",
        "LeaseUpdated",
        "LeaseDeleted",
        "BillCreated",
        "BillUpdated",
        "BillPaid",
        "TaskCreated",
        "TaskUpdated",
        "TaskCompleted",
      ],
      charge_status_enum: ["open", "partial", "paid", "cancelled"],
      charge_type_enum: ["rent", "late_fee", "utility", "other"],
      compliance_applies_to: ["property", "asset", "both"],
      compliance_asset_type: [
        "elevator",
        "boiler",
        "facade",
        "gas_piping",
        "sprinkler",
        "generic",
        "other",
      ],
      compliance_event_type: [
        "inspection",
        "filing",
        "correction",
        "violation_clearance",
      ],
      compliance_item_source: [
        "manual",
        "dob_sync",
        "hpd_sync",
        "fdny_sync",
        "open_data_sync",
      ],
      compliance_item_status: [
        "not_started",
        "scheduled",
        "in_progress",
        "inspected",
        "filed",
        "accepted",
        "accepted_with_defects",
        "failed",
        "overdue",
        "closed",
      ],
      compliance_jurisdiction: [
        "NYC_DOB",
        "NYC_HPD",
        "FDNY",
        "NYC_DEP",
        "OTHER",
      ],
      compliance_violation_agency: ["DOB", "HPD", "FDNY", "DEP", "OTHER"],
      compliance_violation_category: ["violation", "complaint"],
      compliance_violation_status: ["open", "in_progress", "cleared", "closed"],
      compliance_work_order_role: ["primary", "related"],
      countries: [
        "Afghanistan",
        "Albania",
        "Algeria",
        "Andorra",
        "Angola",
        "Antigua and Barbuda",
        "Argentina",
        "Armenia",
        "Australia",
        "Austria",
        "Azerbaijan",
        "Bahamas",
        "Bahrain",
        "Bangladesh",
        "Barbados",
        "Belarus",
        "Belgium",
        "Belize",
        "Benin",
        "Bhutan",
        "Bolivia",
        "Bosnia and Herzegovina",
        "Botswana",
        "Brazil",
        "Brunei",
        "Bulgaria",
        "Burkina Faso",
        "Burundi",
        "Cambodia",
        "Cameroon",
        "Canada",
        "Cape Verde",
        "Central African Republic",
        "Chad",
        "Chile",
        "China",
        "Colombia",
        "Comoros",
        "Congo (Republic of the Congo)",
        "Costa Rica",
        "Croatia",
        "Cuba",
        "Cyprus",
        "Czech Republic (Czechia)",
        "Democratic Republic of the Congo",
        "Denmark",
        "Djibouti",
        "Dominica",
        "Dominican Republic",
        "East Timor (Timor-Leste)",
        "Ecuador",
        "Egypt",
        "El Salvador",
        "Equatorial Guinea",
        "Eritrea",
        "Estonia",
        "Eswatini",
        "Ethiopia",
        "Fiji",
        "Finland",
        "France",
        "Gabon",
        "Gambia",
        "Georgia",
        "Germany",
        "Ghana",
        "Greece",
        "Grenada",
        "Guatemala",
        "Guinea",
        "Guinea-Bissau",
        "Guyana",
        "Haiti",
        "Honduras",
        "Hungary",
        "Iceland",
        "India",
        "Indonesia",
        "Iran",
        "Iraq",
        "Ireland",
        "Israel",
        "Italy",
        "Ivory Coast (Côte d'Ivoire)",
        "Jamaica",
        "Japan",
        "Jordan",
        "Kazakhstan",
        "Kenya",
        "Kiribati",
        "Korea (North Korea)",
        "Korea (South Korea)",
        "Kosovo",
        "Kuwait",
        "Kyrgyzstan",
        "Laos",
        "Latvia",
        "Lebanon",
        "Lesotho",
        "Liberia",
        "Libya",
        "Liechtenstein",
        "Lithuania",
        "Luxembourg",
        "Madagascar",
        "Malawi",
        "Malaysia",
        "Maldives",
        "Mali",
        "Malta",
        "Marshall Islands",
        "Mauritania",
        "Mauritius",
        "Mexico",
        "Micronesia",
        "Moldova",
        "Monaco",
        "Mongolia",
        "Montenegro",
        "Morocco",
        "Mozambique",
        "Myanmar (Burma)",
        "Namibia",
        "Nauru",
        "Nepal",
        "Netherlands",
        "New Zealand",
        "Nicaragua",
        "Niger",
        "Nigeria",
        "North Macedonia",
        "Norway",
        "Oman",
        "Pakistan",
        "Palau",
        "Palestine",
        "Panama",
        "Papua New Guinea",
        "Paraguay",
        "Peru",
        "Philippines",
        "Poland",
        "Portugal",
        "Qatar",
        "Romania",
        "Russia",
        "Rwanda",
        "Saint Kitts and Nevis",
        "Saint Lucia",
        "Saint Vincent and the Grenadines",
        "Samoa",
        "San Marino",
        "São Tomé and Príncipe",
        "Saudi Arabia",
        "Senegal",
        "Serbia",
        "Seychelles",
        "Sierra Leone",
        "Singapore",
        "Slovakia",
        "Slovenia",
        "Solomon Islands",
        "Somalia",
        "South Africa",
        "South Sudan",
        "Spain",
        "Sri Lanka",
        "Sudan",
        "Suriname",
        "Sweden",
        "Switzerland",
        "Syria",
        "Taiwan",
        "Tajikistan",
        "Tanzania",
        "Thailand",
        "Togo",
        "Tonga",
        "Trinidad and Tobago",
        "Tunisia",
        "Turkey",
        "Turkmenistan",
        "Tuvalu",
        "Uganda",
        "Ukraine",
        "United Arab Emirates",
        "United Kingdom",
        "United States",
        "Uruguay",
        "Uzbekistan",
        "Vanuatu",
        "Vatican City (Holy See)",
        "Venezuela",
        "Vietnam",
        "Yemen",
        "Zambia",
        "Zimbabwe",
      ],
      deposit_status_enum: ["posted", "reconciled", "voided"],
      dr_cr_enum: ["DR", "CR"],
      email_template_key: ["monthly_rental_statement"],
      email_template_status: ["active", "inactive", "archived"],
      entity_type_enum: ["Rental", "Company"],
      etf_account_type_enum: ["Checking", "Saving"],
      external_sync_source: ["dob_now", "nyc_open_data", "hpd", "fdny"],
      external_sync_status: ["idle", "running", "error"],
      fee_category_enum: ["plan_fee", "service_fee", "override", "legacy"],
      fee_type_enum: ["Percentage", "Flat Rate"],
      FeeFrequency: ["Monthly", "Annually"],
      FeeType: ["Percentage", "Flat Rate"],
      files_entity_type_enum: [
        "Properties",
        "Units",
        "Leases",
        "Tenants",
        "Rental Owners",
        "Associations",
        "Association Owners",
        "Association Units",
        "Ownership Accounts",
        "Accounts",
        "Vendors",
      ],
      gl_category: [
        "receivable",
        "prepayment",
        "deposit",
        "income",
        "expense",
        "other",
      ],
      inspection_status_enum: ["Scheduled", "Completed"],
      inspection_type_enum: ["Periodic", "Move-In", "Move-Out"],
      lease_contact_role_enum: ["Tenant", "Cosigner", "Guarantor"],
      lease_contact_status_enum: ["Future", "Active", "Past"],
      management_fee_type_enum: ["percentage", "flat"],
      monthly_log_stage: [
        "charges",
        "payments",
        "bills",
        "escrow",
        "management_fees",
        "owner_statements",
        "owner_distributions",
      ],
      monthly_log_status: ["pending", "complete"],
      onboarding_status_enum: [
        "IN_PROGRESS",
        "PENDING_APPROVAL",
        "OVERDUE",
        "COMPLETED",
      ],
      onboarding_task_status_enum: [
        "PENDING",
        "IN_PROGRESS",
        "BLOCKED",
        "DONE",
      ],
      payment_intent_state_enum: [
        "created",
        "submitted",
        "pending",
        "authorized",
        "settled",
        "failed",
      ],
      payment_method_enum: [
        "Check",
        "Cash",
        "MoneyOrder",
        "CashierCheck",
        "DirectDeposit",
        "CreditCard",
        "ElectronicPayment",
      ],
      plan_amount_type: ["flat", "percent"],
      plan_percent_basis: ["lease_rent_amount", "collected_rent"],
      property_status: ["Active", "Inactive"],
      property_type_enum: [
        "Condo",
        "Co-op",
        "Condop",
        "Rental Building",
        "Townhouse",
        "Mult-Family",
      ],
      receivable_status_enum: ["open", "partial", "paid", "cancelled"],
      receivable_type_enum: ["rent", "fee", "utility", "other"],
      rent_basis_enum: ["scheduled", "billed", "collected"],
      rent_cycle_enum: [
        "Monthly",
        "Weekly",
        "Every2Weeks",
        "Quarterly",
        "Yearly",
        "Every2Months",
        "Daily",
        "Every6Months",
        "OneTime",
      ],
      rent_schedule_status: ["Past", "Current", "Future"],
      service_plan_enum: ["Full", "Basic", "A-la-carte", "Custom"],
      ServicePlan: ["Full", "Basic", "A-la-carte"],
      staff_role: [
        "PROPERTY_MANAGER",
        "ASSISTANT_PROPERTY_MANAGER",
        "MAINTENANCE_COORDINATOR",
        "ACCOUNTANT",
        "ADMINISTRATOR",
      ],
      staff_roles: [
        "Property Manager",
        "Bookkeeper",
        "Assistant Property Manager",
        "Maintenance Coordinator",
        "Accountant",
        "Administrator",
      ],
      sync_source_enum: ["local", "buildium"],
      task_kind_enum: ["owner", "resident", "contact", "todo", "other"],
      task_source_enum: ["buildium", "manual", "monthly_log"],
      tax_payer_type: ["SSN", "EIN"],
      transaction_status_enum: [
        "",
        "Overdue",
        "Due",
        "Partially paid",
        "Paid",
        "Cancelled",
      ],
      transaction_type_enum: [
        "Bill",
        "Charge",
        "Credit",
        "Payment",
        "JournalEntry",
        "Check",
        "Refund",
        "ApplyDeposit",
        "ElectronicFundsTransfer",
        "Other",
        "Deposit",
        "GeneralJournalEntry",
        "OwnerContribution",
        "ReversePayment",
        "ReverseElectronicFundsTransfer",
        "VendorCredit",
        "RentalApplicationFeePayment",
        "ReverseRentalApplicationFeePayment",
        "ReverseOwnerContribution",
        "VendorRefund",
        "UnreversedPayment",
        "UnreversedElectronicFundsTransfer",
        "UnreversedOwnerContribution",
        "UnreversedRentalApplicationFeePayment",
        "ReversedEftRefund",
      ],
      trust_account_warning_enum: ["Off", "ByProperty", "ByRentalOwner"],
      txn_type_enum: ["Charge", "Payment", "Adjustment", "Refund"],
      unit_status_enum: ["Occupied", "Vacant", "Inactive"],
    },
  },
} as const

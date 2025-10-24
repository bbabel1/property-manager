export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appliance_service_history: {
        Row: {
          appliance_id: string
          buildium_service_history_id: number | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          service_date: string
          service_type: Database["public"]["Enums"]["appliance_service_type_enum"]
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          appliance_id: string
          buildium_service_history_id?: number | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          service_date: string
          service_type: Database["public"]["Enums"]["appliance_service_type_enum"]
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          appliance_id?: string
          buildium_service_history_id?: number | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          service_date?: string
          service_type?: Database["public"]["Enums"]["appliance_service_type_enum"]
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appliance_service_history_appliance_id_fkey"
            columns: ["appliance_id"]
            isOneToOne: false
            referencedRelation: "appliances"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bank_accounts: {
        Row: {
          account_number: string | null
          balance: number | null
          bank_account_type:
            | Database["public"]["Enums"]["bank_account_type_enum"]
            | null
          buildium_balance: number | null
          buildium_bank_id: number
          check_printing_info: Json | null
          country: Database["public"]["Enums"]["countries"]
          created_at: string
          description: string | null
          electronic_payments: Json | null
          gl_account: string
          id: string
          is_active: boolean
          last_source: Database["public"]["Enums"]["sync_source_enum"] | null
          last_source_ts: string | null
          name: string
          org_id: string | null
          routing_number: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          balance?: number | null
          bank_account_type?:
            | Database["public"]["Enums"]["bank_account_type_enum"]
            | null
          buildium_balance?: number | null
          buildium_bank_id: number
          check_printing_info?: Json | null
          country?: Database["public"]["Enums"]["countries"]
          created_at?: string
          description?: string | null
          electronic_payments?: Json | null
          gl_account: string
          id?: string
          is_active?: boolean
          last_source?: Database["public"]["Enums"]["sync_source_enum"] | null
          last_source_ts?: string | null
          name: string
          org_id?: string | null
          routing_number?: string | null
          updated_at: string
        }
        Update: {
          account_number?: string | null
          balance?: number | null
          bank_account_type?:
            | Database["public"]["Enums"]["bank_account_type_enum"]
            | null
          buildium_balance?: number | null
          buildium_bank_id?: number
          check_printing_info?: Json | null
          country?: Database["public"]["Enums"]["countries"]
          created_at?: string
          description?: string | null
          electronic_payments?: Json | null
          gl_account?: string
          id?: string
          is_active?: boolean
          last_source?: Database["public"]["Enums"]["sync_source_enum"] | null
          last_source_ts?: string | null
          name?: string
          org_id?: string | null
          routing_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_gl_account_fkey"
            columns: ["gl_account"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_fkey"
            columns: ["gl_account"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
          },
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
          updated_at: string | null
        }
        Insert: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      buildium_api_cache: {
        Row: {
          created_at: string | null
          endpoint: string
          expires_at: string
          id: string
          parameters: Json | null
          response_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          expires_at: string
          id?: string
          parameters?: Json | null
          response_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          expires_at?: string
          id?: string
          parameters?: Json | null
          response_data?: Json | null
          updated_at?: string | null
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
          request_data?: Json | null
          response_data?: Json | null
          response_status?: number | null
        }
        Relationships: []
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
          created_at: string | null
          error_message: string | null
          event_data: Json
          event_id: string | null
          event_type: string
          id: string
          max_retries: number | null
          org_id: string | null
          processed: boolean | null
          processed_at: string | null
          retry_count: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data: Json
          event_id?: string | null
          event_type: string
          id?: string
          max_retries?: number | null
          org_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_id?: string | null
          event_type?: string
          id?: string
          max_retries?: number | null
          org_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          retry_count?: number | null
          updated_at?: string | null
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
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_auth"
            referencedColumns: ["user_id"]
          },
        ]
      }
      file_links: {
        Row: {
          added_at: string
          added_by: string | null
          category: string | null
          entity_int: number | null
          entity_type: string
          entity_uuid: string | null
          file_id: string
          id: string
          org_id: string
          role: string | null
          sort_index: number | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          category?: string | null
          entity_int?: number | null
          entity_type: string
          entity_uuid?: string | null
          file_id: string
          id?: string
          org_id: string
          role?: string | null
          sort_index?: number | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          category?: string | null
          entity_int?: number | null
          entity_type?: string
          entity_uuid?: string | null
          file_id?: string
          id?: string
          org_id?: string
          role?: string | null
          sort_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "file_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "lease_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "task_history_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "work_order_files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string | null
          buildium_entity_id: number | null
          buildium_entity_type: string | null
          buildium_file_id: number | null
          buildium_href: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          external_url: string | null
          file_name: string
          id: string
          is_private: boolean
          mime_type: string | null
          org_id: string
          sha256: string | null
          size_bytes: number | null
          source: string | null
          storage_key: string | null
          storage_provider: string | null
          updated_at: string
        }
        Insert: {
          bucket?: string | null
          buildium_entity_id?: number | null
          buildium_entity_type?: string | null
          buildium_file_id?: number | null
          buildium_href?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          file_name: string
          id?: string
          is_private?: boolean
          mime_type?: string | null
          org_id: string
          sha256?: string | null
          size_bytes?: number | null
          source?: string | null
          storage_key?: string | null
          storage_provider?: string | null
          updated_at?: string
        }
        Update: {
          bucket?: string | null
          buildium_entity_id?: number | null
          buildium_entity_type?: string | null
          buildium_file_id?: number | null
          buildium_href?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          file_name?: string
          id?: string
          is_private?: boolean
          mime_type?: string | null
          org_id?: string
          sha256?: string | null
          size_bytes?: number | null
          source?: string | null
          storage_key?: string | null
          storage_provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gl_accounts: {
        Row: {
          account_number: string | null
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
          sub_accounts: string[] | null
          sub_type: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
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
          sub_accounts?: string[] | null
          sub_type?: string | null
          type: string
          updated_at: string
        }
        Update: {
          account_number?: string | null
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
          sub_accounts?: string[] | null
          sub_type?: string | null
          type?: string
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
        ]
      }
      gl_import_cursors: {
        Row: {
          key: string
          last_imported_at: string
          updated_at: string
          window_days: number
        }
        Insert: {
          key: string
          last_imported_at?: string
          updated_at?: string
          window_days?: number
        }
        Update: {
          key?: string
          last_imported_at?: string
          updated_at?: string
          window_days?: number
        }
        Relationships: []
      }
      inspections: {
        Row: {
          created_at: string
          id: string
          inspection_date: string
          property: string
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
          total_amount: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          buildium_gl_entry_id?: number | null
          check_number?: string | null
          created_at?: string
          date: string
          id?: string
          memo?: string | null
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          buildium_gl_entry_id?: number | null
          check_number?: string | null
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          lease_from_date: string
          lease_to_date: string | null
          lease_type: string | null
          org_id: string | null
          payment_due_day: number | null
          property_id: string
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
          lease_from_date: string
          lease_to_date?: string | null
          lease_type?: string | null
          org_id?: string | null
          payment_due_day?: number | null
          property_id: string
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
          lease_from_date?: string
          lease_to_date?: string | null
          lease_type?: string | null
          org_id?: string | null
          payment_due_day?: number | null
          property_id?: string
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
          role: string
          status: string
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
          role?: string
          status?: string
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
          role?: string
          status?: string
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
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
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
          {
            foreignKeyName: "org_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_auth"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          tax_address_line1: string | null
          tax_address_line2: string | null
          tax_address_line3: string | null
          tax_city: string | null
          tax_country: Database["public"]["Enums"]["countries"] | null
          tax_include1099: boolean | null
          tax_payer_id: string | null
          tax_payer_name1: string | null
          tax_payer_name2: string | null
          tax_payer_type:
            | Database["public"]["Enums"]["tax_payer_type"]
            | null
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
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_city?: string | null
          tax_country?: Database["public"]["Enums"]["countries"] | null
          tax_include1099?: boolean | null
          tax_payer_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?:
            | Database["public"]["Enums"]["tax_payer_type"]
            | null
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
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_city?: string | null
          tax_country?: Database["public"]["Enums"]["countries"] | null
          tax_include1099?: boolean | null
          tax_payer_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?:
            | Database["public"]["Enums"]["tax_payer_type"]
            | null
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
            foreignKeyName: "owners_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_auth"
            referencedColumns: ["user_id"]
          },
        ]
      }
      owners_list_cache: {
        Row: {
          contact_id: number
          display_name: string | null
          management_agreement_end_date: string | null
          management_agreement_start_date: string | null
          owner_id: string
          primary_email: string | null
          primary_phone: string | null
          updated_at: string
        }
        Insert: {
          contact_id: number
          display_name?: string | null
          management_agreement_end_date?: string | null
          management_agreement_start_date?: string | null
          owner_id: string
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: number
          display_name?: string | null
          management_agreement_end_date?: string | null
          management_agreement_start_date?: string | null
          owner_id?: string
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_with_auth"
            referencedColumns: ["user_id"]
          },
        ]
      }
      properties: {
        Row: {
          active_services:
            | Database["public"]["Enums"]["management_services_enum"][]
            | null
          address_line1: string
          address_line2: string | null
          address_line3: string | null
          billing_frequency:
            | Database["public"]["Enums"]["billing_frequency_enum"]
            | null
          borough: string | null
          buildium_created_at: string | null
          buildium_property_id: number | null
          buildium_updated_at: string | null
          city: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at: string
          deposit_trust_account_id: string | null
          fee_assignment:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          fee_percentage: number | null
          fee_type: Database["public"]["Enums"]["fee_type_enum"] | null
          id: string
          is_active: boolean | null
          latitude: number | null
          location_verified: boolean | null
          longitude: number | null
          management_fee: number | null
          management_scope:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          name: string
          neighborhood: string | null
          occupancy_rate: number | null
          operating_bank_account_id: string | null
          org_id: string
          postal_code: string
          primary_owner: string | null
          property_type:
            | Database["public"]["Enums"]["property_type_enum"]
            | null
          rental_owner_ids: number[] | null
          rental_type: string | null
          reserve: number | null
          service_assignment:
            | Database["public"]["Enums"]["assignment_level"]
            | null
          service_plan: Database["public"]["Enums"]["service_plan_enum"] | null
          state: string | null
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
          active_services?:
            | Database["public"]["Enums"]["management_services_enum"][]
            | null
          address_line1: string
          address_line2?: string | null
          address_line3?: string | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency_enum"]
            | null
          borough?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposit_trust_account_id?: string | null
          fee_assignment?:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          fee_percentage?: number | null
          fee_type?: Database["public"]["Enums"]["fee_type_enum"] | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          management_fee?: number | null
          management_scope?:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          name: string
          neighborhood?: string | null
          occupancy_rate?: number | null
          operating_bank_account_id?: string | null
          org_id: string
          postal_code: string
          primary_owner?: string | null
          property_type?:
            | Database["public"]["Enums"]["property_type_enum"]
            | null
          rental_owner_ids?: number[] | null
          rental_type?: string | null
          reserve?: number | null
          service_assignment?:
            | Database["public"]["Enums"]["assignment_level"]
            | null
          service_plan?: Database["public"]["Enums"]["service_plan_enum"] | null
          state?: string | null
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
          active_services?:
            | Database["public"]["Enums"]["management_services_enum"][]
            | null
          address_line1?: string
          address_line2?: string | null
          address_line3?: string | null
          billing_frequency?:
            | Database["public"]["Enums"]["billing_frequency_enum"]
            | null
          borough?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country?: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposit_trust_account_id?: string | null
          fee_assignment?:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          fee_percentage?: number | null
          fee_type?: Database["public"]["Enums"]["fee_type_enum"] | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          management_fee?: number | null
          management_scope?:
            | Database["public"]["Enums"]["assignment_level_enum"]
            | null
          name?: string
          neighborhood?: string | null
          occupancy_rate?: number | null
          operating_bank_account_id?: string | null
          org_id?: string
          postal_code?: string
          primary_owner?: string | null
          property_type?:
            | Database["public"]["Enums"]["property_type_enum"]
            | null
          rental_owner_ids?: number[] | null
          rental_type?: string | null
          reserve?: number | null
          service_assignment?:
            | Database["public"]["Enums"]["assignment_level"]
            | null
          service_plan?: Database["public"]["Enums"]["service_plan_enum"] | null
          state?: string | null
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
            foreignKeyName: "properties_deposit_trust_account_id_fkey"
            columns: ["deposit_trust_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_operating_bank_account_id_fkey"
            columns: ["operating_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
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
        ]
      }
      property_onboarding: {
        Row: {
          assigned_staff_id: number | null
          created_at: string
          current_stage: string | null
          due_date: string | null
          id: string
          org_id: string | null
          progress: number
          property_id: string
          status: Database["public"]["Enums"]["onboarding_status_enum"]
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: number | null
          created_at?: string
          current_stage?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          progress?: number
          property_id: string
          status?: Database["public"]["Enums"]["onboarding_status_enum"]
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: number | null
          created_at?: string
          current_stage?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          progress?: number
          property_id?: string
          status?: Database["public"]["Enums"]["onboarding_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_onboarding_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_onboarding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_onboarding_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_onboarding_tasks: {
        Row: {
          assigned_staff_id: number | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          name: string
          onboarding_id: string
          org_id: string | null
          status: Database["public"]["Enums"]["onboarding_task_status_enum"]
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: number | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          name: string
          onboarding_id: string
          org_id?: string | null
          status?: Database["public"]["Enums"]["onboarding_task_status_enum"]
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: number | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          name?: string
          onboarding_id?: string
          org_id?: string | null
          status?: Database["public"]["Enums"]["onboarding_task_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_onboarding_tasks_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_onboarding_tasks_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "property_onboarding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_onboarding_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
          updated_at?: string
        }
        Relationships: []
      }
      property_staff: {
        Row: {
          created_at: string
          property_id: string
          role: Database["public"]["Enums"]["staff_role"]
          staff_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          property_id: string
          role?: Database["public"]["Enums"]["staff_role"]
          staff_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          property_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
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
            foreignKeyName: "property_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_log: {
        Row: {
          as_of: string | null
          bank_account_id: string | null
          buildium_bank_account_id: number | null
          buildium_reconciliation_id: number | null
          created_at: string
          ending_balance: number | null
          gl_account_id: string | null
          id: string
          is_finished: boolean
          notes: string | null
          performed_by: string | null
          property_id: string | null
          statement_ending_date: string | null
          total_checks_withdrawals: number | null
          total_deposits_additions: number | null
        }
        Insert: {
          as_of?: string | null
          bank_account_id?: string | null
          buildium_bank_account_id?: number | null
          buildium_reconciliation_id?: number | null
          created_at?: string
          ending_balance?: number | null
          gl_account_id?: string | null
          id?: string
          is_finished?: boolean
          notes?: string | null
          performed_by?: string | null
          property_id?: string | null
          statement_ending_date?: string | null
          total_checks_withdrawals?: number | null
          total_deposits_additions?: number | null
        }
        Update: {
          as_of?: string | null
          bank_account_id?: string | null
          buildium_bank_account_id?: number | null
          buildium_reconciliation_id?: number | null
          created_at?: string
          ending_balance?: number | null
          gl_account_id?: string | null
          id?: string
          is_finished?: boolean
          notes?: string | null
          performed_by?: string | null
          property_id?: string | null
          statement_ending_date?: string | null
          total_checks_withdrawals?: number | null
          total_deposits_additions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_log_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
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
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
          },
          {
            foreignKeyName: "reconciliation_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users_with_auth"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          rent_cycle: Database["public"]["Enums"]["rent_cycle_enum"]
          start_date: string
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
          rent_cycle: Database["public"]["Enums"]["rent_cycle_enum"]
          start_date: string
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
          rent_cycle?: Database["public"]["Enums"]["rent_cycle_enum"]
          start_date?: string
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
          role: Database["public"]["Enums"]["staff_role"]
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
          role?: Database["public"]["Enums"]["staff_role"]
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
          role?: Database["public"]["Enums"]["staff_role"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_auth"
            referencedColumns: ["user_id"]
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
          buildium_subcategory_id: number | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          buildium_category_id?: number | null
          buildium_subcategory_id?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          buildium_category_id?: number | null
          buildium_subcategory_id?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
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
          created_at: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          lease_id: number | null
          notes: string | null
          owner_id: string | null
          priority: string | null
          property_id: string | null
          requested_by_buildium_id: number | null
          requested_by_contact_id: number | null
          requested_by_type: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["transaction_status_enum"]
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
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          lease_id?: number | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          requested_by_buildium_id?: number | null
          requested_by_contact_id?: number | null
          requested_by_type?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["transaction_status_enum"]
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
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          lease_id?: number | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          requested_by_buildium_id?: number | null
          requested_by_contact_id?: number | null
          requested_by_type?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["transaction_status_enum"]
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
            foreignKeyName: "tasks_requested_by_contact_fk"
            columns: ["requested_by_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
            foreignKeyName: "tenants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_auth"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transaction_lines: {
        Row: {
          account_entity_id: number | null
          account_entity_type: Database["public"]["Enums"]["entity_type_enum"]
          amount: number | null
          buildium_lease_id: number | null
          buildium_property_id: number | null
          buildium_unit_id: number | null
          created_at: string
          date: string
          gl_account_id: string | null
          id: string
          lease_id: number | null
          memo: string | null
          posting_type: string
          property_id: string | null
          transaction_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_entity_id?: number | null
          account_entity_type: Database["public"]["Enums"]["entity_type_enum"]
          amount?: number | null
          buildium_lease_id?: number | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          created_at?: string
          date: string
          gl_account_id?: string | null
          id?: string
          lease_id?: number | null
          memo?: string | null
          posting_type: string
          property_id?: string | null
          transaction_id?: string | null
          unit_id?: string | null
          updated_at: string
        }
        Update: {
          account_entity_id?: number | null
          account_entity_type?: Database["public"]["Enums"]["entity_type_enum"]
          amount?: number | null
          buildium_lease_id?: number | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          created_at?: string
          date?: string
          gl_account_id?: string | null
          id?: string
          lease_id?: number | null
          memo?: string | null
          posting_type?: string
          property_id?: string | null
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
            foreignKeyName: "journal_entries_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
            foreignKeyName: "journal_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          bank_account_id: string | null
          buildium_bill_id: number | null
          buildium_lease_id: number | null
          buildium_transaction_id: number | null
          category_id: string | null
          check_number: string | null
          created_at: string
          date: string
          due_date: string | null
          email_receipt: boolean
          id: string
          is_recurring: boolean | null
          lease_id: number | null
          memo: string | null
          org_id: string | null
          payee_tenant_id: number | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          print_receipt: boolean
          paid_date: string | null
          recurring_schedule: Json | null
          reference_number: string | null
          status: string | null
          total_amount: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          bank_account_id?: string | null
          buildium_bill_id?: number | null
          buildium_lease_id?: number | null
          buildium_transaction_id?: number | null
          category_id?: string | null
          check_number?: string | null
          created_at?: string
          date: string
          due_date?: string | null
          email_receipt?: boolean
          id?: string
          is_recurring?: boolean | null
          lease_id?: number | null
          memo?: string | null
          org_id?: string | null
          payee_tenant_id?: number | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          print_receipt?: boolean
          paid_date?: string | null
          recurring_schedule?: Json | null
          reference_number?: string | null
          status?: string | null
          total_amount: number
          transaction_type: Database["public"]["Enums"]["transaction_type_enum"]
          updated_at: string
          vendor_id?: string | null
        }
        Update: {
          bank_account_id?: string | null
          buildium_bill_id?: number | null
          buildium_lease_id?: number | null
          buildium_transaction_id?: number | null
          category_id?: string | null
          check_number?: string | null
          created_at?: string
          date?: string
          due_date?: string | null
          email_receipt?: boolean
          id?: string
          is_recurring?: boolean | null
          lease_id?: number | null
          memo?: string | null
          org_id?: string | null
          payee_tenant_id?: number | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          print_receipt?: boolean
          paid_date?: string | null
          recurring_schedule?: Json | null
          reference_number?: string | null
          status?: string | null
          total_amount?: number
          transaction_type?: Database["public"]["Enums"]["transaction_type_enum"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
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
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_images: {
        Row: {
          buildium_image_id: number
          created_at: string
          description: string | null
          file_size: number | null
          file_type: string | null
          href: string | null
          id: string
          is_private: boolean | null
          name: string | null
          sort_index: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          buildium_image_id: number
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          href?: string | null
          id?: string
          is_private?: boolean | null
          name?: string | null
          sort_index?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          buildium_image_id?: number
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          href?: string | null
          id?: string
          is_private?: boolean | null
          name?: string | null
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
          active_services: string | null
          address_line1: string
          address_line2: string | null
          address_line3: string | null
          building_name: string | null
          buildium_created_at: string | null
          buildium_property_id: number | null
          buildium_unit_id: number | null
          buildium_updated_at: string | null
          city: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at: string
          description: string | null
          fee_frequency: Database["public"]["Enums"]["FeeFrequency"] | null
          fee_notes: string | null
          fee_percent: number | null
          fee_type: Database["public"]["Enums"]["FeeType"] | null
          id: string
          is_active: boolean | null
          last_inspection_date: string | null
          management_fee: number | null
          market_rent: number | null
          next_inspection_date: string | null
          org_id: string
          postal_code: string
          property_id: string
          service_end: string | null
          service_plan: Database["public"]["Enums"]["ServicePlan"] | null
          service_start: string | null
          state: string | null
          status: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_number: string
          unit_name: string
          unit_size: number | null
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          active_services?: string | null
          address_line1: string
          address_line2?: string | null
          address_line3?: string | null
          building_name?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at?: string
          description?: string | null
          fee_frequency?: Database["public"]["Enums"]["FeeFrequency"] | null
          fee_notes?: string | null
          fee_percent?: number | null
          fee_type?: Database["public"]["Enums"]["FeeType"] | null
          id?: string
          is_active?: boolean | null
          last_inspection_date?: string | null
          management_fee?: number | null
          market_rent?: number | null
          next_inspection_date?: string | null
          org_id: string
          postal_code: string
          property_id: string
          service_end?: string | null
          service_plan?: Database["public"]["Enums"]["ServicePlan"] | null
          service_start?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms?: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms?: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_number: string
          /** unit_name is generated; do not supply on insert */
          unit_size?: number | null
          unit_type?: string | null
          updated_at: string
        }
        Update: {
          active_services?: string | null
          address_line1?: string
          address_line2?: string | null
          address_line3?: string | null
          building_name?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_unit_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country?: Database["public"]["Enums"]["countries"]
          created_at?: string
          description?: string | null
          fee_frequency?: Database["public"]["Enums"]["FeeFrequency"] | null
          fee_notes?: string | null
          fee_percent?: number | null
          fee_type?: Database["public"]["Enums"]["FeeType"] | null
          id?: string
          is_active?: boolean | null
          last_inspection_date?: string | null
          management_fee?: number | null
          market_rent?: number | null
          next_inspection_date?: string | null
          org_id?: string
          postal_code?: string
          property_id?: string
          service_end?: string | null
          service_plan?: Database["public"]["Enums"]["ServicePlan"] | null
          service_start?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms?: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms?: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_number?: string
          /** unit_name is generated; do not supply on update */
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
          updated_at: string | null
        }
        Insert: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          buildium_category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
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
          tax_payer_type:
            | Database["public"]["Enums"]["tax_payer_type"]
            | null
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
          tax_payer_type?:
            | Database["public"]["Enums"]["tax_payer_type"]
            | null
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
          tax_payer_type?:
            | Database["public"]["Enums"]["tax_payer_type"]
            | null
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
            foreignKeyName: "vendors_gl_account_fkey"
            columns: ["gl_account"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_gl_account_fkey"
            columns: ["gl_account"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
          format: unknown | null
          id: string | null
          is_identity: boolean | null
          is_nullable: boolean | null
          name: unknown | null
          ordinal_position: number | null
          schema: unknown | null
          table_id: number | null
          table_name: unknown | null
        }
        Relationships: []
      }
      foreign_key_relationships: {
        Row: {
          constraint_name: unknown | null
          id: number | null
          source_column_name: unknown | null
          source_schema: unknown | null
          source_table_name: unknown | null
          target_column_name: unknown | null
          target_table_name: unknown | null
          target_table_schema: unknown | null
        }
        Relationships: []
      }
      index_usage: {
        Row: {
          idx_scan: number | null
          idx_tup_fetch: number | null
          idx_tup_read: number | null
          indexname: unknown | null
          schemaname: unknown | null
          tablename: unknown | null
          usage_status: string | null
        }
        Relationships: []
      }
      invalid_country_values: {
        Row: {
          column_name: string | null
          id: string | null
          table_name: string | null
          value: string | null
        }
        Relationships: []
      }
      lease_documents: {
        Row: {
          category: string | null
          created_at: string | null
          id: string | null
          is_private: boolean | null
          lease_id: number | null
          mime_type: string | null
          name: string | null
          sha256: string | null
          size_bytes: number | null
          storage_path: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      primary_keys: {
        Row: {
          column_name: unknown | null
          schema: unknown | null
          table_id: number | null
          table_name: unknown | null
        }
        Relationships: []
      }
      slow_queries: {
        Row: {
          calls: number | null
          hit_percent: number | null
          mean_exec_time_ms: number | null
          query_preview: string | null
          total_exec_time_ms: number | null
        }
        Relationships: []
      }
      table_info_cache: {
        Row: {
          bytes: number | null
          comment: string | null
          dead_rows_estimate: number | null
          id: number | null
          live_rows_estimate: number | null
          name: unknown | null
          rls_enabled: boolean | null
          rls_forced: boolean | null
          schema: unknown | null
          size: string | null
        }
        Relationships: []
      }
      table_sizes: {
        Row: {
          index_size: string | null
          schemaname: unknown | null
          table_size: string | null
          tablename: unknown | null
          total_size: string | null
        }
        Relationships: []
      }
      task_history_files: {
        Row: {
          buildium_file_id: number | null
          created_at: string | null
          description: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string | null
          task_history_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      users_with_auth: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          last_sign_in_at: string | null
          memberships: Json | null
          phone: string | null
          providers: Json | null
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
      v_gl_trial_balance: {
        Row: {
          account_number: string | null
          balance: number | null
          buildium_gl_account_id: number | null
          credits: number | null
          debits: number | null
          gl_account_id: string | null
          name: string | null
          sub_type: string | null
          type: string | null
        }
        Relationships: []
      }
      v_latest_reconciliation_by_account: {
        Row: {
          gl_account_id: string | null
          last_reconciled_at: string | null
          property_id: string | null
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
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      v_property_onboarding_summary: {
        Row: {
          in_progress: number | null
          org_id: string | null
          overdue: number | null
          pending_approval: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_onboarding_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recent_transactions_ranked: {
        Row: {
          bank_account_id: string | null
          buildium_bill_id: number | null
          buildium_lease_id: number | null
          buildium_transaction_id: number | null
          category_id: string | null
          check_number: string | null
          created_at: string | null
          date: string | null
          due_date: string | null
          id: string | null
          is_recurring: boolean | null
          lease_id: number | null
          memo: string | null
          org_id: string | null
          payee_tenant_id: number | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          recurring_schedule: Json | null
          reference_number: string | null
          rn: number | null
          status: string | null
          total_amount: number | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type_enum"]
            | null
          updated_at: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
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
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reconciliation_alerts: {
        Row: {
          alert_type: string | null
          gl_account_id: string | null
          metric: number | null
          property_id: string | null
          ref_date: string | null
        }
        Relationships: []
      }
      v_reconciliation_stale_alerts: {
        Row: {
          days_since: number | null
          gl_account_id: string | null
          last_reconciled_at: string | null
          property_id: string | null
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
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
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
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
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
            foreignKeyName: "reconciliation_log_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
          },
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
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
      v_work_order_summary: {
        Row: {
          open_count: number | null
          org_id: string | null
          urgent_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_files: {
        Row: {
          buildium_file_id: number | null
          created_at: string | null
          description: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string | null
          updated_at: string | null
          work_order_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_owner_total_properties: {
        Args: { owner_uuid: string }
        Returns: number
      }
      calculate_owner_total_units: {
        Args: { owner_uuid: string }
        Returns: number
      }
      clear_expired_buildium_cache: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      count_active_units_for_property: {
        Args: { property_uuid: string }
        Returns: number
      }
      enforce_same_org: {
        Args: { child_name: string; child_org: string; parent_org: string }
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
        Args: Record<PropertyKey, never>
        Returns: {
          count: number
          owner_id: string
          property_id: string
        }[]
      }
      find_duplicate_units: {
        Args: Record<PropertyKey, never>
        Returns: {
          count: number
          property_id: string
          unit_number: string
        }[]
      }
      fn_create_lease_aggregate: {
        Args: { payload: Json }
        Returns: Json
      }
      fn_create_lease_full: {
        Args: { new_people?: Json; payload: Json }
        Returns: Json
      }
      generate_display_name: {
        Args: { company_name: string; first_name: string; last_name: string }
        Returns: string
      }
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
      get_my_claims: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_property_financials: {
        Args: { p_as_of?: string; p_property_id: string }
        Returns: Json
      }
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
      gl_account_activity: {
        Args:
          | {
              p_from: string
              p_gl_account_ids?: string[]
              p_property_id: string
              p_to: string
            }
          | { p_from: string; p_to: string }
        Returns: {
          account_number: string
          credits: number
          debits: number
          gl_account_id: string
          name: string
          net_change: number
        }[]
      }
      gl_ledger_balance_as_of: {
        Args: {
          p_as_of: string
          p_gl_account_id: string
          p_property_id: string
        }
        Returns: number
      }
      gl_trial_balance_as_of: {
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
      is_platform_admin: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      is_valid_country: {
        Args:
          | { val: Database["public"]["Enums"]["countries"] }
          | { val: string }
        Returns: boolean
      }
      jwt_custom_claims: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      map_bill_to_buildium: {
        Args: { p_bill_id: string }
        Returns: Json
      }
      map_owner_to_buildium: {
        Args: { p_owner_id: string }
        Returns: Json
      }
      map_property_to_buildium: {
        Args: { p_property_id: string }
        Returns: Json
      }
      map_task_to_buildium: {
        Args: { p_task_id: string }
        Returns: Json
      }
      map_unit_to_buildium: {
        Args: { p_unit_id: string }
        Returns: Json
      }
      map_vendor_to_buildium: {
        Args: { p_vendor_id: string }
        Returns: Json
      }
      map_work_order_to_buildium: {
        Args: { p_work_order_id: string }
        Returns: Json
      }
      normalize_country: {
        Args: { val: string }
        Returns: string
      }
      process_buildium_webhook_event: {
        Args: { p_event_data: Json; p_event_id: string; p_event_type: string }
        Returns: boolean
      }
      refresh_schema_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      set_buildium_property_id: {
        Args: {
          p_buildium_property_id: number
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      update_all_owners_total_fields: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_all_properties_total_units: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
      validate_ownership_totals: {
        Args: { p_property_id: string }
        Returns: undefined
      }
    }
    Enums: {
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
      assignment_level: "Property Level" | "Unit Level"
      assignment_level_enum: "Building" | "Unit"
      bank_account_type_enum:
        | "checking"
        | "savings"
        | "money_market"
        | "certificate_of_deposit"
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
      billing_frequency_enum: "Annual" | "Monthly"
      buildium_bank_account_type:
        | "Checking"
        | "Savings"
        | "MoneyMarket"
        | "CertificateOfDeposit"
      transaction_status_enum:
        | ""
        | "Overdue"
        | "Due"
        | "Partially paid"
        | "Paid"
        | "Cancelled"
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
      entity_type_enum: "Rental" | "Company"
      etf_account_type_enum: "Checking" | "Saving"
      fee_type_enum: "Percentage" | "Flat Rate"
      FeeFrequency: "Monthly" | "Annually"
      FeeType: "Percentage" | "Flat Rate"
      inspection_status_enum: "Scheduled" | "Completed"
      inspection_type_enum: "Periodic" | "Move-In" | "Move-Out"
      lease_contact_role_enum: "Tenant" | "Cosigner"
      lease_contact_status_enum: "Future" | "Active" | "Past"
      management_services_enum:
        | "Rent Collection"
        | "Maintenance"
        | "Turnovers"
        | "Compliance"
        | "Bill Pay"
        | "Condition Reports"
        | "Renewals"
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
      payment_method_enum:
        | "Check"
        | "Cash"
        | "MoneyOrder"
        | "CashierCheck"
        | "DirectDeposit"
        | "CreditCard"
        | "ElectronicPayment"
      property_status: "Active" | "Inactive"
      property_type_enum:
        | "Condo"
        | "Co-op"
        | "Condop"
        | "Rental Building"
        | "Townhouse"
        | "Mult-Family"
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
      service_plan_enum: "Full" | "Basic" | "A-la-carte"
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
      tax_payer_type: "SSN" | "EIN"
      task_kind_enum: "owner" | "resident" | "contact" | "todo" | "other"
      transaction_type_enum:
        | "Bill"
        | "Charge"
        | "Credit"
        | "Payment"
        | "JournalEntry"
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
      assignment_level: ["Property Level", "Unit Level"],
      assignment_level_enum: ["Building", "Unit"],
      bank_account_type_enum: [
        "checking",
        "savings",
        "money_market",
        "certificate_of_deposit",
      ],
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
      billing_frequency_enum: ["Annual", "Monthly"],
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
      entity_type_enum: ["Rental", "Company"],
      etf_account_type_enum: ["Checking", "Saving"],
      fee_type_enum: ["Percentage", "Flat Rate"],
      FeeFrequency: ["Monthly", "Annually"],
      FeeType: ["Percentage", "Flat Rate"],
      inspection_status_enum: ["Scheduled", "Completed"],
      inspection_type_enum: ["Periodic", "Move-In", "Move-Out"],
      lease_contact_role_enum: ["Tenant", "Cosigner"],
      lease_contact_status_enum: ["Future", "Active", "Past"],
      management_services_enum: [
        "Rent Collection",
        "Maintenance",
        "Turnovers",
        "Compliance",
        "Bill Pay",
        "Condition Reports",
        "Renewals",
      ],
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
      payment_method_enum: [
        "Check",
        "Cash",
        "MoneyOrder",
        "CashierCheck",
        "DirectDeposit",
        "CreditCard",
        "ElectronicPayment",
      ],
      property_status: ["Active", "Inactive"],
      property_type_enum: [
        "Condo",
        "Co-op",
        "Condop",
        "Rental Building",
        "Townhouse",
        "Mult-Family",
      ],
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
      service_plan_enum: ["Full", "Basic", "A-la-carte"],
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
      transaction_type_enum: [
        "Bill",
        "Charge",
        "Credit",
        "Payment",
        "JournalEntry",
      ],
      unit_status_enum: ["Occupied", "Vacant", "Inactive"],
    },
  },
} as const

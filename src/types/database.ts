export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      appliances: {
        Row: {
          created_at: string
          id: string
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
          created_at?: string
          id?: string
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
          created_at?: string
          id?: string
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
          bank_account_type: string
          buildium_balance: number | null
          buildium_bank_id: number
          created_at: string
          description: string | null
          gl_account: string
          id: string
          is_active: boolean
          name: string
          routing_number: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          balance?: number | null
          bank_account_type: string
          buildium_balance?: number | null
          buildium_bank_id: number
          created_at?: string
          description?: string | null
          gl_account: string
          id?: string
          is_active?: boolean
          name: string
          routing_number?: string | null
          updated_at: string
        }
        Update: {
          account_number?: string | null
          balance?: number | null
          bank_account_type?: string
          buildium_balance?: number | null
          buildium_bank_id?: number
          created_at?: string
          description?: string | null
          gl_account?: string
          id?: string
          is_active?: boolean
          name?: string
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
      buildium_sync_status: {
        Row: {
          buildium_id: number | null
          created_at: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          last_synced_at: string | null
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
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          processed?: boolean | null
          processed_at?: string | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
          name: string
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
          name: string
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
          name?: string
          sub_accounts?: string[] | null
          sub_type?: string | null
          type?: string
          updated_at?: string
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
          payment_due_day: number | null
          propertyId: string
          renewal_offer_status: string | null
          rent_amount: number | null
          security_deposit: number | null
          status: string
          term_type: string | null
          unit_number: string | null
          unitId: string
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
          payment_due_day?: number | null
          propertyId: string
          renewal_offer_status?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          status?: string
          term_type?: string | null
          unit_number?: string | null
          unitId: string
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
          payment_due_day?: number | null
          propertyId?: string
          renewal_offer_status?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          status?: string
          term_type?: string | null
          unit_number?: string | null
          unitId?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Lease_propertyId_fkey"
            columns: ["propertyId"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Lease_unitId_fkey"
            columns: ["unitId"]
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
            foreignKeyName: "lease_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tax_address_line1: string | null
          tax_address_line2: string | null
          tax_address_line3: string | null
          tax_city: string | null
          tax_country: Database["public"]["Enums"]["countries"] | null
          tax_include1099: boolean | null
          tax_payer_id: string | null
          tax_payer_name1: string | null
          tax_payer_name2: string | null
          tax_payer_type: string | null
          tax_postal_code: string | null
          tax_state: string | null
          updated_at: string
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
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_city?: string | null
          tax_country?: Database["public"]["Enums"]["countries"] | null
          tax_include1099?: boolean | null
          tax_payer_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?: string | null
          tax_postal_code?: string | null
          tax_state?: string | null
          updated_at: string
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
          tax_address_line1?: string | null
          tax_address_line2?: string | null
          tax_address_line3?: string | null
          tax_city?: string | null
          tax_country?: Database["public"]["Enums"]["countries"] | null
          tax_include1099?: boolean | null
          tax_payer_id?: string | null
          tax_payer_name1?: string | null
          tax_payer_name2?: string | null
          tax_payer_type?: string | null
          tax_postal_code?: string | null
          tax_state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_contact_fk"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
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
      properties: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_line3: string | null
          buildium_created_at: string | null
          buildium_property_id: number | null
          buildium_updated_at: string | null
          city: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at: string
          deposit_trust_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          operating_bank_account_id: string | null
          postal_code: string
          primary_owner: string | null
          property_type: string | null
          rental_owner_ids: number[] | null
          rental_sub_type: string | null
          rental_type: string | null
          reserve: number | null
          state: string | null
          status: Database["public"]["Enums"]["property_status"]
          structure_description: string | null
          total_units: number
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_line3?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposit_trust_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          operating_bank_account_id?: string | null
          postal_code: string
          primary_owner?: string | null
          property_type?: string | null
          rental_owner_ids?: number[] | null
          rental_sub_type?: string | null
          rental_type?: string | null
          reserve?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          structure_description?: string | null
          total_units?: number
          updated_at: string
          year_built?: number | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_line3?: string | null
          buildium_created_at?: string | null
          buildium_property_id?: number | null
          buildium_updated_at?: string | null
          city?: string | null
          country?: Database["public"]["Enums"]["countries"]
          created_at?: string
          deposit_trust_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          operating_bank_account_id?: string | null
          postal_code?: string
          primary_owner?: string | null
          property_type?: string | null
          rental_owner_ids?: number[] | null
          rental_sub_type?: string | null
          rental_type?: string | null
          reserve?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          structure_description?: string | null
          total_units?: number
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
          buildium_user_id: number | null
          created_at: string
          id: number
          isActive: boolean
          role: string
          updated_at: string
        }
        Insert: {
          buildium_user_id?: number | null
          created_at?: string
          id?: number
          isActive?: boolean
          role?: string
          updated_at: string
        }
        Update: {
          buildium_user_id?: number | null
          created_at?: string
          id?: number
          isActive?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
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
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
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
          updated_at?: string | null
        }
        Relationships: []
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
      task_history_files: {
        Row: {
          buildium_file_id: number | null
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          task_history_id: string | null
          updated_at: string | null
        }
        Insert: {
          buildium_file_id?: number | null
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          task_history_id?: string | null
          updated_at?: string | null
        }
        Update: {
          buildium_file_id?: number | null
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          task_history_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_files_task_history_id_fkey"
            columns: ["task_history_id"]
            isOneToOne: false
            referencedRelation: "task_history"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          buildium_task_id: number | null
          category: string | null
          completed_date: string | null
          created_at: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          notes: string | null
          priority: string | null
          property_id: string | null
          scheduled_date: string | null
          status: string | null
          subject: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          buildium_task_id?: number | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          subject: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          buildium_task_id?: number | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          subject?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          sms_opt_in_status: string | null
          tax_id: string | null
          updated_at: string
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
          sms_opt_in_status?: string | null
          tax_id?: string | null
          updated_at: string
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
          sms_opt_in_status?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_lines: {
        Row: {
          account_entity_id: number | null
          account_entity_type: Database["public"]["Enums"]["entity_type_enum"]
          amount: number | null
          buildium_journal_id: number | null
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
          buildium_journal_id?: number | null
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
          buildium_journal_id?: number | null
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
          buildium_bill_id: number | null
          buildium_transaction_id: number | null
          category_id: string | null
          CheckNumber: string | null
          created_at: string
          Date: string
          due_date: string | null
          id: string
          is_recurring: boolean | null
          lease_id: number | null
          Memo: string | null
          PayeeTenantId: number | null
          PaymentMethod: string | null
          recurring_schedule: Json | null
          reference_number: string | null
          status: string | null
          TotalAmount: number
          TransactionType: Database["public"]["Enums"]["transaction_type_enum"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          buildium_bill_id?: number | null
          buildium_transaction_id?: number | null
          category_id?: string | null
          CheckNumber?: string | null
          created_at?: string
          Date: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          lease_id?: number | null
          Memo?: string | null
          PayeeTenantId?: number | null
          PaymentMethod?: string | null
          recurring_schedule?: Json | null
          reference_number?: string | null
          status?: string | null
          TotalAmount: number
          TransactionType: Database["public"]["Enums"]["transaction_type_enum"]
          updated_at: string
          vendor_id?: string | null
        }
        Update: {
          buildium_bill_id?: number | null
          buildium_transaction_id?: number | null
          category_id?: string | null
          CheckNumber?: string | null
          created_at?: string
          Date?: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          lease_id?: number | null
          Memo?: string | null
          PayeeTenantId?: number | null
          PaymentMethod?: string | null
          recurring_schedule?: Json | null
          reference_number?: string | null
          status?: string | null
          TotalAmount?: number
          TransactionType?: Database["public"]["Enums"]["transaction_type_enum"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
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
            foreignKeyName: "transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
          postal_code: string
          property_id: string
          service_end: string | null
          service_plan: Database["public"]["Enums"]["ServicePlan"] | null
          service_start: string | null
          square_footage: number | null
          state: string | null
          status: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_number: string
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
          postal_code: string
          property_id: string
          service_end?: string | null
          service_plan?: Database["public"]["Enums"]["ServicePlan"] | null
          service_start?: string | null
          square_footage?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms?: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms?: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_number: string
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
          postal_code?: string
          property_id?: string
          service_end?: string | null
          service_plan?: Database["public"]["Enums"]["ServicePlan"] | null
          service_start?: string | null
          square_footage?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status_enum"]
          unit_bathrooms?: Database["public"]["Enums"]["bathroom_enum"] | null
          unit_bedrooms?: Database["public"]["Enums"]["bedroom_enum"] | null
          unit_number?: string
          unit_size?: number | null
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
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
          address_line1: string | null
          address_line2: string | null
          buildium_vendor_id: number | null
          category_id: number | null
          city: string | null
          contact_name: string | null
          country: Database["public"]["Enums"]["countries"] | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone_number: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          buildium_vendor_id?: number | null
          category_id?: number | null
          city?: string | null
          contact_name?: string | null
          country?: Database["public"]["Enums"]["countries"] | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone_number?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          buildium_vendor_id?: number | null
          category_id?: number | null
          city?: string | null
          contact_name?: string | null
          country?: Database["public"]["Enums"]["countries"] | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone_number?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
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
          priority: string | null
          property_id: string | null
          scheduled_date: string | null
          status: string | null
          subject: string
          unit_id: string | null
          updated_at: string | null
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
          priority?: string | null
          property_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          subject: string
          unit_id?: string | null
          updated_at?: string | null
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
          priority?: string | null
          property_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          subject?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
        ]
      }
    }
    Views: {
      invalid_country_values: {
        Row: {
          column_name: string | null
          id: string | null
          table_name: string | null
          value: Database["public"]["Enums"]["countries"] | null
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
      generate_display_name: {
        Args: { company_name: string; first_name: string; last_name: string }
        Returns: string
      }
      get_buildium_api_cache: {
        Args: { p_endpoint: string; p_parameters?: Json }
        Returns: Json
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
      is_valid_country: {
        Args: { val: string }
        Returns: boolean
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
      process_buildium_webhook_event: {
        Args: { p_event_data: Json; p_event_id: string; p_event_type: string }
        Returns: boolean
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
      upsert_owners_list_cache: {
        Args: { p_owner_id: string }
        Returns: undefined
      }
      upsert_property_ownerships_cache: {
        Args: { p_ownership_id: string }
        Returns: undefined
      }
    }
    Enums: {
      appliance_type_enum:
        | "Refrigerator"
        | "Freezer"
        | "Stove"
        | "Microwave"
        | "Dishwasher"
        | "Washer/Dryer"
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
      FeeFrequency: "Monthly" | "Annually"
      FeeType: "Percentage" | "Flat Rate"
      inspection_status_enum: "Scheduled" | "Completed"
      inspection_type_enum: "Periodic" | "Move-In" | "Move-Out"
      lease_contact_role_enum: "Tenant" | "Cosigner"
      lease_contact_status_enum: "Future" | "Active" | "Past"
      property_status: "Active" | "Inactive"
      rent_cycle_enum:
        | "Monthly"
        | "Weekly"
        | "Every2Weeks"
        | "Quarterly"
        | "Yearly"
        | "Every2Months"
        | "Daily"
        | "Every6Months"
      ServicePlan: "Full" | "Basic" | "A-la-carte"
      transaction_type_enum: "Bill" | "Charge" | "Credit" | "Payment"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appliance_type_enum: [
        "Refrigerator",
        "Freezer",
        "Stove",
        "Microwave",
        "Dishwasher",
        "Washer/Dryer",
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
      FeeFrequency: ["Monthly", "Annually"],
      FeeType: ["Percentage", "Flat Rate"],
      inspection_status_enum: ["Scheduled", "Completed"],
      inspection_type_enum: ["Periodic", "Move-In", "Move-Out"],
      lease_contact_role_enum: ["Tenant", "Cosigner"],
      lease_contact_status_enum: ["Future", "Active", "Past"],
      property_status: ["Active", "Inactive"],
      rent_cycle_enum: [
        "Monthly",
        "Weekly",
        "Every2Weeks",
        "Quarterly",
        "Yearly",
        "Every2Months",
        "Daily",
        "Every6Months",
      ],
      ServicePlan: ["Full", "Basic", "A-la-carte"],
      transaction_type_enum: ["Bill", "Charge", "Credit", "Payment"],
      unit_status_enum: ["Occupied", "Vacant", "Inactive"],
    },
  },
} as const


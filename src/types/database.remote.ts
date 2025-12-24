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
    PostgrestVersion: "13.0.4"
  }
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
          public_id: number
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
          public_id?: number
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
          public_id?: number
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
            referencedRelation: "transaction_amounts"
            referencedColumns: ["id"]
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
            foreignKeyName: "billing_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      building_permit_units: {
        Row: {
          created_at: string
          id: string
          permit_id: string
          public_id: number
          unit_id: string | null
          unit_reference: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          permit_id: string
          public_id?: number
          unit_id?: string | null
          unit_reference?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          permit_id?: string
          public_id?: number
          unit_id?: string | null
          unit_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_permit_units_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "building_permits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_permit_units_unit_id_fkey"
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
      buildium_api_cache: {
        Row: {
          created_at: string | null
          endpoint: string
          expires_at: string
          id: string
          parameters: Json | null
          public_id: number
          response_data: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          expires_at: string
          id?: string
          parameters?: Json | null
          public_id?: number
          response_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          expires_at?: string
          id?: string
          parameters?: Json | null
          public_id?: number
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          {
            foreignKeyName: "gl_account_category_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: true
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
          public_id: number
          sub_accounts: string[] | null
          sub_type: string | null
          type: string
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
          public_id?: number
          sub_accounts?: string[] | null
          sub_type?: string | null
          type: string
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
          public_id?: number
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
          public_id: number
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
          public_id?: number
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
          public_id?: number
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_transaction_id_fkey1"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_amounts"
            referencedColumns: ["id"]
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
      nyc_open_data_integrations: {
        Row: {
          app_token_encrypted: string | null
          base_url: string
          created_at: string
          dataset_asbestos_violations: string
          dataset_bedbug_reporting: string
          dataset_dob_active_violations: string
          dataset_dob_certificate_of_occupancy_now: string
          dataset_dob_certificate_of_occupancy_old: string
          dataset_dob_complaints: string
          dataset_dob_ecb_violations: string
          dataset_dob_job_applications: string
          dataset_dob_now_approved_permits: string
          dataset_dob_now_job_filings: string
          dataset_dob_now_safety_boiler: string
          dataset_dob_now_safety_facade: string
          dataset_dob_permit_issuance_old: string
          dataset_dob_violations: string
          dataset_elevator_complaints: string
          dataset_elevator_devices: string
          dataset_elevator_inspections: string
          dataset_elevator_violations: string
          dataset_elevator_violations_active: string
          dataset_elevator_violations_historic: string
          dataset_fdny_violations: string
          dataset_heat_sensor_program: string
          dataset_hpd_complaints: string
          dataset_hpd_registrations: string
          dataset_hpd_violations: string
          dataset_sidewalk_violations: string
          deleted_at: string | null
          geoservice_api_key_encrypted: string | null
          geoservice_app_id_encrypted: string | null
          geoservice_base_url: string | null
          id: string
          is_enabled: boolean
          org_id: string
          public_id: number
          updated_at: string
        }
        Insert: {
          app_token_encrypted?: string | null
          base_url?: string
          created_at?: string
          dataset_asbestos_violations?: string
          dataset_bedbug_reporting?: string
          dataset_dob_active_violations?: string
          dataset_dob_certificate_of_occupancy_now?: string
          dataset_dob_certificate_of_occupancy_old?: string
          dataset_dob_complaints?: string
          dataset_dob_ecb_violations?: string
          dataset_dob_job_applications?: string
          dataset_dob_now_approved_permits?: string
          dataset_dob_now_job_filings?: string
          dataset_dob_now_safety_boiler?: string
          dataset_dob_now_safety_facade?: string
          dataset_dob_permit_issuance_old?: string
          dataset_dob_violations?: string
          dataset_elevator_complaints?: string
          dataset_elevator_devices?: string
          dataset_elevator_inspections?: string
          dataset_elevator_violations?: string
          dataset_elevator_violations_active?: string
          dataset_elevator_violations_historic?: string
          dataset_fdny_violations?: string
          dataset_heat_sensor_program?: string
          dataset_hpd_complaints?: string
          dataset_hpd_registrations?: string
          dataset_hpd_violations?: string
          dataset_sidewalk_violations?: string
          deleted_at?: string | null
          geoservice_api_key_encrypted?: string | null
          geoservice_app_id_encrypted?: string | null
          geoservice_base_url?: string | null
          id?: string
          is_enabled?: boolean
          org_id: string
          public_id?: number
          updated_at?: string
        }
        Update: {
          app_token_encrypted?: string | null
          base_url?: string
          created_at?: string
          dataset_asbestos_violations?: string
          dataset_bedbug_reporting?: string
          dataset_dob_active_violations?: string
          dataset_dob_certificate_of_occupancy_now?: string
          dataset_dob_certificate_of_occupancy_old?: string
          dataset_dob_complaints?: string
          dataset_dob_ecb_violations?: string
          dataset_dob_job_applications?: string
          dataset_dob_now_approved_permits?: string
          dataset_dob_now_job_filings?: string
          dataset_dob_now_safety_boiler?: string
          dataset_dob_now_safety_facade?: string
          dataset_dob_permit_issuance_old?: string
          dataset_dob_violations?: string
          dataset_elevator_complaints?: string
          dataset_elevator_devices?: string
          dataset_elevator_inspections?: string
          dataset_elevator_violations?: string
          dataset_elevator_violations_active?: string
          dataset_elevator_violations_historic?: string
          dataset_fdny_violations?: string
          dataset_heat_sensor_program?: string
          dataset_hpd_complaints?: string
          dataset_hpd_registrations?: string
          dataset_hpd_violations?: string
          dataset_sidewalk_violations?: string
          deleted_at?: string | null
          geoservice_api_key_encrypted?: string | null
          geoservice_app_id_encrypted?: string | null
          geoservice_base_url?: string | null
          id?: string
          is_enabled?: boolean
          org_id?: string
          public_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nyc_open_data_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      owners_list_cache: {
        Row: {
          contact_id: number
          display_name: string | null
          management_agreement_end_date: string | null
          management_agreement_start_date: string | null
          owner_id: string
          primary_email: string | null
          primary_phone: string | null
          public_id: string
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
          public_id?: string
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
          public_id?: string
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
          {
            foreignKeyName: "ownerships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
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
            foreignKeyName: "properties_deposit_trust_gl_account_id_fkey"
            columns: ["deposit_trust_gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
          },
          {
            foreignKeyName: "properties_operating_bank_gl_account_id_fkey"
            columns: ["operating_bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_operating_bank_gl_account_id_fkey"
            columns: ["operating_bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
      property_automation_overrides: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          offering_id: string
          override_config: Json
          property_id: string
          public_id: number
          rule_id: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offering_id: string
          override_config: Json
          property_id: string
          public_id?: number
          rule_id: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offering_id?: string
          override_config?: Json
          property_id?: string
          public_id?: number
          rule_id?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_automation_overrides_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_automation_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_automation_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_automation_overrides_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "service_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_automation_overrides_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
          public_id: number
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
          public_id?: number
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
          public_id?: number
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
          {
            foreignKeyName: "property_onboarding_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
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
          public_id: number
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
          public_id?: number
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
          public_id?: number
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
      reconciliation_log: {
        Row: {
          as_of: string | null
          bank_gl_account_id: string | null
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
          public_id: number
          statement_ending_date: string | null
          total_checks_withdrawals: number | null
          total_deposits_additions: number | null
        }
        Insert: {
          as_of?: string | null
          bank_gl_account_id?: string | null
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
          public_id?: number
          statement_ending_date?: string | null
          total_checks_withdrawals?: number | null
          total_deposits_additions?: number | null
        }
        Update: {
          as_of?: string | null
          bank_gl_account_id?: string | null
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
          public_id?: number
          statement_ending_date?: string | null
          total_checks_withdrawals?: number | null
          total_deposits_additions?: number | null
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
            foreignKeyName: "reconciliation_log_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string | null
          public_id: number
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          permission_id?: string | null
          public_id?: number
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          permission_id?: string | null
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
      service_fee_history: {
        Row: {
          amount: number
          billing_event_id: string | null
          calculation_details: Json | null
          created_at: string | null
          id: string
          offering_id: string | null
          plan_id: Database["public"]["Enums"]["service_plan_enum"] | null
          public_id: number
          transaction_id: string | null
        }
        Insert: {
          amount: number
          billing_event_id?: string | null
          calculation_details?: Json | null
          created_at?: string | null
          id?: string
          offering_id?: string | null
          plan_id?: Database["public"]["Enums"]["service_plan_enum"] | null
          public_id?: number
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          billing_event_id?: string | null
          calculation_details?: Json | null
          created_at?: string | null
          id?: string
          offering_id?: string | null
          plan_id?: Database["public"]["Enums"]["service_plan_enum"] | null
          public_id?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_fee_history_billing_event_id_fkey"
            columns: ["billing_event_id"]
            isOneToOne: false
            referencedRelation: "billing_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_fee_history_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_fee_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_amounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_fee_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_fee_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_recent_transactions_ranked"
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
          public_id?: number
          updated_at?: string | null
        }
        Relationships: []
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
            foreignKeyName: "service_plans_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
          account_entity_type: Database["public"]["Enums"]["entity_type_enum"]
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
            referencedRelation: "transaction_amounts"
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
            referencedRelation: "transaction_amounts"
            referencedColumns: ["id"]
          },
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
          bank_gl_account_buildium_id: number | null
          bank_gl_account_id: string | null
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
          internal_transaction_is_pending: boolean | null
          internal_transaction_result_code: string | null
          internal_transaction_result_date: string | null
          is_internal_transaction: boolean | null
          is_recurring: boolean | null
          lease_id: number | null
          legacy_memo: string | null
          memo: string | null
          monthly_log_id: string | null
          org_id: string | null
          paid_date: string | null
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
          public_id: number
          recurring_schedule: Json | null
          reference_number: string | null
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
          bank_gl_account_buildium_id?: number | null
          bank_gl_account_id?: string | null
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
          internal_transaction_is_pending?: boolean | null
          internal_transaction_result_code?: string | null
          internal_transaction_result_date?: string | null
          is_internal_transaction?: boolean | null
          is_recurring?: boolean | null
          lease_id?: number | null
          legacy_memo?: string | null
          memo?: string | null
          monthly_log_id?: string | null
          org_id?: string | null
          paid_date?: string | null
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
          public_id?: number
          recurring_schedule?: Json | null
          reference_number?: string | null
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
          bank_gl_account_buildium_id?: number | null
          bank_gl_account_id?: string | null
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
          internal_transaction_is_pending?: boolean | null
          internal_transaction_result_code?: string | null
          internal_transaction_result_date?: string | null
          is_internal_transaction?: boolean | null
          is_recurring?: boolean | null
          lease_id?: number | null
          legacy_memo?: string | null
          memo?: string | null
          monthly_log_id?: string | null
          org_id?: string | null
          paid_date?: string | null
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
          public_id?: number
          recurring_schedule?: Json | null
          reference_number?: string | null
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
            foreignKeyName: "transactions_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
      buildium_webhook_events_unhandled: {
        Row: {
          buildium_webhook_id: string | null
          created_at: string | null
          error: string | null
          error_message: string | null
          event_created_at: string | null
          event_entity_id: string | null
          event_name: string | null
          event_type: string | null
          id: string | null
          processed: boolean | null
          processed_at: string | null
          received_at: string | null
          retry_count: number | null
          signature: string | null
          status: string | null
          webhook_type: string | null
        }
        Insert: {
          buildium_webhook_id?: string | null
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          event_created_at?: string | null
          event_entity_id?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          retry_count?: number | null
          signature?: string | null
          status?: string | null
          webhook_type?: string | null
        }
        Update: {
          buildium_webhook_id?: string | null
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          event_created_at?: string | null
          event_entity_id?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          retry_count?: number | null
          signature?: string | null
          status?: string | null
          webhook_type?: string | null
        }
        Relationships: []
      }
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
      foreign_key_relationships: {
        Row: {
          constraint_name: unknown
          id: number | null
          source_column_name: unknown
          source_schema: unknown
          source_table_name: unknown
          target_column_name: unknown
          target_table_name: unknown
          target_table_schema: unknown
        }
        Relationships: []
      }
      index_usage: {
        Row: {
          idx_scan: number | null
          idx_tup_fetch: number | null
          idx_tup_read: number | null
          indexname: unknown
          schemaname: unknown
          tablename: unknown
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
      primary_keys: {
        Row: {
          column_name: unknown
          schema: unknown
          table_id: number | null
          table_name: unknown
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
          name: unknown
          rls_enabled: boolean | null
          rls_forced: boolean | null
          schema: unknown
          size: string | null
        }
        Relationships: []
      }
      table_sizes: {
        Row: {
          index_size: string | null
          schemaname: unknown
          table_size: string | null
          tablename: unknown
          total_size: string | null
        }
        Relationships: []
      }
      transaction_amounts: {
        Row: {
          account_name: string | null
          created_at: string | null
          date: string | null
          effective_amount: number | null
          id: string | null
          lease_id: number | null
          memo: string | null
          monthly_log_id: string | null
          reference_number: string | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type_enum"]
            | null
        }
        Relationships: [
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
        ]
      }
      unbalanced_transactions: {
        Row: {
          credit_total: number | null
          debit_total: number | null
          diff: number | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_amounts"
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
        ]
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
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
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
      v_legacy_management_fees: {
        Row: {
          monthly_log_id: string | null
          offering_ids: string[] | null
          plan_id: Database["public"]["Enums"]["service_plan_enum"] | null
          total_management_fee: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_monthly_log_id_fkey"
            columns: ["monthly_log_id"]
            isOneToOne: false
            referencedRelation: "monthly_logs"
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
            foreignKeyName: "transactions_bank_gl_account_id_fkey"
            columns: ["bank_gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_gl_trial_balance"
            referencedColumns: ["gl_account_id"]
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
          {
            foreignKeyName: "reconciliation_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_service_revenue_by_owner"
            referencedColumns: ["property_id"]
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
    }
    Functions: {
      _parse_bool: { Args: { p_value: string }; Returns: boolean }
      _parse_date: { Args: { p_value: string }; Returns: string }
      _parse_timestamptz: { Args: { p_value: string }; Returns: string }
      acquire_compliance_lock: { Args: { lock_key: string }; Returns: boolean }
      calculate_owner_total_properties: {
        Args: { owner_uuid: string }
        Returns: number
      }
      calculate_owner_total_units: {
        Args: { owner_uuid: string }
        Returns: number
      }
      clear_expired_buildium_cache: { Args: never; Returns: number }
      count_active_units_for_property: {
        Args: { property_uuid: string }
        Returns: number
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
      gl_account_balance_as_of: {
        Args: {
          p_org_id: string
          p_gl_account_id: string
          p_as_of: string
          p_property_id?: string | null
        }
        Returns: number
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
      has_permission: {
        Args: { p_org_id: string; p_permission_key: string; p_user_id: string }
        Returns: boolean
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
      process_buildium_webhook_event: {
        Args: { p_event_data: Json; p_event_id: string; p_event_type: string }
        Returns: boolean
      }
      reconcile_monthly_log_balance: {
        Args: { p_monthly_log_id: string }
        Returns: undefined
      }
      refresh_mat_view_concurrently: {
        Args: { view_name: string }
        Returns: unknown
      }
      refresh_schema_cache: { Args: never; Returns: undefined }
      release_compliance_lock: { Args: { lock_key: string }; Returns: boolean }
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
      set_buildium_property_id: {
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
      validate_ownership_totals: {
        Args: { p_property_id: string }
        Returns: undefined
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

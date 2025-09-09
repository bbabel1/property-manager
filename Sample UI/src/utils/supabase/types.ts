// Supabase Database Types
// Generated and extended to include Buildium-compatible property relationships

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      rental_owners: {
        Row: {
          id: string;
          contact_id: string | null;
          created_at: string;
          updated_at: string;
          // Extended fields from Guidelines.md JOIN pattern
          rental_owner_id?: string; // Alias for id when using Guidelines pattern
          first_name?: string | null; // From joined contacts table
          last_name?: string | null; // From joined contacts table
          email?: string | null; // From joined contacts table
          phone?: string | null; // From joined contacts table
          contacts?: {
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            phone: string | null;
            address_line1: string | null;
            address_line2: string | null;
            city: string | null;
            state: string | null;
            postal_code: string | null;
            country: string | null;
            created_at: string;
            updated_at: string;
          } | null;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      properties: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          type: string | null;
          units_count: number | null; // Number of units in property
          user_id: string | null; // Made optional - may not exist in all schemas
          created_at: string;
          updated_at: string;
          // Buildium-compatible extensions
          rental_owner_ids?: string[]; // Array of owner IDs for compatibility
          units?: Array<{
            id: string;
            name: string;
            bedrooms: number | null;
            bathrooms: number | null;
            square_feet: number | null;
            rent: number | null;
            status: string;
          }>; // Embedded units from join
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          type?: string | null;
          units_count?: number | null;
          user_id?: string | null; // Made optional
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          type?: string | null;
          units_count?: number | null;
          user_id?: string | null; // Made optional
          created_at?: string;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          property_id: string; // Foreign key to properties
          name: string; // Unit identifier (e.g., "1A", "Unit 101")
          bedrooms: number | null;
          bathrooms: number | null;
          square_feet: number | null;
          rent: number | null;
          status: string; // 'available', 'occupied', 'maintenance', etc.
          user_id: string | null; // Made optional - may not exist in all schemas
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          bedrooms?: number | null;
          bathrooms?: number | null;
          square_feet?: number | null;
          rent?: number | null;
          status?: string;
          user_id?: string | null; // Made optional
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          bedrooms?: number | null;
          bathrooms?: number | null;
          square_feet?: number | null;
          rent?: number | null;
          status?: string;
          user_id?: string | null; // Made optional
          created_at?: string;
          updated_at?: string;
        };
      };
      ownership: {
        Row: {
          id: string;
          property_id: string;
          owner_id: string; // rental_owner_id
          ownership_percent: number;
          disbursement_percent: number;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          owner_id: string;
          ownership_percent: number;
          disbursement_percent: number;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          owner_id?: string;
          ownership_percent?: number;
          disbursement_percent?: number;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      leases: {
        Row: {
          id: string;
          unit_id: string;
          property_id: string | null;               // NEW
          unit_number: string | null;               // NEW (denorm)

          start_date: string;                       // 'YYYY-MM-DD'
          end_date: string;                         // 'YYYY-MM-DD'
          rent: string;                             // numeric -> string in JS
          security_deposit: string;
          status: 'active' | 'expired' | 'terminated' | 'pending';

          lease_type: 'residential' | 'commercial' | 'fixed_term' | 'month_to_month' | 'sublease' | null;         // NEW
          term_type: 'fixed_term' | 'month_to_month' | 'week_to_week' | 'at_will' | null;           // NEW
          renewal_offer_status: 'none' | 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'; // NEW ('none' default)
          payment_due_day: number | null;           // NEW (1..31)
          is_eviction_pending: boolean;             // NEW
          automatically_move_out_tenants: boolean;  // NEW

          account_details: unknown | null;          // NEW (JSONB)
          move_out_data: unknown | null;            // NEW (JSONB)
          current_number_of_occupants: number | null; // NEW (maintained by trigger)

          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          property_id?: string | null;
          unit_number?: string | null;
          start_date: string;
          end_date: string;
          rent: number | string;
          security_deposit?: number | string;
          status?: 'active' | 'expired' | 'terminated' | 'pending';
          lease_type?: 'residential' | 'commercial' | 'fixed_term' | 'month_to_month' | 'sublease' | null;
          term_type?: 'fixed_term' | 'month_to_month' | 'week_to_week' | 'at_will' | null;
          renewal_offer_status?: 'none' | 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          payment_due_day?: number | null;
          is_eviction_pending?: boolean;
          automatically_move_out_tenants?: boolean;
          account_details?: unknown | null;
          move_out_data?: unknown | null;
          current_number_of_occupants?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          property_id?: string | null;
          unit_number?: string | null;
          start_date?: string;
          end_date?: string;
          rent?: number | string;
          security_deposit?: number | string;
          status?: 'active' | 'expired' | 'terminated' | 'pending';
          lease_type?: 'residential' | 'commercial' | 'fixed_term' | 'month_to_month' | 'sublease' | null;
          term_type?: 'fixed_term' | 'month_to_month' | 'week_to_week' | 'at_will' | null;
          renewal_offer_status?: 'none' | 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          payment_due_day?: number | null;
          is_eviction_pending?: boolean;
          automatically_move_out_tenants?: boolean;
          account_details?: unknown | null;
          move_out_data?: unknown | null;
          current_number_of_occupants?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lease_tenants: {
        Row: {
          lease_id: string;
          tenant_id: string;
          role: 'primary' | 'occupant' | 'cosigner' | 'other';
          created_at: string;
        };
        Insert: {
          lease_id: string;
          tenant_id: string;
          role: 'primary' | 'occupant' | 'cosigner' | 'other';
          created_at?: string;
        };
        Update: {
          lease_id?: string;
          tenant_id?: string;
          role?: 'primary' | 'occupant' | 'cosigner' | 'other';
          created_at?: string;
        };
      };
      staff: {
        Row: {
          id: string;
          contact_id: string | null;
          role: string;
          user_id: string | null; // Made optional for flexibility
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          role: string;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          role?: string;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          property: string;
          unit: string | null;
          rent: number;
          lease_start: string;
          lease_end: string;
          status: string;
          payment_status: string;
          user_id: string | null; // Made optional for flexibility
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          property: string;
          unit?: string | null;
          rent: number;
          lease_start: string;
          lease_end: string;
          status?: string;
          payment_status?: string;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          property?: string;
          unit?: string | null;
          rent?: number;
          lease_start?: string;
          lease_end?: string;
          status?: string;
          payment_status?: string;
          user_id?: string | null;
          created_at?: string;
        };
      };
      bank_accounts: {
        Row: {
          id: string;
          name: string;
          account_type: string;
          user_id: string | null; // Made optional for flexibility
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          account_type?: string;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          account_type?: string;
          user_id?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Type aliases for easier use
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// Specific type aliases
export type Contact = Tables<'contacts'>['Row'];
export type ContactInsert = TablesInsert<'contacts'>;
export type ContactUpdate = TablesUpdate<'contacts'>;

export type RentalOwner = Tables<'rental_owners'>['Row'];
export type RentalOwnerInsert = TablesInsert<'rental_owners'>;
export type RentalOwnerUpdate = TablesUpdate<'rental_owners'>;

export type Property = Tables<'properties'>['Row'];
export type PropertyInsert = TablesInsert<'properties'>;
export type PropertyUpdate = TablesUpdate<'properties'>;

export type Unit = Tables<'units'>['Row'];
export type UnitInsert = TablesInsert<'units'>;
export type UnitUpdate = TablesUpdate<'units'>;

export type Ownership = Tables<'ownership'>['Row'];
export type OwnershipInsert = TablesInsert<'ownership'>;
export type OwnershipUpdate = TablesUpdate<'ownership'>;

export type Lease = Tables<'leases'>['Row'];
export type LeaseInsert = TablesInsert<'leases'>;
export type LeaseUpdate = TablesUpdate<'leases'>;

export type LeaseTenant = Tables<'lease_tenants'>['Row'];
export type LeaseTenantInsert = TablesInsert<'lease_tenants'>;
export type LeaseTenantUpdate = TablesUpdate<'lease_tenants'>;

export type Staff = Tables<'staff'>['Row'];
export type StaffInsert = TablesInsert<'staff'>;
export type StaffUpdate = TablesUpdate<'staff'>;

export type Tenant = Tables<'tenants'>['Row'];
export type TenantInsert = TablesInsert<'tenants'>;
export type TenantUpdate = TablesUpdate<'tenants'>;

export type BankAccount = Tables<'bank_accounts'>['Row'];
export type BankAccountInsert = TablesInsert<'bank_accounts'>;
export type BankAccountUpdate = TablesUpdate<'bank_accounts'>;

// ---------- Enums ----------
export type LeaseTypeEnum =
  | 'residential'
  | 'commercial'
  | 'fixed_term'
  | 'month_to_month'
  | 'sublease';

export type TermTypeEnum =
  | 'fixed_term'
  | 'month_to_month'
  | 'week_to_week'
  | 'at_will';

export type RenewalOfferStatusEnum =
  | 'none'
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired';

// Roles used in public.lease_tenants.role
export type TenantRole = 'primary' | 'occupant' | 'cosigner' | 'other';

// ---------- Core rows you actually use ----------
export interface LeaseRow {
  id: string;
  unit_id: string;
  property_id: string | null;               // NEW
  unit_number: string | null;               // NEW (denorm)

  start_date: string;                       // 'YYYY-MM-DD'
  end_date: string;                         // 'YYYY-MM-DD'
  rent: string;                             // numeric -> string in JS
  security_deposit: string;
  status: 'active' | 'expired' | 'terminated' | 'pending';

  lease_type: LeaseTypeEnum | null;         // NEW
  term_type: TermTypeEnum | null;           // NEW
  renewal_offer_status: RenewalOfferStatusEnum; // NEW ('none' default)
  payment_due_day: number | null;           // NEW (1..31)
  is_eviction_pending: boolean;             // NEW
  automatically_move_out_tenants: boolean;  // NEW

  account_details: unknown | null;          // NEW (JSONB)
  move_out_data: unknown | null;            // NEW (JSONB)
  current_number_of_occupants: number | null; // NEW (maintained by trigger)

  created_at: string;
  updated_at: string;
}

// Minimal join table shape you likely use in code
export interface LeaseTenantRow {
  lease_id: string;
  tenant_id: string;
  role: TenantRole;
  created_at: string;
}

// ---------- Narrow DTOs for safer inserts/updates ----------
export type LeaseInsertRequest = Partial<
  Pick<
    LeaseRow,
    | 'lease_type'
    | 'term_type'
    | 'renewal_offer_status'
    | 'payment_due_day'
    | 'is_eviction_pending'
    | 'automatically_move_out_tenants'
    | 'account_details'
    | 'move_out_data'
  >
> & {
  unit_id: string;
  start_date: string;
  end_date: string;
  rent: number | string;
  security_deposit?: number | string;
};

export type LeaseUpdateRequest = Partial<
  Omit<LeaseRow, 'id' | 'created_at' | 'updated_at'>
> & { id: string };

// For attaching parties
export interface AttachPartiesInput {
  lease_id: string;
  primary_tenant_id: string;
  occupant_ids?: string[];
  cosigner_ids?: string[];
}

// Extended types for Guidelines.md JOIN pattern
export interface RentalOwnerWithContact {
  id: string; // rental_owner_id from Guidelines
  rental_owner_id: string; // Explicit alias
  contact_id: string | null;
  created_at: string;
  updated_at: string;
  // Contact fields from JOIN
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  // Full contact object for nested access
  contacts: Contact | null;
}

// Frontend display interface following Guidelines pattern
export interface RentalOwnerDisplay {
  id: string; // rental_owner_id
  firstName: string;
  lastName: string;
  companyName: string;
  isCompany: boolean;
  fullName: string; // Computed from first_name + last_name
  email: string;
  phone: string;
  address: string;
  contactId: string | null;
  createdAt: string;
  source: 'database' | 'kv_store' | 'error';
  queryUsed: string;
  contactsAvailable: boolean;
  contactData: Contact | null;
}

// Buildium-compatible Property interfaces
export interface PropertyWithRelationships {
  id: string;
  name: string;
  address: string | null;
  type: string | null;
  units_count: number | null;
  user_id: string | null; // Made optional
  created_at: string;
  updated_at: string;
  // Property manager information
  property_manager_id?: string | null;
  property_manager_name?: string | null;
  // Buildium-compatible fields
  rental_owner_ids: string[]; // Array of rental owner IDs from ownership table
  units: Array<{
    id: string;
    name: string;
    bedrooms: number | null;
    bathrooms: number | null;
    square_feet: number | null;
    rent: number | null;
    status: string;
  }>; // Embedded units from units table
  // Ownership details
  ownerships: Array<{
    owner_id: string;
    ownership_percent: number;
    disbursement_percent: number;
    is_primary: boolean;
    owner_name: string; // From joined rental owner contact
    contact_info?: {
      email: string | null;
      phone: string | null;
    } | null;
  }>;
  totalOwners: number;
  primaryOwner: string | null;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
}

// Individual address components interface
export interface PropertyAddressComponents {
  street_address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  postal_code: string | null;
  country: string | null;
}

// Property manager data structure following Guidelines.md
export interface PropertyManagerData {
  id: string;
  title: string | null;
  is_active: boolean | null;
  name: string;
  email: string | null;
  phone: string | null;
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
}

// Enhanced ownership structure following Guidelines.md
export interface PropertyOwnershipDetails {
  owner_id: string;
  ownership_percent: number;
  disbursement_percent: number;
  is_primary: boolean;
  owner_name: string;
  is_company?: boolean;
  company_name?: string | null;
  contact_info?: {
    email: string | null;
    phone: string | null;
    address?: string | null;
  } | null;
  contact_data?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
}

// Property display interface for frontend with Guidelines.md enhancements
export interface PropertyDisplay {
  id: string;
  name: string;
  address: string; // Constructed full address for backward compatibility
  type: string;
  units_count: number;
  createdAt: string;
  source: 'database' | 'kv_store' | 'error';
  queryUsed: string;
  // Property manager information following Guidelines.md
  property_manager_id?: string | null;
  property_manager_name?: string | null;
  property_manager_data?: PropertyManagerData | null;
  // Individual address components
  addressComponents: PropertyAddressComponents;
  // Buildium compatibility with enhanced ownership data
  rental_owner_ids: string[];
  units: Array<{
    id: string;
    name: string;
    bedrooms: number | null;
    bathrooms: number | null;
    square_feet: number | null;
    rent: number | null;
    status: string;
  }>;
  ownerships: PropertyOwnershipDetails[];
  totalOwners: number;
  primaryOwner: string | null;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
}

// Unit management interfaces
export interface UnitDisplay {
  id: string;
  property_id: string;
  name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  rent: number | null;
  status: string;
  createdAt: string;
  source: 'database';
}

// Lease management interfaces
export interface LeaseDisplay {
  id: string;
  unit_id: string;
  property_id: string | null;
  unit_number: string | null;
  start_date: string;
  end_date: string;
  rent: string;
  security_deposit: string;
  status: 'active' | 'expired' | 'terminated' | 'pending';
  lease_type: LeaseTypeEnum | null;
  term_type: TermTypeEnum | null;
  renewal_offer_status: RenewalOfferStatusEnum;
  payment_due_day: number | null;
  is_eviction_pending: boolean;
  automatically_move_out_tenants: boolean;
  current_number_of_occupants: number | null;
  createdAt: string;
  source: 'database';
  // Extended fields for display
  tenants: Array<{
    tenant_id: string;
    role: TenantRole;
    name?: string;
  }>;
  unit_name?: string;
  property_name?: string;
}

// API Response types
export interface RentalOwnersSearchResponse {
  owners: RentalOwnerDisplay[];
  count: number;
  source: 'database' | 'kv_store' | 'error';
  queryUsed: string;
  contactsAvailable: boolean;
  searchTerm?: string | null;
  message?: string;
  note?: string;
  error?: string;
  details?: string;
  timestamp?: string;
}

export interface PropertiesSearchResponse {
  properties: PropertyDisplay[];
  count: number;
  source: 'database' | 'kv_store' | 'error';
  queryUsed: string;
  relationshipsIncluded: boolean;
  searchTerm?: string | null;
  message?: string;
  note?: string;
  error?: string;
  details?: string;
  timestamp?: string;
}

export interface UnitsSearchResponse {
  units: UnitDisplay[];
  count: number;
  propertyId: string;
  source: 'database' | 'error';
  queryUsed: string;
  error?: string;
  details?: string;
  timestamp?: string;
}

export interface LeasesSearchResponse {
  leases: LeaseDisplay[];
  count: number;
  source: 'database' | 'error';
  queryUsed: string;
  searchTerm?: string | null;
  message?: string;
  note?: string;
  error?: string;
  details?: string;
  timestamp?: string;
}

export interface RentalOwnerCreateResponse {
  owner: RentalOwnerDisplay;
  contactCreated: boolean;
  rentalOwnerCreated: boolean;
  strategy: string;
}

export interface RentalOwnerUpdateResponse {
  owner: RentalOwnerDisplay;
  contactUpdated: boolean;
  strategy: string;
}

export interface PropertyCreateResponse {
  property: PropertyDisplay;
  propertyCreated: boolean;
  strategy: string;
}

export interface PropertyUpdateResponse {
  property: PropertyDisplay;
  propertyUpdated: boolean;
  strategy: string;
}

export interface UnitCreateResponse {
  unit: UnitDisplay;
  unitCreated: boolean;
  strategy: string;
}

export interface UnitUpdateResponse {
  unit: UnitDisplay;
  unitUpdated: boolean;
  strategy: string;
}

export interface LeaseCreateResponse {
  lease: LeaseDisplay;
  leaseCreated: boolean;
  strategy: string;
}

export interface LeaseUpdateResponse {
  lease: LeaseDisplay;
  leaseUpdated: boolean;
  strategy: string;
}

// Form interfaces
export interface RentalOwnerCreateRequest {
  firstName: string;
  lastName: string;
  companyName?: string;
  isCompany?: boolean;
  email?: string;
  phone?: string;
  address?: string;
}

export interface RentalOwnerUpdateRequest {
  firstName: string;
  lastName: string;
  companyName?: string;
  isCompany?: boolean;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PropertyCreateRequest {
  name: string;
  address?: string;
  type?: string;
  units_count?: number;
}

export interface PropertyUpdateRequest {
  name?: string;
  address?: string;
  type?: string;
  units_count?: number;
}

export interface UnitCreateRequest {
  property_id: string;
  name: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  rent?: number;
  status?: string;
}

export interface UnitUpdateRequest {
  name?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  rent?: number;
  status?: string;
}

export interface LeaseCreateRequest {
  unit_id: string;
  property_id?: string;
  unit_number?: string;
  start_date: string;
  end_date: string;
  rent: number | string;
  security_deposit?: number | string;
  status?: 'active' | 'expired' | 'terminated' | 'pending';
  lease_type?: LeaseTypeEnum;
  term_type?: TermTypeEnum;
  renewal_offer_status?: RenewalOfferStatusEnum;
  payment_due_day?: number;
  is_eviction_pending?: boolean;
  automatically_move_out_tenants?: boolean;
  account_details?: unknown;
  move_out_data?: unknown;
}

export interface LeaseUpdateRequestForm {
  unit_id?: string;
  property_id?: string;
  unit_number?: string;
  start_date?: string;
  end_date?: string;
  rent?: number | string;
  security_deposit?: number | string;
  status?: 'active' | 'expired' | 'terminated' | 'pending';
  lease_type?: LeaseTypeEnum;
  term_type?: TermTypeEnum;
  renewal_offer_status?: RenewalOfferStatusEnum;
  payment_due_day?: number;
  is_eviction_pending?: boolean;
  automatically_move_out_tenants?: boolean;
  account_details?: unknown;
  move_out_data?: unknown;
}

// Database utility types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined };

// Schema introspection types
export interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface SchemaAnalysis {
  tables: {
    [tableName: string]: {
      exists: boolean;
      columns: {
        [columnName: string]: {
          type: string;
          nullable: boolean;
          default: string | null;
        };
      };
      rowCount: number;
      sampleData: any[];
    };
  };
  relationships: {
    [tableName: string]: {
      foreignKeys: Array<{
        column: string;
        referencedTable: string;
        referencedColumn: string;
      }>;
    };
  };
  healthCheck: {
    overallHealth: 'healthy' | 'partial' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  };
}
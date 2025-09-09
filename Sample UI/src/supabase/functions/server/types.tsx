// Shared types for the property management system

export interface PropertyManager {
  id: string;
  staffId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title: string;
  status: string;
  fullName: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  type: string;
  rental_owner: string;
  property_manager_id?: string;
  manager_name?: string;
  operating_account: string;
  deposit_account: string;
  units: number;
  occupied: number;
  monthly_revenue: number;
  status: string;
  created_at: string;
}

export interface RentalOwner {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  is_company: boolean;
  primary_email: string;
  phone_numbers: string[];
  user_id: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  name: string;
  account_type: string;
  user_id: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  user_id: string;
  title: string;
  status: string;
  created_at: string;
  users?: {
    id: string;
    email: string;
    user_metadata: any;
  };
  contacts?: Array<{
    first_name: string;
    last_name: string;
    phone_number?: string;
  }>;
}
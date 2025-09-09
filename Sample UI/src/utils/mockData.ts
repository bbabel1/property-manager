export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  units_count: number;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  totalOwners: number;
  primaryOwner: string | null;
  operating_bank_account_id?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  bedrooms: number;
  bathrooms: number;
  market_rent: number;
  square_feet?: number;
  created_at: string;
  updated_at: string;
}

export interface Owner {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyOwner {
  property_id: string;
  owner_id: string;
  ownership_percentage: number;
  disbursement_percentage: number;
  is_primary: boolean;
}

export interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  rent: number;
  status: 'active' | 'expired' | 'terminated' | 'pending';
  security_deposit: number;
  created_at: string;
  updated_at: string;
}

export interface LeaseTenant {
  lease_id: string;
  tenant_id: string;
  role: 'primary' | 'occupant' | 'guarantor';
}

export interface WorkOrder {
  id: string;
  unit_id: string;
  vendor_id?: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  estimated_cost?: number;
  actual_cost?: number;
}

export interface Vendor {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email?: string;
  specialty: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  name: string;
  routing_last4: string;
  account_last4: string;
  gl_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface GLAccount {
  id: string;
  number: string;
  name: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  gl_account_id: string;
  lease_id?: string;
  unit_id?: string;
  property_id?: string;
  amount: number;
  type: 'debit' | 'credit';
  date: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// Mock Data
export const mockProperties: Property[] = [
  {
    id: '1',
    name: 'Sunset Apartments',
    address: '123 Main Street',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90210',
    type: 'Apartment',
    units_count: 24,
    totalUnits: 24,
    occupiedUnits: 22,
    availableUnits: 2,
    totalOwners: 2,
    primaryOwner: 'John Smith',
    operating_bank_account_id: '1',
    status: 'active',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-08-10T14:30:00Z'
  },
  {
    id: '2',
    name: 'Oak Grove Townhomes',
    address: '456 Oak Avenue',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    type: 'Townhouse',
    units_count: 12,
    totalUnits: 12,
    occupiedUnits: 11,
    availableUnits: 1,
    totalOwners: 1,
    primaryOwner: 'Sarah Johnson',
    operating_bank_account_id: '2',
    status: 'active',
    created_at: '2024-02-20T10:15:00Z',
    updated_at: '2024-08-10T16:45:00Z'
  },
  {
    id: '3',
    name: 'Pine Valley Condos',
    address: '789 Pine Street',
    city: 'San Diego',
    state: 'CA',
    zip: '92101',
    type: 'Condo',
    units_count: 36,
    totalUnits: 36,
    occupiedUnits: 34,
    availableUnits: 2,
    totalOwners: 3,
    primaryOwner: 'Michael Brown',
    operating_bank_account_id: '3',
    status: 'inactive',
    created_at: '2024-03-10T11:30:00Z',
    updated_at: '2024-08-10T12:20:00Z'
  },
  {
    id: '4',
    name: 'Riverside Manor',
    address: '321 River Road',
    city: 'Sacramento',
    state: 'CA',
    zip: '95814',
    type: 'Single Family',
    units_count: 8,
    totalUnits: 8,
    occupiedUnits: 7,
    availableUnits: 1,
    totalOwners: 1,
    primaryOwner: 'Lisa Wilson',
    operating_bank_account_id: '4',
    status: 'inactive',
    created_at: '2024-04-05T08:45:00Z',
    updated_at: '2024-08-10T17:10:00Z'
  }
];

export const mockUnits: Unit[] = [
  // Sunset Apartments units
  { id: '1', property_id: '1', unit_number: '101', bedrooms: 1, bathrooms: 1, market_rent: 2200, square_feet: 650, created_at: '2024-01-15T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '2', property_id: '1', unit_number: '102', bedrooms: 1, bathrooms: 1, market_rent: 2200, square_feet: 650, created_at: '2024-01-15T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '3', property_id: '1', unit_number: '201', bedrooms: 2, bathrooms: 2, market_rent: 2800, square_feet: 900, created_at: '2024-01-15T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '4', property_id: '1', unit_number: '202', bedrooms: 2, bathrooms: 2, market_rent: 2800, square_feet: 900, created_at: '2024-01-15T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  
  // Oak Grove Townhomes units
  { id: '5', property_id: '2', unit_number: 'A1', bedrooms: 3, bathrooms: 2.5, market_rent: 4200, square_feet: 1200, created_at: '2024-02-20T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  { id: '6', property_id: '2', unit_number: 'A2', bedrooms: 3, bathrooms: 2.5, market_rent: 4200, square_feet: 1200, created_at: '2024-02-20T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  { id: '7', property_id: '2', unit_number: 'B1', bedrooms: 2, bathrooms: 2, market_rent: 3800, square_feet: 1000, created_at: '2024-02-20T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  
  // Pine Valley Condos units
  { id: '8', property_id: '3', unit_number: '301', bedrooms: 2, bathrooms: 2, market_rent: 3200, square_feet: 1100, created_at: '2024-03-10T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  { id: '9', property_id: '3', unit_number: '302', bedrooms: 2, bathrooms: 2, market_rent: 3200, square_feet: 1100, created_at: '2024-03-10T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  { id: '10', property_id: '3', unit_number: '401', bedrooms: 3, bathrooms: 2, market_rent: 3800, square_feet: 1300, created_at: '2024-03-10T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  
  // Riverside Manor units
  { id: '11', property_id: '4', unit_number: '1', bedrooms: 4, bathrooms: 3, market_rent: 5200, square_feet: 1800, created_at: '2024-04-05T08:45:00Z', updated_at: '2024-08-10T17:10:00Z' },
  { id: '12', property_id: '4', unit_number: '2', bedrooms: 3, bathrooms: 2, market_rent: 4500, square_feet: 1500, created_at: '2024-04-05T08:45:00Z', updated_at: '2024-08-10T17:10:00Z' }
];

export const mockOwners: Owner[] = [
  { id: '1', first_name: 'John', last_name: 'Smith', email: 'john.smith@email.com', phone: '(555) 123-4567', created_at: '2024-01-10T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '2', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.johnson@email.com', phone: '(555) 234-5678', created_at: '2024-02-15T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  { id: '3', first_name: 'Michael', last_name: 'Brown', email: 'michael.brown@email.com', phone: '(555) 345-6789', created_at: '2024-03-05T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  { id: '4', first_name: 'Lisa', last_name: 'Wilson', email: 'lisa.wilson@email.com', phone: '(555) 456-7890', created_at: '2024-04-01T08:45:00Z', updated_at: '2024-08-10T17:10:00Z' },
  { id: '5', first_name: 'David', last_name: 'Garcia', email: 'david.garcia@email.com', phone: '(555) 567-8901', created_at: '2024-01-20T13:15:00Z', updated_at: '2024-08-10T15:25:00Z' }
];

export const mockPropertyOwners: PropertyOwner[] = [
  { property_id: '1', owner_id: '1', ownership_percentage: 60, disbursement_percentage: 60, is_primary: true },
  { property_id: '1', owner_id: '5', ownership_percentage: 40, disbursement_percentage: 40, is_primary: false },
  { property_id: '2', owner_id: '2', ownership_percentage: 100, disbursement_percentage: 100, is_primary: true },
  { property_id: '3', owner_id: '3', ownership_percentage: 50, disbursement_percentage: 50, is_primary: true },
  { property_id: '3', owner_id: '1', ownership_percentage: 30, disbursement_percentage: 30, is_primary: false },
  { property_id: '3', owner_id: '2', ownership_percentage: 20, disbursement_percentage: 20, is_primary: false },
  { property_id: '4', owner_id: '4', ownership_percentage: 100, disbursement_percentage: 100, is_primary: true }
];

export const mockTenants: Tenant[] = [
  { id: '1', first_name: 'Emily', last_name: 'Davis', email: 'emily.davis@email.com', phone: '(555) 111-2222', created_at: '2024-05-01T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '2', first_name: 'James', last_name: 'Miller', email: 'james.miller@email.com', phone: '(555) 222-3333', created_at: '2024-05-15T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  { id: '3', first_name: 'Ashley', last_name: 'Taylor', email: 'ashley.taylor@email.com', phone: '(555) 333-4444', created_at: '2024-06-01T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  { id: '4', first_name: 'Robert', last_name: 'Anderson', email: 'robert.anderson@email.com', phone: '(555) 444-5555', created_at: '2024-06-15T08:45:00Z', updated_at: '2024-08-10T17:10:00Z' },
  { id: '5', first_name: 'Jessica', last_name: 'Martinez', email: 'jessica.martinez@email.com', phone: '(555) 555-6666', created_at: '2024-07-01T13:15:00Z', updated_at: '2024-08-10T15:25:00Z' }
];

export const mockLeases: Lease[] = [
  { id: '1', unit_id: '1', start_date: '2024-01-01', end_date: '2024-12-31', rent: 2200, status: 'active', security_deposit: 2200, created_at: '2023-12-15T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '2', unit_id: '2', start_date: '2024-02-01', end_date: '2025-01-31', rent: 2200, status: 'active', security_deposit: 2200, created_at: '2024-01-15T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  { id: '3', unit_id: '5', start_date: '2024-03-01', end_date: '2025-02-28', rent: 4200, status: 'active', security_deposit: 4200, created_at: '2024-02-15T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  { id: '4', unit_id: '8', start_date: '2024-04-01', end_date: '2025-03-31', rent: 3200, status: 'active', security_deposit: 3200, created_at: '2024-03-15T08:45:00Z', updated_at: '2024-08-10T17:10:00Z' },
  { id: '5', unit_id: '11', start_date: '2024-05-01', end_date: '2025-04-30', rent: 5200, status: 'active', security_deposit: 5200, created_at: '2024-04-15T13:15:00Z', updated_at: '2024-08-10T15:25:00Z' }
];

export const mockLeaseTenants: LeaseTenant[] = [
  { lease_id: '1', tenant_id: '1', role: 'primary' },
  { lease_id: '2', tenant_id: '2', role: 'primary' },
  { lease_id: '3', tenant_id: '3', role: 'primary' },
  { lease_id: '4', tenant_id: '4', role: 'primary' },
  { lease_id: '5', tenant_id: '5', role: 'primary' }
];

export const mockVendors: Vendor[] = [
  { id: '1', company_name: 'ABC Plumbing', contact_name: 'Tom Wilson', phone: '(555) 777-8888', email: 'tom@abcplumbing.com', specialty: 'Plumbing', created_at: '2024-01-05T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '2', company_name: 'Elite Electric', contact_name: 'Maria Lopez', phone: '(555) 888-9999', email: 'maria@eliteelectric.com', specialty: 'Electrical', created_at: '2024-01-10T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  { id: '3', company_name: 'Pro HVAC Services', contact_name: 'Steve Chen', phone: '(555) 999-0000', email: 'steve@prohvac.com', specialty: 'HVAC', created_at: '2024-01-15T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  { id: '4', company_name: 'Quick Fix Maintenance', contact_name: 'Anna Rodriguez', phone: '(555) 000-1111', email: 'anna@quickfix.com', specialty: 'General Maintenance', created_at: '2024-01-20T08:45:00Z', updated_at: '2024-08-10T17:10:00Z' }
];

export const mockWorkOrders: WorkOrder[] = [
  { id: '1', unit_id: '1', vendor_id: '1', description: 'Kitchen sink leak repair', priority: 'high', status: 'in_progress', estimated_cost: 150, actual_cost: 125, created_at: '2024-08-05T09:00:00Z', updated_at: '2024-08-08T14:30:00Z' },
  { id: '2', unit_id: '2', vendor_id: '2', description: 'Replace broken light fixture in living room', priority: 'medium', status: 'completed', estimated_cost: 200, actual_cost: 185, created_at: '2024-08-01T10:15:00Z', updated_at: '2024-08-03T16:45:00Z' },
  { id: '3', unit_id: '5', vendor_id: '3', description: 'AC unit not cooling properly', priority: 'urgent', status: 'open', estimated_cost: 350, created_at: '2024-08-09T11:30:00Z', updated_at: '2024-08-09T11:30:00Z' },
  { id: '4', unit_id: '8', vendor_id: '4', description: 'Bathroom door handle loose', priority: 'low', status: 'open', estimated_cost: 50, created_at: '2024-08-07T08:45:00Z', updated_at: '2024-08-07T08:45:00Z' },
  { id: '5', unit_id: '11', description: 'Paint touch-up in master bedroom', priority: 'low', status: 'open', estimated_cost: 100, created_at: '2024-08-06T13:15:00Z', updated_at: '2024-08-06T13:15:00Z' }
];

export const mockBankAccounts: BankAccount[] = [
  { id: '1', name: 'Sunset Apartments Operating', routing_last4: '1234', account_last4: '5678', gl_account_id: '1', created_at: '2024-01-15T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '2', name: 'Oak Grove Operating Account', routing_last4: '2345', account_last4: '6789', gl_account_id: '1', created_at: '2024-02-20T10:15:00Z', updated_at: '2024-08-10T16:45:00Z' },
  { id: '3', name: 'Pine Valley Main Account', routing_last4: '3456', account_last4: '7890', gl_account_id: '1', created_at: '2024-03-10T11:30:00Z', updated_at: '2024-08-10T12:20:00Z' },
  { id: '4', name: 'Riverside Manor Account', routing_last4: '4567', account_last4: '8901', gl_account_id: '1', created_at: '2024-04-05T08:45:00Z', updated_at: '2024-08-10T17:10:00Z' }
];

export const mockGLAccounts: GLAccount[] = [
  { id: '1', number: '1010', name: 'Cash - Operating', category: 'Assets', created_at: '2024-01-01T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '2', number: '1020', name: 'Cash - Security Deposits', category: 'Assets', created_at: '2024-01-01T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '3', number: '4010', name: 'Rental Income', category: 'Revenue', created_at: '2024-01-01T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '4', number: '5010', name: 'Maintenance Expenses', category: 'Expenses', created_at: '2024-01-01T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' },
  { id: '5', number: '5020', name: 'Utilities', category: 'Expenses', created_at: '2024-01-01T09:00:00Z', updated_at: '2024-08-10T14:30:00Z' }
];

export const mockTransactions: Transaction[] = [
  { id: '1', gl_account_id: '3', lease_id: '1', unit_id: '1', property_id: '1', amount: 2200, type: 'credit', date: '2024-08-01', description: 'Rent Payment - Unit 101', created_at: '2024-08-01T09:00:00Z', updated_at: '2024-08-01T09:00:00Z' },
  { id: '2', gl_account_id: '3', lease_id: '2', unit_id: '2', property_id: '1', amount: 2200, type: 'credit', date: '2024-08-01', description: 'Rent Payment - Unit 102', created_at: '2024-08-01T09:00:00Z', updated_at: '2024-08-01T09:00:00Z' },
  { id: '3', gl_account_id: '4', unit_id: '1', property_id: '1', amount: 125, type: 'debit', date: '2024-08-03', description: 'Plumbing Repair - Kitchen Sink', created_at: '2024-08-03T14:30:00Z', updated_at: '2024-08-03T14:30:00Z' },
  { id: '4', gl_account_id: '3', lease_id: '3', unit_id: '5', property_id: '2', amount: 4200, type: 'credit', date: '2024-08-01', description: 'Rent Payment - Unit A1', created_at: '2024-08-01T09:00:00Z', updated_at: '2024-08-01T09:00:00Z' },
  { id: '5', gl_account_id: '5', property_id: '2', amount: 180, type: 'debit', date: '2024-08-05', description: 'Electric Bill - Oak Grove Townhomes', created_at: '2024-08-05T11:20:00Z', updated_at: '2024-08-05T11:20:00Z' }
];

// Helper functions
export const getPropertyById = (id: string): Property | undefined => {
  return mockProperties.find(property => property.id === id);
};

export const getUnitsByPropertyId = (propertyId: string): Unit[] => {
  return mockUnits.filter(unit => unit.property_id === propertyId);
};

export const getOwnersByPropertyId = (propertyId: string): Owner[] => {
  const propertyOwnerRelations = mockPropertyOwners.filter(po => po.property_id === propertyId);
  return propertyOwnerRelations.map(po => {
    const owner = mockOwners.find(o => o.id === po.owner_id);
    return owner!;
  }).filter(Boolean);
};

export const getLeasesByPropertyId = (propertyId: string): Lease[] => {
  const propertyUnits = getUnitsByPropertyId(propertyId);
  const unitIds = propertyUnits.map(unit => unit.id);
  return mockLeases.filter(lease => unitIds.includes(lease.unit_id));
};

export const getTenantsByLeaseId = (leaseId: string): Tenant[] => {
  const leaseTenantRelations = mockLeaseTenants.filter(lt => lt.lease_id === leaseId);
  return leaseTenantRelations.map(lt => {
    const tenant = mockTenants.find(t => t.id === lt.tenant_id);
    return tenant!;
  }).filter(Boolean);
};

export const getWorkOrdersByPropertyId = (propertyId: string): WorkOrder[] => {
  const propertyUnits = getUnitsByPropertyId(propertyId);
  const unitIds = propertyUnits.map(unit => unit.id);
  return mockWorkOrders.filter(wo => unitIds.includes(wo.unit_id));
};

export const getVendorById = (id: string): Vendor | undefined => {
  return mockVendors.find(vendor => vendor.id === id);
};

export const getBankAccountById = (id: string): BankAccount | undefined => {
  return mockBankAccounts.find(account => account.id === id);
};

export const getTransactionsByPropertyId = (propertyId: string): Transaction[] => {
  return mockTransactions.filter(transaction => transaction.property_id === propertyId);
};

export const getUnitById = (id: string): Unit | undefined => {
  return mockUnits.find(unit => unit.id === id);
};

export const getLeasesByUnitId = (unitId: string): Lease[] => {
  return mockLeases.filter(lease => lease.unit_id === unitId);
};

export const getTenantById = (id: string): Tenant | undefined => {
  return mockTenants.find(tenant => tenant.id === id);
};

export const getWorkOrdersByUnitId = (unitId: string): WorkOrder[] => {
  return mockWorkOrders.filter(wo => wo.unit_id === unitId);
};

export const getDashboardStats = () => {
  const totalProperties = mockProperties.length;
  const totalUnits = mockProperties.reduce((sum, property) => sum + property.totalUnits, 0);
  const occupiedUnits = mockProperties.reduce((sum, property) => sum + property.occupiedUnits, 0);
  const availableUnits = mockProperties.reduce((sum, property) => sum + property.availableUnits, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  
  const totalRentRoll = mockLeases
    .filter(lease => lease.status === 'active')
    .reduce((sum, lease) => sum + lease.rent, 0);
  
  const openWorkOrders = mockWorkOrders.filter(wo => wo.status === 'open' || wo.status === 'in_progress').length;
  
  return {
    totalProperties,
    totalUnits,
    occupiedUnits,
    availableUnits,
    occupancyRate,
    totalRentRoll,
    openWorkOrders
  };
};
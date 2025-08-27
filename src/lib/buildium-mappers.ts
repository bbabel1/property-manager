// Buildium Data Mappers
// This file contains functions to map between local database format and Buildium API format

import type {
  BuildiumProperty,
  BuildiumPropertyCreate,
  BuildiumUnit,
  BuildiumUnitCreate,
  BuildiumOwner,
  BuildiumOwnerCreate,
  BuildiumVendor,
  BuildiumVendorCreate,
  BuildiumTask,
  BuildiumTaskCreate,
  BuildiumBill,
  BuildiumBillCreate,
  BuildiumBankAccount,
  BuildiumBankAccountCreate,
  BuildiumLease,
  BuildiumLeaseCreate,
  BuildiumSyncStatus
} from '../types/buildium'

// ============================================================================
// BANK ACCOUNT & GL ACCOUNT RESOLUTION DOCUMENTATION
// ============================================================================
/*
IMPORTANT: Bank Account and GL Account Relationship Handling

When mapping properties from Buildium to local database, the operating_bank_account_id 
field requires special handling:

1. Buildium Property has: OperatingBankAccountId (e.g., 10407)
2. Local Property needs: operating_bank_account_id (UUID reference to bank_accounts table)

Process:
1. Use Buildium OperatingBankAccountId to search bank_accounts table by buildium_bank_id
2. If found: Use the local bank account ID
3. If not found: 
   - Fetch bank account from Buildium API: bankaccounts/{bankAccountId}
   - Create bank_account record in local database
   - Use the new local bank account ID

When mapping bank accounts from Buildium to local database, the GL account relationship
requires special handling:

1. Buildium Bank Account has: GLAccount.Id (e.g., 10407)
2. Local Bank Account needs: gl_account (UUID reference to gl_accounts table)

Process:
1. Use Buildium GLAccount.Id to search gl_accounts table by buildium_gl_account_id
2. If found: Use the local GL account ID
3. If not found:
   - Fetch GL account from Buildium API: glaccounts/{glAccountId}
   - Create gl_accounts record in local database
   - Use the new local GL account ID

When mapping GL accounts from Buildium to local database, the sub_accounts relationship
requires special handling:

1. Buildium GL Account has: SubAccounts array of GL account IDs (e.g., [10408, 10409])
2. Local GL Account needs: sub_accounts (UUID array referencing gl_accounts table)

Process:
1. For each Buildium GL account ID in SubAccounts array:
   - Search gl_accounts table by buildium_gl_account_id
   - If found: Collect the local GL account UUID
   - If not found: Fetch from Buildium API and create new record, then collect UUID
2. Store all collected UUIDs as sub_accounts array

Functions:
- resolveBankAccountId(): Handles bank account lookup/fetch/create process
- resolveGLAccountId(): Handles GL account lookup/fetch/create process
- resolveSubAccounts(): Handles sub_accounts array resolution
- mapPropertyFromBuildiumWithBankAccount(): Enhanced property mapping with bank account resolution
- mapBankAccountFromBuildiumWithGLAccount(): Enhanced bank account mapping with GL account resolution
- mapGLAccountFromBuildiumWithSubAccounts(): Enhanced GL account mapping with sub_accounts resolution
- mapPropertyFromBuildium(): Basic property mapping (does NOT handle bank accounts)
- mapBankAccountFromBuildium(): Basic bank account mapping (does NOT handle GL accounts)
- mapGLAccountFromBuildium(): Basic GL account mapping (does NOT handle sub_accounts)

Usage:
- For simple property mapping: use mapPropertyFromBuildium()
- For property mapping with bank account relationships: use mapPropertyFromBuildiumWithBankAccount()
- For simple bank account mapping: use mapBankAccountFromBuildium()
- For bank account mapping with GL account relationships: use mapBankAccountFromBuildiumWithGLAccount()
- For simple GL account mapping: use mapGLAccountFromBuildium()
- For GL account mapping with sub_accounts relationships: use mapGLAccountFromBuildiumWithSubAccounts()
*/

// ============================================================================
// SUB ACCOUNTS HELPERS
// ============================================================================

/**
 * Helper function to resolve sub_accounts array from Buildium SubAccounts
 * 
 * @param buildiumSubAccounts - Array of Buildium GL account IDs from SubAccounts field
 * @param supabase - Supabase client instance
 * @returns Promise<string[]> - Array of local GL account UUIDs
 * 
 * Process:
 * 1. For each Buildium GL account ID in the SubAccounts array:
 *    - Search gl_accounts table by buildium_gl_account_id
 *    - If found: Collect the local GL account UUID
 *    - If not found: Fetch from Buildium API, create new record, then collect UUID
 * 2. Return array of all collected UUIDs
 */
export async function resolveSubAccounts(
  buildiumSubAccounts: number[] | null | undefined,
  supabase: any
): Promise<string[]> {
  if (!buildiumSubAccounts || buildiumSubAccounts.length === 0) {
    return [];
  }

  const subAccountIds: string[] = [];

  try {
    for (const buildiumGLAccountId of buildiumSubAccounts) {
      console.log(`Resolving sub-account GL account ID: ${buildiumGLAccountId}`);
      
      // Use the existing resolveGLAccountId function to handle each sub-account
      const localGLAccountId = await resolveGLAccountId(buildiumGLAccountId, supabase);
      
      if (localGLAccountId) {
        subAccountIds.push(localGLAccountId);
        console.log(`Added sub-account: ${localGLAccountId}`);
      } else {
        console.warn(`Failed to resolve sub-account GL account ID: ${buildiumGLAccountId}`);
      }
    }

    console.log(`Resolved ${subAccountIds.length} sub-accounts:`, subAccountIds);
    return subAccountIds;

  } catch (error) {
    console.error('Error resolving sub-accounts:', error);
    return [];
  }
}

// ============================================================================
// GL ACCOUNT HELPERS
// ============================================================================

/**
 * Helper function to handle GL account relationships when mapping bank accounts
 * 
 * @param buildiumGLAccountId - The GLAccount.Id from Buildium bank account
 * @param supabase - Supabase client instance
 * @returns Promise<string | null> - The local GL account ID or null if not found/created
 * 
 * Process:
 * 1. Search for existing GL account record using buildium_gl_account_id
 * 2. If found, return the local GL account ID
 * 3. If not found, fetch from Buildium API using glaccounts/{glAccountId}
 * 4. Create GL account record in local database
 * 5. Return the new local GL account ID
 */
export async function resolveGLAccountId(
  buildiumGLAccountId: number | null | undefined,
  supabase: any
): Promise<string | null> {
  if (!buildiumGLAccountId) {
    return null;
  }

  try {
    // Step 1: Search for existing GL account record
    const { data: existingGLAccount, error: searchError } = await supabase
      .from('gl_accounts')
      .select('id')
      .eq('buildium_gl_account_id', buildiumGLAccountId)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error searching for GL account:', searchError);
      throw searchError;
    }

    if (existingGLAccount) {
      console.log(`Found existing GL account: ${existingGLAccount.id}`);
      return existingGLAccount.id;
    }

    // Step 2: GL account not found, fetch from Buildium API
    console.log(`GL account ${buildiumGLAccountId} not found, fetching from Buildium...`);
    
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/glaccounts/${buildiumGLAccountId}`;
    const response = await fetch(buildiumUrl, {
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch GL account ${buildiumGLAccountId} from Buildium:`, response.status);
      return null;
    }

    const buildiumGLAccount = await response.json();
    console.log('Fetched GL account from Buildium:', buildiumGLAccount);

    // Step 3: Map and create GL account record with sub_accounts resolution
    const localGLAccount = await mapGLAccountFromBuildiumWithSubAccounts(buildiumGLAccount, supabase);
    
    // Add required timestamps
    const now = new Date().toISOString();
    const finalGLAccountData = {
      ...localGLAccount,
      created_at: now,
      updated_at: now
    };

    const { data: newGLAccount, error: createError } = await supabase
      .from('gl_accounts')
      .insert(finalGLAccountData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating GL account:', createError);
      return null;
    }

    console.log(`Created new GL account: ${newGLAccount.id}`);
    return newGLAccount.id;

  } catch (error) {
    console.error('Error resolving GL account ID:', error);
    return null;
  }
}

// ============================================================================
// BANK ACCOUNT HELPERS
// ============================================================================

/**
 * Helper function to handle bank account relationships when mapping properties
 * 
 * @param buildiumOperatingBankAccountId - The OperatingBankAccountId from Buildium property
 * @param supabase - Supabase client instance
 * @returns Promise<string | null> - The local bank account ID or null if not found/created
 * 
 * Process:
 * 1. Search for existing bank account record using buildium_bank_id
 * 2. If found, return the local bank account ID
 * 3. If not found, fetch from Buildium API using bankaccounts/{bankAccountId}
 * 4. Create bank account record in local database
 * 5. Return the new local bank account ID
 */
export async function resolveBankAccountId(
  buildiumOperatingBankAccountId: number | null | undefined,
  supabase: any
): Promise<string | null> {
  if (!buildiumOperatingBankAccountId) {
    return null;
  }

  try {
    // Step 1: Search for existing bank account record
    const { data: existingBankAccount, error: searchError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('buildium_bank_id', buildiumOperatingBankAccountId)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error searching for bank account:', searchError);
      throw searchError;
    }

    if (existingBankAccount) {
      console.log(`Found existing bank account: ${existingBankAccount.id}`);
      return existingBankAccount.id;
    }

    // Step 2: Bank account not found, fetch from Buildium API
    console.log(`Bank account ${buildiumOperatingBankAccountId} not found, fetching from Buildium...`);
    
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bankaccounts/${buildiumOperatingBankAccountId}`;
    const response = await fetch(buildiumUrl, {
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch bank account ${buildiumOperatingBankAccountId} from Buildium:`, response.status);
      return null;
    }

    const buildiumBankAccount = await response.json();
    console.log('Fetched bank account from Buildium:', buildiumBankAccount);

    // Step 3: Map and create bank account record with GL account resolution
    const localBankAccount = await mapBankAccountFromBuildiumWithGLAccount(buildiumBankAccount, supabase);
    
    // Add required timestamps
    const now = new Date().toISOString();
    const finalBankAccountData = {
      ...localBankAccount,
      created_at: now,
      updated_at: now
    };

    const { data: newBankAccount, error: createError } = await supabase
      .from('bank_accounts')
      .insert(finalBankAccountData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating bank account:', createError);
      return null;
    }

    console.log(`Created new bank account: ${newBankAccount.id}`);
    return newBankAccount.id;

  } catch (error) {
    console.error('Error resolving bank account ID:', error);
    return null;
  }
}

// ============================================================================
// PROPERTY MAPPERS
// ============================================================================

export function mapPropertyToBuildium(localProperty: any): BuildiumPropertyCreate {
  return {
    Name: localProperty.name,
    StructureDescription: localProperty.structure_description || undefined,
    NumberUnits: localProperty.number_units || undefined,
    IsActive: localProperty.is_active !== false,
    OperatingBankAccountId: localProperty.operating_bank_account_id || undefined,
    Reserve: localProperty.reserve || undefined,
    Address: {
      AddressLine1: localProperty.address_line1,
      AddressLine2: localProperty.address_line2 || undefined,
      AddressLine3: localProperty.address_line3 || undefined,
      City: localProperty.city || '',
      State: localProperty.state || '',
      PostalCode: localProperty.postal_code,
      Country: localProperty.country
    },
    YearBuilt: localProperty.year_built || undefined,
    RentalType: localProperty.rental_type || 'Rental',
    RentalSubType: localProperty.rental_sub_type || 'SingleFamily',
    RentalManager: localProperty.rental_manager || undefined
  }
}

export function mapPropertyFromBuildium(buildiumProperty: BuildiumProperty): any {
  return {
    name: buildiumProperty.Name,
    rental_type: buildiumProperty.RentalType,
    rental_sub_type: buildiumProperty.RentalSubType,
    address_line1: buildiumProperty.Address.AddressLine1,
    address_line2: buildiumProperty.Address.AddressLine2,
    city: buildiumProperty.Address.City,
    state: buildiumProperty.Address.State,
    postal_code: buildiumProperty.Address.PostalCode,
    country: buildiumProperty.Address.Country,
    year_built: buildiumProperty.YearBuilt,
    is_active: buildiumProperty.IsActive,
    // Note: Description field doesn't exist in BuildiumProperty
    buildium_property_id: buildiumProperty.Id,
    buildium_created_at: buildiumProperty.CreatedDate,
    buildium_updated_at: buildiumProperty.ModifiedDate
    // Note: operating_bank_account_id will be resolved separately using resolveBankAccountId()
  }
}

/**
 * Enhanced property mapping that includes bank account resolution
 * Use this function when you need to handle bank account relationships
 */
export async function mapPropertyFromBuildiumWithBankAccount(
  buildiumProperty: BuildiumProperty,
  supabase: any
): Promise<any> {
  const baseProperty = mapPropertyFromBuildium(buildiumProperty);
  
  // Resolve bank account ID if OperatingBankAccountId exists
  const operatingBankAccountId = await resolveBankAccountId(
    buildiumProperty.OperatingBankAccountId,
    supabase
  );

  return {
    ...baseProperty,
    operating_bank_account_id: operatingBankAccountId
  };
}

// ============================================================================
// UNIT MAPPERS
// ============================================================================

export function mapUnitToBuildium(localUnit: any): BuildiumUnitCreate {
  return {
    PropertyId: localUnit.buildium_property_id || localUnit.property_id,
    UnitType: mapUnitTypeToBuildium(localUnit.unit_type || 'Apartment'),
    Number: localUnit.unit_number || localUnit.number || '',
    SquareFootage: localUnit.square_footage || undefined,
    Bedrooms: localUnit.bedrooms || undefined,
    Bathrooms: localUnit.bathrooms || undefined,
    IsActive: localUnit.is_active !== false
    // Note: Description, RentAmount, SecurityDepositAmount fields don't exist in BuildiumUnitCreate
  }
}

export function mapUnitFromBuildium(buildiumUnit: BuildiumUnit): any {
  return {
    unit_number: buildiumUnit.Number,
    unit_type: mapUnitTypeFromBuildium(buildiumUnit.UnitType),
    unit_size: buildiumUnit.UnitSize,
    bedrooms: buildiumUnit.Bedrooms,
    bathrooms: buildiumUnit.Bathrooms,
    is_active: buildiumUnit.IsActive,
    market_rent: buildiumUnit.MarketRent,
    description: buildiumUnit.Description,
    buildium_unit_id: buildiumUnit.Id,
    buildium_property_id: buildiumUnit.PropertyId,
    buildium_created_at: buildiumUnit.CreatedDate,
    buildium_updated_at: buildiumUnit.ModifiedDate
  }
}

function mapUnitTypeToBuildium(localType: string): 'Apartment' | 'Condo' | 'House' | 'Townhouse' | 'Office' | 'Retail' | 'Warehouse' | 'Other' {
  switch (localType?.toLowerCase()) {
    case 'apartment':
      return 'Apartment'
    case 'condo':
    case 'condominium':
      return 'Condo'
    case 'house':
      return 'House'
    case 'townhouse':
      return 'Townhouse'
    case 'office':
      return 'Office'
    case 'retail':
      return 'Retail'
    case 'warehouse':
      return 'Warehouse'
    default:
      return 'Other'
  }
}

function mapUnitTypeFromBuildium(buildiumType: 'Apartment' | 'Condo' | 'House' | 'Townhouse' | 'Office' | 'Retail' | 'Warehouse' | 'Other'): string {
  switch (buildiumType) {
    case 'Condo':
      return 'condo'
    case 'House':
      return 'house'
    case 'Townhouse':
      return 'townhouse'
    case 'Office':
      return 'office'
    case 'Retail':
      return 'retail'
    case 'Warehouse':
      return 'warehouse'
    case 'Other':
      return 'other'
    default:
      return 'apartment'
  }
}

// ============================================================================
// OWNER MAPPERS
// ============================================================================

export function mapOwnerToBuildium(localOwner: any): BuildiumOwnerCreate {
  return {
    FirstName: localOwner.first_name,
    LastName: localOwner.last_name,
    Email: localOwner.email,
    PhoneNumber: localOwner.phone_number || undefined,
    Address: {
      AddressLine1: localOwner.address_line1,
      AddressLine2: localOwner.address_line2 || undefined,
      City: localOwner.city || '',
      State: localOwner.state || '',
      PostalCode: localOwner.postal_code,
      Country: localOwner.country
    },
    TaxId: localOwner.tax_id || undefined,
    IsActive: localOwner.is_active !== false
  }
}

export function mapOwnerFromBuildium(buildiumOwner: BuildiumOwner): any {
  return {
    first_name: buildiumOwner.FirstName,
    last_name: buildiumOwner.LastName,
    email: buildiumOwner.Email,
    phone_number: buildiumOwner.PhoneNumber,
    address_line1: buildiumOwner.Address.AddressLine1,
    address_line2: buildiumOwner.Address.AddressLine2,
    city: buildiumOwner.Address.City,
    state: buildiumOwner.Address.State,
    postal_code: buildiumOwner.Address.PostalCode,
    country: buildiumOwner.Address.Country,
    tax_id: buildiumOwner.TaxId,
    is_active: buildiumOwner.IsActive,
    buildium_owner_id: buildiumOwner.Id,
    buildium_created_at: buildiumOwner.CreatedDate,
    buildium_updated_at: buildiumOwner.ModifiedDate
  }
}

// ============================================================================
// VENDOR MAPPERS
// ============================================================================

export function mapVendorToBuildium(localVendor: any): BuildiumVendorCreate {
  return {
    Name: localVendor.name,
    CategoryId: localVendor.category_id,
    ContactName: localVendor.contact_name || undefined,
    Email: localVendor.email || undefined,
    PhoneNumber: localVendor.phone_number || undefined,
    Address: {
      AddressLine1: localVendor.address_line1,
      AddressLine2: localVendor.address_line2 || undefined,
      City: localVendor.city || '',
      State: localVendor.state || '',
      PostalCode: localVendor.postal_code,
      Country: localVendor.country
    },
    TaxId: localVendor.tax_id || undefined,
    Notes: localVendor.notes || undefined,
    IsActive: localVendor.is_active !== false
  }
}

export function mapVendorFromBuildium(buildiumVendor: BuildiumVendor): any {
  return {
    name: buildiumVendor.Name,
    category_id: buildiumVendor.CategoryId,
    contact_name: buildiumVendor.ContactName,
    email: buildiumVendor.Email,
    phone_number: buildiumVendor.PhoneNumber,
    address_line1: buildiumVendor.Address.AddressLine1,
    address_line2: buildiumVendor.Address.AddressLine2,
    city: buildiumVendor.Address.City,
    state: buildiumVendor.Address.State,
    postal_code: buildiumVendor.Address.PostalCode,
    country: buildiumVendor.Address.Country,
    tax_id: buildiumVendor.TaxId,
    notes: buildiumVendor.Notes,
    is_active: buildiumVendor.IsActive,
    buildium_vendor_id: buildiumVendor.Id,
    buildium_created_at: buildiumVendor.CreatedDate,
    buildium_updated_at: buildiumVendor.ModifiedDate
  }
}

// ============================================================================
// TASK MAPPERS
// ============================================================================

export function mapTaskToBuildium(localTask: any): BuildiumTaskCreate {
  return {
    PropertyId: localTask.buildium_property_id || localTask.property_id,
    UnitId: localTask.buildium_unit_id || localTask.unit_id || undefined,
    Subject: localTask.title,
    Description: localTask.description || undefined,
    Category: localTask.category_id,
    Priority: mapTaskPriorityToBuildium(localTask.priority || 'Medium'),
    Status: mapTaskStatusToBuildium(localTask.status || 'Open'),
    AssignedTo: localTask.assigned_to_id || undefined
  }
}

export function mapTaskFromBuildium(buildiumTask: BuildiumTask): any {
  return {
    property_id: buildiumTask.PropertyId,
    unit_id: buildiumTask.UnitId,
    title: buildiumTask.Subject,
    description: buildiumTask.Description,
    category_id: buildiumTask.Category,
    priority: mapTaskPriorityFromBuildium(buildiumTask.Priority),
    status: mapTaskStatusFromBuildium(buildiumTask.Status),
    assigned_to_id: buildiumTask.AssignedTo,
    buildium_task_id: buildiumTask.Id,
    buildium_created_at: buildiumTask.CreatedDate,
    buildium_updated_at: buildiumTask.ModifiedDate
  }
}

function mapTaskPriorityToBuildium(localPriority: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  switch (localPriority?.toLowerCase()) {
    case 'low':
      return 'Low'
    case 'high':
      return 'High'
    case 'critical':
      return 'Critical'
    default:
      return 'Medium'
  }
}

function mapTaskPriorityFromBuildium(buildiumPriority: 'Low' | 'Medium' | 'High' | 'Critical'): string {
  switch (buildiumPriority) {
    case 'Low':
      return 'low'
    case 'High':
      return 'high'
    case 'Critical':
      return 'critical'
    default:
      return 'medium'
  }
}

function mapTaskStatusToBuildium(localStatus: string): 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold' {
  switch (localStatus?.toLowerCase()) {
    case 'in_progress':
    case 'inprogress':
      return 'InProgress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'on_hold':
    case 'onhold':
      return 'OnHold'
    default:
      return 'Open'
  }
}

function mapTaskStatusFromBuildium(buildiumStatus: 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold'): string {
  switch (buildiumStatus) {
    case 'InProgress':
      return 'in_progress'
    case 'Completed':
      return 'completed'
    case 'Cancelled':
      return 'cancelled'
    case 'OnHold':
      return 'on_hold'
    default:
      return 'open'
  }
}

// ============================================================================
// BILL MAPPERS
// ============================================================================

export function mapBillToBuildium(localBill: any): BuildiumBillCreate {
  return {
    PropertyId: localBill.buildium_property_id || localBill.property_id,
    UnitId: localBill.buildium_unit_id || localBill.unit_id || undefined,
    VendorId: localBill.buildium_vendor_id || localBill.vendor_id,
    Date: localBill.bill_date,
    Description: localBill.description || undefined,
    Amount: localBill.amount,
    DueDate: localBill.due_date,
    CategoryId: localBill.category_id || undefined
  }
}

export function mapBillFromBuildium(buildiumBill: BuildiumBill): any {
  return {
    property_id: buildiumBill.PropertyId,
    unit_id: buildiumBill.UnitId,
    vendor_id: buildiumBill.VendorId,
    bill_date: buildiumBill.Date,
    description: buildiumBill.Description,
    amount: buildiumBill.Amount,
    due_date: buildiumBill.DueDate,
    category_id: buildiumBill.CategoryId,
    status: mapBillStatusFromBuildium(buildiumBill.Status),
    buildium_bill_id: buildiumBill.Id,
    buildium_created_at: buildiumBill.CreatedDate,
    buildium_updated_at: buildiumBill.ModifiedDate
  }
}

function mapBillStatusToBuildium(localStatus: string): 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'PartiallyPaid' {
  switch (localStatus?.toLowerCase()) {
    case 'paid':
      return 'Paid'
    case 'overdue':
      return 'Overdue'
    case 'cancelled':
      return 'Cancelled'
    case 'partially_paid':
    case 'partiallypaid':
      return 'PartiallyPaid'
    default:
      return 'Pending'
  }
}

function mapBillStatusFromBuildium(buildiumStatus: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'PartiallyPaid'): string {
  switch (buildiumStatus) {
    case 'PartiallyPaid':
      return 'partially_paid'
    default:
      return buildiumStatus.toLowerCase()
  }
}

// ============================================================================
// GL ACCOUNT MAPPERS
// ============================================================================

export function mapGLAccountToBuildium(localGLAccount: any): any {
  return {
    Name: localGLAccount.name,
    Description: localGLAccount.description || undefined,
    Type: localGLAccount.type,
    SubType: localGLAccount.sub_type || undefined,
    IsDefaultGLAccount: localGLAccount.is_default_gl_account || false,
    DefaultAccountName: localGLAccount.default_account_name || undefined,
    IsContraAccount: localGLAccount.is_contra_account || false,
    IsBankAccount: localGLAccount.is_bank_account || false,
    CashFlowClassification: localGLAccount.cash_flow_classification || undefined,
    ExcludeFromCashBalances: localGLAccount.exclude_from_cash_balances || false,
    IsActive: localGLAccount.is_active !== false,
    ParentGLAccountId: localGLAccount.buildium_parent_gl_account_id || undefined,
    IsCreditCardAccount: localGLAccount.is_credit_card_account || false
  }
}

/**
 * Basic GL account mapping (does NOT handle sub_accounts relationships)
 * Use this for simple GL account mapping without sub_accounts resolution
 */
export function mapGLAccountFromBuildium(buildiumGLAccount: any): any {
  return {
    buildium_gl_account_id: buildiumGLAccount.Id,
    account_number: buildiumGLAccount.AccountNumber,
    name: buildiumGLAccount.Name,
    description: buildiumGLAccount.Description,
    type: buildiumGLAccount.Type,
    sub_type: buildiumGLAccount.SubType,
    is_default_gl_account: buildiumGLAccount.IsDefaultGLAccount,
    default_account_name: buildiumGLAccount.DefaultAccountName,
    is_contra_account: buildiumGLAccount.IsContraAccount,
    is_bank_account: buildiumGLAccount.IsBankAccount,
    cash_flow_classification: buildiumGLAccount.CashFlowClassification,
    exclude_from_cash_balances: buildiumGLAccount.ExcludeFromCashBalances,
    is_active: buildiumGLAccount.IsActive,
    buildium_parent_gl_account_id: buildiumGLAccount.ParentGLAccountId,
    is_credit_card_account: buildiumGLAccount.IsCreditCardAccount
    // Note: sub_accounts will be resolved separately using resolveSubAccounts()
  }
}

/**
 * Enhanced GL account mapping that includes sub_accounts resolution
 * Use this function when you need to handle sub_accounts relationships
 */
export async function mapGLAccountFromBuildiumWithSubAccounts(
  buildiumGLAccount: any,
  supabase: any
): Promise<any> {
  const baseGLAccount = mapGLAccountFromBuildium(buildiumGLAccount);
  
  // Resolve sub_accounts array if SubAccounts exists
  const subAccounts = await resolveSubAccounts(
    buildiumGLAccount.SubAccounts,
    supabase
  );

  return {
    ...baseGLAccount,
    sub_accounts: subAccounts
  };
}

// ============================================================================
// BANK ACCOUNT MAPPERS
// ============================================================================

export function mapBankAccountToBuildium(localBankAccount: any): BuildiumBankAccountCreate {
  return {
    Name: localBankAccount.name,
    BankAccountType: mapBankAccountTypeToBuildium(localBankAccount.bank_account_type || 'Checking'),
    AccountNumber: localBankAccount.account_number,
    RoutingNumber: localBankAccount.routing_number,
    Description: localBankAccount.description || undefined,
    IsActive: localBankAccount.is_active !== false
  }
}

/**
 * Basic bank account mapping (does NOT handle GL account relationships)
 * Use this for simple bank account mapping without GL account resolution
 */
export function mapBankAccountFromBuildium(buildiumBankAccount: any): any {
  return {
    buildium_bank_id: buildiumBankAccount.Id,
    name: buildiumBankAccount.Name,
    description: buildiumBankAccount.Description,
    bank_account_type: mapBankAccountTypeFromBuildium(buildiumBankAccount.BankAccountType),
    country: buildiumBankAccount.Country || 'UnitedStates', // Default to UnitedStates if null
    account_number: buildiumBankAccount.AccountNumberUnmasked, // Use unmasked account number
    routing_number: buildiumBankAccount.RoutingNumber,
    is_active: buildiumBankAccount.IsActive,
    buildium_balance: buildiumBankAccount.Balance,
    // Note: gl_account will be resolved separately using resolveGLAccountId()
    // Check printing info if available
    enable_remote_check_printing: buildiumBankAccount.CheckPrintingInfo?.EnableRemoteCheckPrinting || false,
    enable_local_check_printing: buildiumBankAccount.CheckPrintingInfo?.EnableLocalCheckPrinting || false,
    check_layout_type: buildiumBankAccount.CheckPrintingInfo?.CheckLayoutType || null,
    signature_heading: buildiumBankAccount.CheckPrintingInfo?.SignatureHeading || null,
    fractional_number: buildiumBankAccount.CheckPrintingInfo?.FractionalNumber || null,
    bank_information_line1: buildiumBankAccount.CheckPrintingInfo?.BankInformationLine1 || null,
    bank_information_line2: buildiumBankAccount.CheckPrintingInfo?.BankInformationLine2 || null,
    bank_information_line3: buildiumBankAccount.CheckPrintingInfo?.BankInformationLine3 || null,
    bank_information_line4: buildiumBankAccount.CheckPrintingInfo?.BankInformationLine4 || null,
    bank_information_line5: buildiumBankAccount.CheckPrintingInfo?.BankInformationLine5 || null,
    company_information_line1: buildiumBankAccount.CheckPrintingInfo?.CompanyInformationLine1 || null,
    company_information_line2: buildiumBankAccount.CheckPrintingInfo?.CompanyInformationLine2 || null,
    company_information_line3: buildiumBankAccount.CheckPrintingInfo?.CompanyInformationLine3 || null,
    company_information_line4: buildiumBankAccount.CheckPrintingInfo?.CompanyInformationLine4 || null,
    company_information_line5: buildiumBankAccount.CheckPrintingInfo?.CompanyInformationLine5 || null
  }
}

/**
 * Enhanced bank account mapping that includes GL account resolution
 * Use this function when you need to handle GL account relationships
 */
export async function mapBankAccountFromBuildiumWithGLAccount(
  buildiumBankAccount: any,
  supabase: any
): Promise<any> {
  const baseBankAccount = mapBankAccountFromBuildium(buildiumBankAccount);
  
  // Resolve GL account ID if GLAccount.Id exists
  const glAccountId = await resolveGLAccountId(
    buildiumBankAccount.GLAccount?.Id,
    supabase
  );

  return {
    ...baseBankAccount,
    gl_account: glAccountId
  };
}

function mapBankAccountTypeToBuildium(localType: string): 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit' {
  switch (localType?.toLowerCase()) {
    case 'savings':
      return 'Savings'
    case 'money_market':
    case 'moneymarket':
      return 'MoneyMarket'
    case 'certificate_of_deposit':
    case 'certificateofdeposit':
      return 'CertificateOfDeposit'
    default:
      return 'Checking'
  }
}

function mapBankAccountTypeFromBuildium(buildiumType: 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit'): string {
  switch (buildiumType) {
    case 'MoneyMarket':
      return 'money_market'
    case 'CertificateOfDeposit':
      return 'certificate_of_deposit'
    default:
      return buildiumType.toLowerCase()
  }
}

// ============================================================================
// LEASE MAPPERS
// ============================================================================

export function mapLeaseToBuildium(localLease: any): BuildiumLeaseCreate {
  return {
    PropertyId: localLease.buildium_property_id || localLease.property_id,
    UnitId: localLease.buildium_unit_id || localLease.unit_id,
    Status: mapLeaseStatusToBuildium(localLease.status || 'Active'),
    StartDate: localLease.start_date,
    EndDate: localLease.end_date || undefined,
    RentAmount: localLease.rent_amount,
    SecurityDepositAmount: localLease.security_deposit_amount || undefined
  }
}

export function mapLeaseFromBuildium(buildiumLease: BuildiumLease): any {
  return {
    property_id: buildiumLease.PropertyId,
    unit_id: buildiumLease.UnitId,
    status: mapLeaseStatusFromBuildium(buildiumLease.Status),
    start_date: buildiumLease.StartDate,
    end_date: buildiumLease.EndDate,
    rent_amount: buildiumLease.RentAmount,
    security_deposit_amount: buildiumLease.SecurityDepositAmount,
    buildium_lease_id: buildiumLease.Id,
    buildium_created_at: buildiumLease.CreatedDate,
    buildium_updated_at: buildiumLease.ModifiedDate
  }
}

function mapLeaseStatusToBuildium(localStatus: string): 'Future' | 'Active' | 'Past' | 'Cancelled' {
  switch (localStatus?.toLowerCase()) {
    case 'future':
      return 'Future'
    case 'past':
      return 'Past'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Active'
  }
}

function mapLeaseStatusFromBuildium(buildiumStatus: 'Future' | 'Active' | 'Past' | 'Cancelled'): string {
  switch (buildiumStatus) {
    case 'Future':
      return 'future'
    case 'Past':
      return 'past'
    case 'Cancelled':
      return 'cancelled'
    default:
      return 'active'
  }
}

// ============================================================================
// SYNC STATUS MAPPERS
// ============================================================================

export function mapSyncStatusToBuildium(localSyncStatus: any): BuildiumSyncStatus {
  return {
    entityType: localSyncStatus.entity_type,
    entityId: localSyncStatus.entity_id,
    buildiumId: localSyncStatus.buildium_id || undefined,
    lastSyncedAt: localSyncStatus.last_synced_at || undefined,
    syncStatus: localSyncStatus.sync_status,
    errorMessage: localSyncStatus.error_message || undefined,
    createdAt: localSyncStatus.created_at,
    updatedAt: localSyncStatus.updated_at
  }
}

export function mapSyncStatusFromBuildium(buildiumSyncStatus: BuildiumSyncStatus): any {
  return {
    entity_type: buildiumSyncStatus.entityType,
    entity_id: buildiumSyncStatus.entityId,
    buildium_id: buildiumSyncStatus.buildiumId,
    last_synced_at: buildiumSyncStatus.lastSyncedAt,
    sync_status: buildiumSyncStatus.syncStatus,
    error_message: buildiumSyncStatus.errorMessage,
    created_at: buildiumSyncStatus.createdAt,
    updated_at: buildiumSyncStatus.updatedAt
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function sanitizeForBuildium(data: any): any {
  // Remove undefined values and null values that Buildium doesn't accept
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key]
    }
  })
  
  return sanitized
}

export function validateBuildiumResponse(response: any): boolean {
  // Basic validation for Buildium API responses
  return response && typeof response === 'object' && !response.error
}

export function extractBuildiumId(response: any): number | null {
  // Extract Buildium ID from various response formats
  if (response?.Id) return response.Id
  if (response?.id) return response.id
  if (response?.data?.Id) return response.data.Id
  return null
}

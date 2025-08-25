/**
 * Buildium API Reference
 * 
 * This file contains all the request/response schemas for Buildium API endpoints
 * based on the official documentation: https://developer.buildium.com/
 * 
 * Use this as a quick reference when implementing Buildium API calls.
 */

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

/**
 * POST /v1/bankaccounts - Create Bank Account
 * https://developer.buildium.com/#tag/Bank-Accounts/operation/ExternalApiBankAccounts_CreateBankAccount
 */
export const CREATE_BANK_ACCOUNT_SCHEMA = {
  request: {
    Name: "string (required) - Bank account name",
    BankAccountType: "enum (required) - One of: Checking, Savings, MoneyMarket, CertificateOfDeposit",
    AccountNumber: "string (required) - Bank account number",
    RoutingNumber: "string (required) - Bank routing number (9 digits)",
    Description: "string (optional) - Account description",
    IsActive: "boolean (optional) - Whether account is active, defaults to true"
  },
  response: {
    Id: "number - Bank account ID",
    Name: "string - Bank account name",
    BankAccountType: "string - Account type",
    AccountNumber: "string - Masked account number",
    Balance: "number - Current balance",
    IsActive: "boolean - Account status"
  }
}

/**
 * PUT /v1/bankaccounts/{id} - Update Bank Account
 */
export const UPDATE_BANK_ACCOUNT_SCHEMA = {
  request: {
    Name: "string (optional) - Bank account name",
    BankAccountType: "enum (optional) - One of: Checking, Savings, MoneyMarket, CertificateOfDeposit",
    AccountNumber: "string (optional) - Bank account number",
    RoutingNumber: "string (optional) - Bank routing number (9 digits)",
    Description: "string (optional) - Account description",
    IsActive: "boolean (optional) - Whether account is active"
  }
}

// ============================================================================
// CHECKS
// ============================================================================

/**
 * POST /v1/bankaccounts/checks - Create Check
 */
export const CREATE_CHECK_SCHEMA = {
  request: {
    BankAccountId: "number (required) - Bank account ID",
    Amount: "number (required) - Check amount (positive)",
    PayeeName: "string (required) - Payee name",
    Memo: "string (optional) - Check memo",
    CheckNumber: "string (optional) - Check number",
    Date: "string (optional) - Check date (ISO 8601 format)"
  }
}

// ============================================================================
// DEPOSITS
// ============================================================================

/**
 * POST /v1/bankaccounts/deposits - Create Deposit
 */
export const CREATE_DEPOSIT_SCHEMA = {
  request: {
    BankAccountId: "number (required) - Bank account ID",
    Amount: "number (required) - Deposit amount (positive)",
    Description: "string (required) - Deposit description",
    Date: "string (optional) - Deposit date (ISO 8601 format)"
  }
}

// ============================================================================
// WITHDRAWALS
// ============================================================================

/**
 * POST /v1/bankaccounts/withdrawals - Create Withdrawal
 */
export const CREATE_WITHDRAWAL_SCHEMA = {
  request: {
    BankAccountId: "number (required) - Bank account ID",
    Amount: "number (required) - Withdrawal amount (positive)",
    Description: "string (required) - Withdrawal description",
    Date: "string (optional) - Withdrawal date (ISO 8601 format)"
  }
}

// ============================================================================
// PROPERTIES
// ============================================================================

/**
 * GET /v1/rentals - List Properties
 */
export const LIST_PROPERTIES_RESPONSE = {
  Id: "number - Property ID",
  Name: "string - Property name",
  NumberUnits: "number - Number of units",
  OperatingBankAccountId: "number - Operating bank account ID",
  Address: {
    AddressLine1: "string - Street address",
    City: "string - City",
    State: "string - State",
    PostalCode: "string - Postal code"
  },
  RentalType: "string - Rental type (Residential/Commercial)",
  RentalSubType: "string - Rental sub-type (SingleFamily, MultiFamily, etc.)"
}

/**
 * GET /v1/rentals/{id} - Get Property Details
 */
export const GET_PROPERTY_RESPONSE = {
  // Same as LIST_PROPERTIES_RESPONSE but with additional details
  Id: "number - Property ID",
  Name: "string - Property name",
  NumberUnits: "number - Number of units",
  OperatingBankAccountId: "number - Operating bank account ID",
  Address: {
    AddressLine1: "string - Street address",
    AddressLine2: "string - Additional address line",
    AddressLine3: "string - Additional address line",
    City: "string - City",
    State: "string - State",
    PostalCode: "string - Postal code",
    Country: "string - Country"
  },
  RentalType: "string - Rental type",
  RentalSubType: "string - Rental sub-type",
  YearBuilt: "number - Year built",
  Description: "string - Property description"
}

// ============================================================================
// OWNERS
// ============================================================================

/**
 * GET /v1/rentals/owners - List Owners
 */
export const LIST_OWNERS_RESPONSE = {
  Id: "number - Owner ID",
  FirstName: "string - First name",
  LastName: "string - Last name",
  Email: "string - Email address",
  PhoneNumbers: [
    {
      Number: "string - Phone number",
      Type: "string - Phone type (Cell, Home, Work, etc.)"
    }
  ],
  PropertyIds: "number[] - Array of property IDs owned"
}

/**
 * GET /v1/rentals/owners/{id} - Get Owner Details
 */
export const GET_OWNER_RESPONSE = {
  // Same as LIST_OWNERS_RESPONSE but with additional details
  Id: "number - Owner ID",
  FirstName: "string - First name",
  LastName: "string - Last name",
  Email: "string - Email address",
  PhoneNumbers: [
    {
      Number: "string - Phone number",
      Type: "string - Phone type"
    }
  ],
  PropertyIds: "number[] - Array of property IDs owned",
  Address: {
    AddressLine1: "string - Street address",
    AddressLine2: "string - Additional address line",
    City: "string - City",
    State: "string - State",
    PostalCode: "string - Postal code",
    Country: "string - Country"
  }
}

// ============================================================================
// UNITS
// ============================================================================

/**
 * GET /v1/rentals/units - List Units
 */
export const LIST_UNITS_RESPONSE = {
  Id: "number - Unit ID",
  UnitNumber: "string - Unit number",
  PropertyId: "number - Property ID",
  Bedrooms: "number - Number of bedrooms",
  Bathrooms: "number - Number of bathrooms",
  SquareFootage: "number - Square footage",
  Status: "string - Unit status (Available, Occupied, etc.)"
}

// ============================================================================
// LEASES
// ============================================================================

/**
 * GET /v1/rentals/leases - List Leases
 */
export const LIST_LEASES_RESPONSE = {
  Id: "number - Lease ID",
  UnitId: "number - Unit ID",
  PropertyId: "number - Property ID",
  TenantId: "number - Tenant ID",
  StartDate: "string - Lease start date (ISO 8601)",
  EndDate: "string - Lease end date (ISO 8601)",
  MonthlyRent: "number - Monthly rent amount",
  Status: "string - Lease status (Active, Expired, etc.)"
}

// ============================================================================
// COMMON ERROR RESPONSES
// ============================================================================

export const ERROR_RESPONSES = {
  400: "Bad Request - Malformed request syntax or invalid parameters",
  401: "Unauthorized - API key couldn't be authorized",
  403: "Forbidden - Supplied credentials don't have permissions",
  404: "Not Found - Resource not found",
  422: "Unprocessable Entity - Request data could not be used to fulfill the request",
  429: "Too Many Requests - Rate limit exceeded",
  500: "Internal Server Error - Server error"
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

export const USAGE_EXAMPLES = {
  createBankAccount: `
// Create a new bank account
const response = await fetch('/api/buildium/bank-accounts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    Name: "Operating Account",
    BankAccountType: "Checking",
    AccountNumber: "1234567890",
    RoutingNumber: "021000021",
    Description: "Main operating account"
  })
});
  `,
  
  createCheck: `
// Create a check
const response = await fetch('/api/buildium/bank-accounts/checks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    BankAccountId: 10407,
    Amount: 1500.00,
    PayeeName: "ABC Services",
    Memo: "Monthly maintenance"
  })
});
  `,
  
  getProperties: `
// Get all properties
const response = await fetch('/api/buildium/properties');
const { data: properties } = await response.json();
  `,
  
  getOwners: `
// Get all owners
const response = await fetch('/api/buildium/owners');
const { data: owners } = await response.json();
  `
}

// Export all schemas for easy access
export const BUILDIUM_API_REFERENCE = {
  BankAccounts: {
    Create: CREATE_BANK_ACCOUNT_SCHEMA,
    Update: UPDATE_BANK_ACCOUNT_SCHEMA
  },
  Checks: {
    Create: CREATE_CHECK_SCHEMA
  },
  Deposits: {
    Create: CREATE_DEPOSIT_SCHEMA
  },
  Withdrawals: {
    Create: CREATE_WITHDRAWAL_SCHEMA
  },
  Properties: {
    List: LIST_PROPERTIES_RESPONSE,
    Get: GET_PROPERTY_RESPONSE
  },
  Owners: {
    List: LIST_OWNERS_RESPONSE,
    Get: GET_OWNER_RESPONSE
  },
  Units: {
    List: LIST_UNITS_RESPONSE
  },
  Leases: {
    List: LIST_LEASES_RESPONSE
  },
  Errors: ERROR_RESPONSES,
  Examples: USAGE_EXAMPLES
}

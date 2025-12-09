/**
 * Email Template Variable Definitions
 *
 * Complete dictionary of available variables for email templates.
 * Each variable includes metadata: key, description, source, format type,
 * required flag, null default, and example value.
 */

export type VariableFormat = 'string' | 'currency' | 'date' | 'url' | 'number' | 'percent';

export interface EmailTemplateVariable {
  key: string;
  description: string;
  source: string; // Table/column or computed function
  format: VariableFormat;
  required: boolean;
  nullDefault: string;
  example: string;
}

export type EmailTemplateKey = 'monthly_rental_statement';

/**
 * Variable definitions for Monthly Rental Statement template
 */
export const MONTHLY_RENTAL_STATEMENT_VARIABLES: EmailTemplateVariable[] = [
  // Statement Metadata
  {
    key: 'statementId',
    description: 'Monthly log ID (UUID)',
    source: 'monthly_logs.id',
    format: 'string',
    required: true,
    nullDefault: '',
    example: '123e4567-e89b-12d3-a456-426614174000',
  },
  {
    key: 'statementUrl',
    description: 'URL to view the statement in the application',
    source: 'Computed: baseUrl + /monthly-logs/{statementId}',
    format: 'url',
    required: false,
    nullDefault: '',
    example: 'https://app.example.com/monthly-logs/123e4567-e89b-12d3-a456-426614174000',
  },
  {
    key: 'pdfUrl',
    description: 'URL to download the statement PDF',
    source: 'monthly_logs.pdf_url',
    format: 'url',
    required: true,
    nullDefault: '',
    example: 'https://storage.example.com/statements/123.pdf',
  },
  {
    key: 'statementCreatedAt',
    description: 'Date and time when the statement was created',
    source: 'monthly_logs.created_at',
    format: 'date',
    required: false,
    nullDefault: '',
    example: '2024-12-07T19:09:27Z',
  },

  // Property Information
  {
    key: 'propertyName',
    description: 'Property name',
    source: 'properties.name',
    format: 'string',
    required: true,
    nullDefault: 'Unknown Property',
    example: '123 Main Street',
  },
  {
    key: 'propertyAddressLine1',
    description: 'Property street address line 1',
    source: 'properties.address_line1',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '123 Main Street',
  },
  {
    key: 'propertyAddressLine2',
    description: 'Property street address line 2 (unit, suite, etc.)',
    source: 'properties.address_line2',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'Suite 100',
  },
  {
    key: 'propertyCity',
    description: 'Property city',
    source: 'properties.city',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'San Francisco',
  },
  {
    key: 'propertyState',
    description: 'Property state or province',
    source: 'properties.state',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'CA',
  },
  {
    key: 'propertyPostalCode',
    description: 'Property postal/ZIP code',
    source: 'properties.postal_code',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '94102',
  },
  {
    key: 'propertyAddress',
    description: 'Full formatted property address',
    source: 'Computed: formatAddress(properties)',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '123 Main Street, San Francisco, CA 94102',
  },
  {
    key: 'propertyParcelId',
    description: 'Property parcel/identifier (Buildium property ID or internal ID)',
    source: 'properties.buildium_property_id',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '123-456-789',
  },

  // Unit Information
  {
    key: 'unitNumber',
    description: 'Unit number or identifier',
    source: 'units.unit_number',
    format: 'string',
    required: false,
    nullDefault: 'N/A',
    example: 'Unit 1',
  },
  {
    key: 'unitName',
    description: 'Unit name (if different from unit number)',
    source: 'units.unit_name',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'Apartment A',
  },
  {
    key: 'unitRent',
    description: 'Monthly rent amount for the unit',
    source: 'lease.rent_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$2,500.00',
  },

  // Owner Information
  {
    key: 'recipientName',
    description: 'Primary owner name or recipient name (computed from primary ownership)',
    source: 'Computed: getPrimaryOwnerName(property)',
    format: 'string',
    required: true,
    nullDefault: 'Property Owner',
    example: 'John Doe',
  },
  {
    key: 'ownerFirstName',
    description: 'Primary owner first name',
    source: 'contacts.first_name (via property.rental_owner_ids)',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'John',
  },
  {
    key: 'ownerLastName',
    description: 'Primary owner last name',
    source: 'contacts.last_name',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'Doe',
  },
  {
    key: 'ownerEmail',
    description: 'Primary owner email address',
    source: 'contacts.primary_email',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'john.doe@example.com',
  },
  {
    key: 'ownerPhone',
    description: 'Primary owner phone number',
    source: 'contacts.primary_phone',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '(555) 123-4567',
  },
  {
    key: 'ownerAddress',
    description: 'Primary owner mailing address (formatted)',
    source: 'Computed: formatAddress(contacts.primary_address_*)',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '456 Owner St, San Francisco, CA 94103',
  },

  // Tenant Information
  {
    key: 'tenantName',
    description: 'Primary tenant name',
    source: 'contacts.display_name (via tenants.contact_id)',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'Jane Smith',
  },
  {
    key: 'tenantEmail',
    description: 'Primary tenant email address',
    source: 'contacts.primary_email',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'jane.smith@example.com',
  },
  {
    key: 'tenantPhone',
    description: 'Primary tenant phone number',
    source: 'contacts.primary_phone',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '(555) 987-6543',
  },

  // Lease Information
  {
    key: 'leaseStartDate',
    description: 'Lease start date',
    source: 'lease.lease_from_date (via monthly_logs.lease_id)',
    format: 'date',
    required: false,
    nullDefault: '',
    example: '2024-01-01',
  },
  {
    key: 'leaseEndDate',
    description: 'Lease end date',
    source: 'lease.lease_to_date',
    format: 'date',
    required: false,
    nullDefault: '',
    example: '2024-12-31',
  },
  {
    key: 'leaseDeposit',
    description: 'Security deposit amount',
    source: 'lease.security_deposit',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$2,500.00',
  },

  // Statement Period
  {
    key: 'periodStart',
    description: 'Statement period start date',
    source: 'monthly_logs.period_start',
    format: 'date',
    required: true,
    nullDefault: '',
    example: '2024-12-01',
  },
  {
    key: 'periodEnd',
    description: 'Statement period end date (end of month)',
    source: 'Computed: endOfMonth(period_start)',
    format: 'date',
    required: false,
    nullDefault: '',
    example: '2024-12-31',
  },
  {
    key: 'periodMonth',
    description: 'Statement period formatted as "Month Year"',
    source: 'Computed: format(period_start, "MMMM yyyy")',
    format: 'date',
    required: true,
    nullDefault: '',
    example: 'December 2024',
  },

  // Financial Summary - Balances
  {
    key: 'openingBalance',
    description: 'Opening balance from previous month',
    source: 'monthly_logs.previous_lease_balance',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$500.00',
  },
  {
    key: 'endingBalance',
    description: 'Ending balance (net to owner)',
    source: 'Computed: calculateNetToOwner(...)',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$1,234.56',
  },

  // Financial Summary - Income
  {
    key: 'totalCharges',
    description: 'Total charges amount',
    source: 'monthly_logs.charges_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$2,500.00',
  },
  {
    key: 'totalPayments',
    description: 'Total payments received',
    source: 'monthly_logs.payments_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$2,500.00',
  },
  {
    key: 'totalCredits',
    description: 'Total credits applied',
    source: 'Computed: sum of credit transactions',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$100.00',
  },

  // Financial Summary - Expenses
  {
    key: 'totalBills',
    description: 'Total bills/expenses paid',
    source: 'monthly_logs.bills_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$500.00',
  },
  {
    key: 'managementFee',
    description: 'Management fee amount',
    source: 'monthly_logs.management_fees_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$250.00',
  },
  {
    key: 'escrowAmount',
    description: 'Escrow amount (positive or negative)',
    source: 'monthly_logs.escrow_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$200.00',
  },
  {
    key: 'totalFees',
    description: 'Total fees (management fees + other fees)',
    source: 'Computed: management_fees_amount + other_fees',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$275.00',
  },
  {
    key: 'taxAmount',
    description: 'Total tax amount',
    source: 'Computed: sum of tax transactions',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$150.00',
  },

  // Financial Summary - Owner Distribution
  {
    key: 'netToOwner',
    description: 'Net amount to owner (formatted currency)',
    source: 'Computed: calculateNetToOwnerValue(...)',
    format: 'currency',
    required: true,
    nullDefault: '$0.00',
    example: '$1,234.56',
  },
  {
    key: 'ownerDraw',
    description: 'Owner draw amount available for distribution (formatted currency)',
    source: 'Computed: getOwnerDrawSummary(...)',
    format: 'currency',
    required: true,
    nullDefault: '$0.00',
    example: '$1,234.56',
  },
  {
    key: 'ownerStatementAmount',
    description: 'Owner statement amount',
    source: 'monthly_logs.owner_statement_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$1,234.56',
  },
  {
    key: 'ownerDistributionAmount',
    description: 'Owner distribution amount',
    source: 'monthly_logs.owner_distribution_amount',
    format: 'currency',
    required: false,
    nullDefault: '$0.00',
    example: '$1,234.56',
  },

  // Organization/Company Information
  {
    key: 'companyName',
    description: 'Organization/company name',
    source: 'organizations.name',
    format: 'string',
    required: true,
    nullDefault: 'Property Management Company',
    example: 'Acme Property Management',
  },
  {
    key: 'companyAddress',
    description: 'Organization address',
    source: 'organizations.address',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '789 Company St, San Francisco, CA 94104',
  },
  {
    key: 'companyPhone',
    description: 'Organization phone number',
    source: 'organizations.phone',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '(555) 555-5555',
  },
  {
    key: 'companyEmail',
    description: 'Organization email address',
    source: 'organizations.email',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'info@acmepm.com',
  },

  // Bank/Remittance Information
  {
    key: 'bankAccountName',
    description: 'Bank account name',
    source: 'bank_accounts.name (via properties.operating_bank_account_id)',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'Operating Account',
  },
  {
    key: 'bankAccountNumber',
    description: 'Bank account number (masked)',
    source: 'bank_accounts.account_number',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '****1234',
  },
  {
    key: 'remitToAddress',
    description: 'Remittance address (company address or bank address)',
    source: 'Computed: companyAddress or bankAddress',
    format: 'string',
    required: false,
    nullDefault: '',
    example: '789 Company St, San Francisco, CA 94104',
  },

  // Statement Notes/Memo
  {
    key: 'statementNotes',
    description: 'Statement notes or memo',
    source: 'monthly_logs.notes',
    format: 'string',
    required: false,
    nullDefault: '',
    example: 'Special note about this statement period',
  },

  // Current Date/Time
  {
    key: 'currentDate',
    description: 'Current year',
    source: 'Computed: new Date().getFullYear()',
    format: 'string',
    required: false,
    nullDefault: '2024',
    example: '2024',
  },
  {
    key: 'currentDateTime',
    description: 'Current date and time',
    source: 'Computed: new Date()',
    format: 'date',
    required: false,
    nullDefault: '',
    example: '2024-12-07T19:09:27Z',
  },
];

/**
 * Get available variables for a template key
 */
export function getAvailableVariables(templateKey: EmailTemplateKey): EmailTemplateVariable[] {
  switch (templateKey) {
    case 'monthly_rental_statement':
      return MONTHLY_RENTAL_STATEMENT_VARIABLES;
    default:
      return [];
  }
}

/**
 * Get variable by key for a template
 */
export function getVariable(
  templateKey: EmailTemplateKey,
  variableKey: string,
): EmailTemplateVariable | undefined {
  const variables = getAvailableVariables(templateKey);
  return variables.find((v) => v.key === variableKey);
}

/**
 * Validate that all variables in a template string are available
 */
export function validateTemplateVariables(
  template: string,
  availableVariables: EmailTemplateVariable[],
): { valid: boolean; invalidVariables: string[] } {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const usedVariables = new Set<string>();
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    usedVariables.add(match[1]);
  }

  const availableKeys = new Set(availableVariables.map((v) => v.key));
  const invalidVariables = Array.from(usedVariables).filter((key) => !availableKeys.has(key));

  return {
    valid: invalidVariables.length === 0,
    invalidVariables,
  };
}

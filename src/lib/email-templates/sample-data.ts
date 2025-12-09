/**
 * Email Template Sample Data
 *
 * Sample variable data for previews, testing, and documentation.
 * Used by preview endpoint, test email endpoint, UI variable helper, and documentation.
 */

import type { TemplateVariableValues } from '@/types/email-templates';

/**
 * Sample variable data for Monthly Rental Statement template
 * Includes realistic example values for all variables
 */
export const MONTHLY_STATEMENT_SAMPLE_VARIABLES: TemplateVariableValues = {
  // Statement Metadata
  statementId: '123e4567-e89b-12d3-a456-426614174000',
  statementUrl: 'https://app.example.com/monthly-logs/123e4567-e89b-12d3-a456-426614174000',
  pdfUrl: 'https://storage.example.com/statements/monthly-statements/123e4567-e89b-12d3-a456-426614174000.pdf',
  statementCreatedAt: '2024-12-07T19:09:27Z',

  // Property Information
  propertyName: '123 Main Street',
  propertyAddressLine1: '123 Main Street',
  propertyAddressLine2: 'Suite 100',
  propertyCity: 'San Francisco',
  propertyState: 'CA',
  propertyPostalCode: '94102',
  propertyAddress: '123 Main Street, Suite 100, San Francisco, CA 94102',
  propertyParcelId: '123-456-789',

  // Unit Information
  unitNumber: 'Unit 1',
  unitName: 'Apartment A',
  unitRent: 2500.00,

  // Owner Information
  recipientName: 'John Doe',
  ownerFirstName: 'John',
  ownerLastName: 'Doe',
  ownerEmail: 'john.doe@example.com',
  ownerPhone: '(555) 123-4567',
  ownerAddress: '456 Owner Street, San Francisco, CA 94103',

  // Tenant Information
  tenantName: 'Jane Smith',
  tenantEmail: 'jane.smith@example.com',
  tenantPhone: '(555) 987-6543',

  // Lease Information
  leaseStartDate: '2024-01-01',
  leaseEndDate: '2024-12-31',
  leaseDeposit: 2500.00,

  // Statement Period
  periodStart: '2024-12-01',
  periodEnd: '2024-12-31',
  periodMonth: 'December 2024',

  // Financial Summary - Balances
  openingBalance: 500.00,
  endingBalance: 1234.56,

  // Financial Summary - Income
  totalCharges: 2500.00,
  totalPayments: 2500.00,
  totalCredits: 100.00,

  // Financial Summary - Expenses
  totalBills: 500.00,
  managementFee: 250.00,
  escrowAmount: 200.00,
  totalFees: 275.00,
  taxAmount: 150.00,

  // Financial Summary - Owner Distribution
  netToOwner: 1234.56,
  ownerDraw: 1234.56,
  ownerStatementAmount: 1234.56,
  ownerDistributionAmount: 1234.56,

  // Organization/Company Information
  companyName: 'Acme Property Management',
  companyAddress: '789 Company Street, San Francisco, CA 94104',
  companyPhone: '(555) 555-5555',
  companyEmail: 'info@acmepm.com',

  // Bank/Remittance Information
  bankAccountName: 'Operating Account',
  bankAccountNumber: '****1234',
  remitToAddress: '789 Company Street, San Francisco, CA 94104',

  // Statement Notes/Memo
  statementNotes: 'Special note about this statement period',

  // Current Date/Time
  currentDate: '2024',
  currentDateTime: '2024-12-07T19:09:27Z',
};


/**
 * Email Template Variable Mapping
 *
 * Builds template variable maps from monthly log data.
 * Maps all available data sources to template variables with proper formatting.
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { getOwnerDrawSummary } from '@/lib/monthly-log-calculations';
import { calculateNetToOwnerValue } from '@/types/monthly-log';
import { endOfMonth, parseISO, format } from 'date-fns';
import type { TemplateVariableValues } from '@/types/email-templates';
import type { Database } from '@/types/database';

type MonthlyLogRow = Database['public']['Tables']['monthly_logs']['Row'];
type PropertyWithBank = Pick<
  Database['public']['Tables']['properties']['Row'],
  | 'id'
  | 'name'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'operating_bank_gl_account_id'
  | 'buildium_property_id'
>;
type UnitInfo = Pick<
  Database['public']['Tables']['units']['Row'],
  'unit_number' | 'unit_name'
>;
type TenantContact = Pick<
  Database['public']['Tables']['contacts']['Row'],
  'first_name' | 'last_name' | 'display_name' | 'primary_email' | 'primary_phone'
>;
type TenantInfo = {
  contact_id: string | number | null;
  contacts: TenantContact | null;
};
type MonthlyLogWithRelations = MonthlyLogRow & {
  properties?: PropertyWithBank | null;
  units?: UnitInfo | null;
  tenants?: TenantInfo | null;
};
type OwnerContact = Pick<
  Database['public']['Tables']['contacts']['Row'],
  | 'first_name'
  | 'last_name'
  | 'primary_email'
  | 'primary_phone'
  | 'primary_address_line_1'
  | 'primary_address_line_2'
  | 'primary_city'
  | 'primary_state'
  | 'primary_postal_code'
>;

/**
 * Get primary owner name from property
 */
async function getPrimaryOwnerName(
  propertyId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<string> {
  try {
    // Try property_ownerships_cache first (fastest)
    const { data: cache } = await db
      .from('property_ownerships_cache')
      .select('display_name, primary')
      .eq('property_id', propertyId)
      .order('primary', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cache?.display_name) {
      return cache.display_name;
    }

    // Fallback to ownerships → owners → contacts
    const { data: ownerships } = await db
      .from('ownerships')
      .select(
        'primary, owners!inner(contacts(first_name, last_name, company_name, display_name))',
      )
      .eq('property_id', propertyId)
      .order('primary', { ascending: false })
      .limit(1);

    const owner = ownerships?.[0];
    const contacts =
      owner &&
      typeof owner === 'object' &&
      owner.owners &&
      typeof owner.owners === 'object' &&
      'contacts' in owner.owners
        ? (owner.owners as { contacts?: { first_name?: string | null; last_name?: string | null; company_name?: string | null; display_name?: string | null } }).contacts
        : undefined;
    if (contacts) {
      const firstName = contacts.first_name?.trim() || '';
      const lastName = contacts.last_name?.trim() || '';
      const combined = `${firstName} ${lastName}`.trim();
      if (combined) return combined;
      if (contacts.company_name) return contacts.company_name;
      if (contacts.display_name) return contacts.display_name;
    }
  } catch (error) {
    console.error('Error fetching primary owner name:', error);
  }

  return 'Property Owner';
}

/**
 * Format address from property data
 */
function formatAddress(data: {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): string {
  const parts: string[] = [];
  if (data.address_line1) parts.push(data.address_line1);
  if (data.address_line2) parts.push(data.address_line2);
  if (data.city || data.state || data.postal_code) {
    const cityStateZip = [data.city, data.state, data.postal_code].filter(Boolean).join(', ');
    if (cityStateZip) parts.push(cityStateZip);
  }
  return parts.join(', ');
}

/**
 * Build template variables from monthly log data
 *
 * @param monthlyLogId - Monthly log ID
 * @param orgId - Organization ID
 * @param db - Supabase client (defaults to admin)
 * @returns Map of variable keys to values
 */
export async function buildTemplateVariables(
  monthlyLogId: string,
  orgId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<TemplateVariableValues> {
  // Fetch comprehensive monthly log data
  const { data: monthlyLog, error: logError } = await db
    .from('monthly_logs')
    .select(
      `
      id,
      period_start,
      pdf_url,
      created_at,
      notes,
      charges_amount,
      payments_amount,
      bills_amount,
      escrow_amount,
      management_fees_amount,
      previous_lease_balance,
      owner_statement_amount,
      owner_distribution_amount,
      property_id,
      unit_id,
      tenant_id,
      lease_id,
      org_id,
	      properties (
	        id,
	        name,
	        address_line1,
	        address_line2,
	        city,
	        state,
	        postal_code,
	        operating_bank_gl_account_id,
	        buildium_property_id
	      ),
      units (
        unit_number,
        unit_name
      ),
      tenants (
        contact_id,
        contacts (
          first_name,
          last_name,
          display_name,
          primary_email,
          primary_phone
        )
      )
    `,
    )
    .eq('id', monthlyLogId)
    .returns<MonthlyLogWithRelations[]>()
    .single();

  if (logError || !monthlyLog) {
    throw new Error('Monthly log not found');
  }

  const property = monthlyLog.properties ?? null;
  const unit = monthlyLog.units ?? null;
  const tenant = monthlyLog.tenants ?? null;
  const tenantContact = tenant?.contacts ?? null;
  const tenantName =
    tenantContact?.display_name ||
    `${tenantContact?.first_name || ''} ${tenantContact?.last_name || ''}`.trim();

  // Fetch organization data
  const { data: organization } = await db
    .from('organizations')
    .select('name, slug')
    .eq('id', orgId)
    .single();

  // Fetch lease data if available
  let leaseData: { start_date: string | null; end_date: string | null; deposit_amount: number | null; rent_amount: number | null } | null = null;
  if (monthlyLog.lease_id) {
    const { data: lease } = await db
      .from('lease')
      .select('lease_from_date, lease_to_date, security_deposit, rent_amount')
      .eq('id', monthlyLog.lease_id)
      .maybeSingle();
    leaseData = lease
      ? {
          start_date: lease.lease_from_date,
          end_date: lease.lease_to_date,
          deposit_amount: lease.security_deposit,
          rent_amount: lease.rent_amount,
        }
      : null;
  }

  // Fetch primary owner contact info
  const primaryOwnerName = await getPrimaryOwnerName(monthlyLog.property_id, db);
  let ownerContact: OwnerContact | null = null;
  try {
    const { data: ownerships } = await db
      .from('ownerships')
      .select(
        'primary, owners!inner(contacts(first_name, last_name, primary_email, primary_phone, primary_address_line_1, primary_address_line_2, primary_city, primary_state, primary_postal_code))',
      )
      .eq('property_id', monthlyLog.property_id)
      .order('primary', { ascending: false })
      .limit(1)
      .returns<
        {
          primary: boolean | null;
          owners: { contacts: OwnerContact | null } | null;
        }[]
      >();

    const owner = ownerships?.[0];
    ownerContact = owner?.owners?.contacts ?? null;
  } catch (error) {
    console.error('Error fetching owner contact:', error);
  }

  // Fetch bank account if available
  let bankAccount: { name?: string | null; account_number?: string | null } | null = null;
  if (property?.operating_bank_gl_account_id) {
    const { data: bank } = await db
      .from('gl_accounts')
      .select('name, bank_account_number')
      .eq('id', property.operating_bank_gl_account_id)
      .maybeSingle<Pick<Database['public']['Tables']['gl_accounts']['Row'], 'name' | 'bank_account_number'>>();
    bankAccount = bank
      ? {
          name: bank?.name ?? null,
          account_number: bank?.bank_account_number ?? null,
        }
      : null;
  }

  const maskAccountNumber = (value?: string | null): string => {
    if (!value) return '';
    const digits = String(value).replace(/\s+/g, '');
    if (digits.length <= 4) return digits;
    return `****${digits.slice(-4)}`;
  };

  // Calculate financial values
  const ownerDrawSummary = await getOwnerDrawSummary(monthlyLogId, db);
  const ownerDraw = ownerDrawSummary.total;

  const netToOwner = calculateNetToOwnerValue({
    previousBalance: monthlyLog.previous_lease_balance || 0,
    totalPayments: monthlyLog.payments_amount || 0,
    totalBills: monthlyLog.bills_amount || 0,
    escrowAmount: monthlyLog.escrow_amount || 0,
    managementFees: monthlyLog.management_fees_amount || 0,
    ownerDraw,
  });

  // Format period dates
  const periodStart = parseISO(monthlyLog.period_start);
  const periodEnd = endOfMonth(periodStart);
  const periodMonth = format(periodStart, 'MMMM yyyy');

  // Build statement URL (assuming base URL from env or computed)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  const statementUrl = baseUrl ? `${baseUrl}/monthly-logs/${monthlyLogId}` : '';

  const propertyAddress = formatAddress({
    address_line1: property?.address_line1,
    address_line2: property?.address_line2,
    city: property?.city,
    state: property?.state,
    postal_code: property?.postal_code,
  });

  const companyName = organization?.name || 'Property Management Company';
  const companyAddress = propertyAddress;
  const companyPhone = '';
  const companyEmail = '';

  // Build variable map
  const variables: TemplateVariableValues = {
    // Statement Metadata
    statementId: monthlyLog.id,
    statementUrl: statementUrl || '',
    pdfUrl: monthlyLog.pdf_url || '',
    statementCreatedAt: monthlyLog.created_at || '',

    // Property Information
    propertyName: property?.name || 'Unknown Property',
    propertyAddressLine1: property?.address_line1 || '',
    propertyAddressLine2: property?.address_line2 || '',
    propertyCity: property?.city || '',
    propertyState: property?.state || '',
    propertyPostalCode: property?.postal_code || '',
    propertyAddress,
    propertyParcelId: property?.buildium_property_id || property?.id || '',

    // Unit Information
    unitNumber: unit?.unit_number || unit?.unit_name || 'N/A',
    unitName: unit?.unit_name || '',
    unitRent: leaseData?.rent_amount || 0,

    // Owner Information
    recipientName: primaryOwnerName,
    ownerFirstName: ownerContact?.first_name || '',
    ownerLastName: ownerContact?.last_name || '',
    ownerEmail: ownerContact?.primary_email || '',
    ownerPhone: ownerContact?.primary_phone || '',
    ownerAddress: formatAddress({
      address_line1: ownerContact?.primary_address_line_1,
      address_line2: ownerContact?.primary_address_line_2,
      city: ownerContact?.primary_city,
      state: ownerContact?.primary_state,
      postal_code: ownerContact?.primary_postal_code,
    }),

    // Tenant Information
    tenantName: tenantName || '',
    tenantEmail: tenantContact?.primary_email || '',
    tenantPhone: tenantContact?.primary_phone || '',

    // Lease Information
    leaseStartDate: leaseData?.start_date || '',
    leaseEndDate: leaseData?.end_date || '',
    leaseDeposit: leaseData?.deposit_amount || 0,

    // Statement Period
    periodStart: format(periodStart, 'yyyy-MM-dd'),
    periodEnd: format(periodEnd, 'yyyy-MM-dd'),
    periodMonth: periodMonth,

    // Financial Summary - Balances
    openingBalance: monthlyLog.previous_lease_balance || 0,
    endingBalance: netToOwner,

    // Financial Summary - Income
    totalCharges: monthlyLog.charges_amount || 0,
    totalPayments: monthlyLog.payments_amount || 0,
    totalCredits: 0, // Would need to calculate from transactions

    // Financial Summary - Expenses
    totalBills: monthlyLog.bills_amount || 0,
    managementFee: monthlyLog.management_fees_amount || 0,
    escrowAmount: monthlyLog.escrow_amount || 0,
    totalFees: monthlyLog.management_fees_amount || 0, // Simplified - could include other fees
    taxAmount: 0, // Would need to calculate from transactions

    // Financial Summary - Owner Distribution
    netToOwner: netToOwner,
    ownerDraw: ownerDraw,
    ownerStatementAmount: monthlyLog.owner_statement_amount || 0,
    ownerDistributionAmount: monthlyLog.owner_distribution_amount || 0,

    // Organization/Company Information
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,

    // Bank/Remittance Information
    bankAccountName: bankAccount?.name || '',
    bankAccountNumber: maskAccountNumber(bankAccount?.account_number),
    remitToAddress: companyAddress,

    // Statement Notes/Memo
    statementNotes: monthlyLog.notes || '',

    // Current Date/Time
    currentDate: new Date().getFullYear().toString(),
    currentDateTime: new Date().toISOString(),
  };

  return variables;
}

import MonthlyLogsPageContent from '@/components/monthly-logs/MonthlyLogsPageContent';
import {
  MONTHLY_LOG_STAGES,
  MONTHLY_LOG_STATUSES,
  type MonthlyLogCardRecord,
} from '@/components/monthly-logs/types';
import { supabase, supabaseAdmin } from '@/lib/db';
import { calculateFinancialSummary } from '@/lib/monthly-log-calculations';

type MonthlyLogQueryRow = {
  id: string;
  period_start: string;
  stage: string;
  status: string;
  property_id: string;
  unit_id: string;
  tenant_id: string | null;
  sort_index: number | null;
  notes: string | null;
  charges_amount: number | null;
  payments_amount: number | null;
  bills_amount: number | null;
  escrow_amount: number | null;
  management_fees_amount: number | null;
  owner_statement_amount: number | null;
  owner_distribution_amount: number | null;
  properties?: {
    id: string;
    name: string | null;
    ownerships?:
      | {
          id: string;
          ownership_percentage: number | null;
          primary: boolean | null;
          owners?: {
            id: string;
            contacts?: {
              display_name?: string | null;
              first_name?: string | null;
              last_name?: string | null;
              company_name?: string | null;
            } | null;
          } | null;
        }[]
      | null;
  } | null;
  units?: {
    id: string;
    unit_number: string | null;
    unit_name: string | null;
  } | null;
  tenants?: {
    id: string;
    contact_id: number | null;
    contacts?: {
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      company_name?: string | null;
    } | null;
  } | null;
};

type SearchParams = {
  month?: string;
};

type PropertyOption = {
  id: string;
  name: string | null;
};

type UnitOption = {
  id: string;
  property_id: string;
  unit_number: string | null;
  unit_name: string | null;
  status: string;
  is_active: boolean | null;
};

function toStage(value: unknown): MonthlyLogCardRecord['stage'] {
  const normalized = String(value ?? '').toLowerCase();
  return MONTHLY_LOG_STAGES.includes(normalized as (typeof MONTHLY_LOG_STAGES)[number])
    ? (normalized as MonthlyLogCardRecord['stage'])
    : 'charges';
}

function toStatus(value: unknown): MonthlyLogCardRecord['status'] {
  const normalized = String(value ?? '').toLowerCase();
  return MONTHLY_LOG_STATUSES.includes(normalized as (typeof MONTHLY_LOG_STATUSES)[number])
    ? (normalized as MonthlyLogCardRecord['status'])
    : 'pending';
}

function parseMonthParam(value?: string): Date {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const match = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
  if (!match) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  return new Date(Date.UTC(year, monthIndex, 1));
}

function addMonths(base: Date, delta: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const newMonth = month + delta;

  // Calculate the new year and month
  const newYear = year + Math.floor(newMonth / 12);
  const adjustedMonth = ((newMonth % 12) + 12) % 12;

  return new Date(Date.UTC(newYear, adjustedMonth, 1));
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${monthNames[month]} ${year}`;
}

function buildTenantName(row: MonthlyLogQueryRow['tenants']): string | null {
  if (!row) return null;
  const contact = row.contacts;
  if (!contact) return null;
  if (contact.display_name) return contact.display_name;
  const first = contact.first_name?.trim() ?? '';
  const last = contact.last_name?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (contact.company_name) return contact.company_name;
  return null;
}

function buildPrimaryOwnerName(property: MonthlyLogQueryRow['properties']): string | null {
  if (!property) return null;

  // If no ownerships data, return null
  if (!property.ownerships || !Array.isArray(property.ownerships)) {
    return null;
  }

  // First, try to find the primary owner (primary: true)
  const primaryOwnership = property.ownerships.find((ownership) => ownership.primary === true);
  if (primaryOwnership?.owners?.contacts) {
    const contact = primaryOwnership.owners.contacts;
    const first = contact.first_name?.trim() ?? '';
    const last = contact.last_name?.trim() ?? '';
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
    if (contact.company_name) return contact.company_name;
    return contact.display_name || null;
  }

  // If no primary owner found, try the owner with highest percentage
  const highestOwnership = property.ownerships.reduce((max, ownership) => {
    const currentPercentage = ownership.ownership_percentage || 0;
    const maxPercentage = max.ownership_percentage || 0;
    return currentPercentage > maxPercentage ? ownership : max;
  });

  if (highestOwnership?.owners?.contacts) {
    const contact = highestOwnership.owners.contacts;
    const first = contact.first_name?.trim() ?? '';
    const last = contact.last_name?.trim() ?? '';
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
    if (contact.company_name) return contact.company_name;
    return contact.display_name || null;
  }

  return null;
}

export default async function MonthlyLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = (await searchParams) || {};
  const resolvedMonth = parseMonthParam(typeof sp.month === 'string' ? sp.month : undefined);
  const periodStartIso = resolvedMonth.toISOString().slice(0, 10);

  const db = supabaseAdmin || supabase;
  if (!db) {
    throw new Error('Database client is unavailable');
  }

  const logsRes = await db
    .from('monthly_logs')
    .select(
      `
        id,
        period_start,
        stage,
        status,
        sort_index,
        notes,
        charges_amount,
        payments_amount,
        bills_amount,
        escrow_amount,
        management_fees_amount,
        owner_statement_amount,
        owner_distribution_amount,
        property_id,
        unit_id,
        tenant_id,
        properties:properties!monthly_logs_property_id_fkey(
          id, 
          name,
          ownerships:ownerships!ownerships_property_id_fkey(
            id,
            ownership_percentage,
            primary,
            owners:owners!ownerships_owner_id_fkey(
              id,
              contacts:contacts!owners_contact_fk(
                display_name,
                first_name,
                last_name,
                company_name
              )
            )
          )
        ),
        units:units!monthly_logs_unit_id_fkey(id, unit_number, unit_name),
        tenants:tenants!monthly_logs_tenant_id_fkey(
          id,
          contact_id,
          contacts:contacts!tenants_contact_id_fkey(
            display_name,
            first_name,
            last_name,
            company_name
          )
        )
      `,
    )
    .eq('period_start', periodStartIso)
    .order('stage', { ascending: true })
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (logsRes.error) {
    console.error('Failed to load monthly logs', logsRes.error);
  }

  const rows: MonthlyLogQueryRow[] = Array.isArray(logsRes.data)
    ? (logsRes.data as unknown as MonthlyLogQueryRow[])
    : [];

  const summaryEntries = await Promise.all(
    rows.map(async (row) => {
      try {
        const summary = await calculateFinancialSummary(row.id, { db });
        return [row.id, summary] as const;
      } catch (error) {
        console.error('Failed to calculate financial summary for monthly log', {
          logId: row.id,
          error,
        });
        return [row.id, null] as const;
      }
    }),
  );
  const summaries = new Map(summaryEntries);

  const { data: propertyRows, error: propertyError } = await db
    .from('properties')
    .select('id, name, status, is_active')
    .eq('status', 'Active')
    .order('name', { ascending: true });

  if (propertyError) {
    console.error('Failed to load properties for monthly log creation', propertyError);
  }

  const properties: PropertyOption[] = Array.isArray(propertyRows)
    ? (propertyRows as PropertyOption[])
    : [];

  let units: UnitOption[] = [];
  if (properties.length > 0) {
    const propertyIds = properties.map((row) => row.id);
    const { data: unitRows, error: unitError } = await db
      .from('units')
      .select('id, property_id, unit_number, unit_name, status, is_active')
      .in('property_id', propertyIds)
      .in('status', ['Occupied', 'Vacant'])
      .or('is_active.is.null,is_active.eq.true')
      .order('unit_number', { ascending: true });

    if (unitError) {
      console.error('Failed to load units for monthly log creation', unitError);
    } else if (Array.isArray(unitRows)) {
      units = unitRows as UnitOption[];
    }
  }

  const records: MonthlyLogCardRecord[] = rows.map((row) => {
    const stage = toStage(row.stage);
    const status = toStatus(row.status);
    const propertyName = row.properties?.name?.trim() || 'Property';
    const tenantName = buildTenantName(row.tenants);
    const unitName = row.units?.unit_name?.trim() || row.units?.unit_number?.trim() || 'Unit';
    const primaryOwnerName = buildPrimaryOwnerName(row.properties);
    const unitTitle = unitName;
    const unitSubtitle = primaryOwnerName || propertyName;

    const summary = summaries.get(row.id);
    const chargesAmount = summary?.totalCharges ?? Number(row.charges_amount ?? 0);
    const paymentsAmount = summary?.totalPayments ?? Number(row.payments_amount ?? 0);
    const billsAmount = summary?.totalBills ?? Number(row.bills_amount ?? 0);
    const escrowAmount = summary?.escrowAmount ?? Number(row.escrow_amount ?? 0);
    const managementFeesAmount =
      summary?.managementFees ?? Number(row.management_fees_amount ?? 0);
    const ownerDistributionAmount =
      summary?.ownerDraw ?? Number(row.owner_distribution_amount ?? 0);

    return {
      id: row.id,
      periodStart: row.period_start,
      stage,
      status,
      propertyId: row.property_id,
      propertyName,
      unitId: row.unit_id,
      unitTitle,
      unitSubtitle,
      tenantName,
      chargesAmount,
      paymentsAmount,
      billsAmount,
      escrowAmount,
      managementFeesAmount,
      ownerStatementAmount: Number(row.owner_statement_amount ?? 0),
      ownerDistributionAmount,
      sortIndex: Number.isFinite(row.sort_index) ? Number(row.sort_index) : 0,
      notes: row.notes,
    };
  });

  const monthLabel = formatMonthLabel(resolvedMonth);
  const previousMonthKey = monthKey(addMonths(resolvedMonth, -1));
  const nextMonthKey = monthKey(addMonths(resolvedMonth, 1));

  return (
    <MonthlyLogsPageContent
      monthLabel={monthLabel}
      previousMonthKey={previousMonthKey}
      nextMonthKey={nextMonthKey}
      periodStartIso={periodStartIso}
      records={records}
      availableProperties={properties.map((property) => ({
        id: property.id,
        name: property.name?.trim() || 'Property',
      }))}
      availableUnits={units.map((unit) => ({
        id: unit.id,
        propertyId: unit.property_id,
        label: buildUnitOptionLabel(unit),
      }))}
    />
  );
}

function buildUnitOptionLabel(unit: UnitOption): string {
  const number = unit.unit_number?.trim();
  if (number) return number;
  return 'Unit';
}

import { notFound } from 'next/navigation';

import MonthlyLogDetailPageContent from '@/components/monthly-logs/MonthlyLogDetailPageContent';
import type { LeaseTenantOption } from '@/components/leases/types';
import { getSupabaseServiceRoleClient, type TypedSupabaseClient } from '@/lib/db';
import { traceAsync } from '@/lib/metrics/trace';
import {
  loadAssignedTransactionsBundle,
  loadUnassignedTransactionsPage,
} from '@/server/monthly-logs/transactions';
import type { MonthlyLogFinancialSummary, MonthlyLogTransaction } from '@/types/monthly-log';

type LeaseContactRecord = {
  role: string | null;
  tenant_id?: string | number | null;
  tenants?: {
    id?: string | number | null;
    buildium_tenant_id?: number | null;
    contact?: {
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      company_name?: string | null;
    } | null;
  } | null;
};

type TenantOption = LeaseTenantOption;

type ActiveLeaseRow = {
  id: number;
  lease_from_date: string;
  lease_to_date: string | null;
  rent_amount: number | null;
  status: string | null;
  lease_contacts: LeaseContactRecord[] | null;
};

interface MonthlyLogDetailPageProps {
  params: Promise<{ logId: string }>;
}

export default async function MonthlyLogDetailPage({ params }: MonthlyLogDetailPageProps) {
  const { logId } = await params;
  const supabase = getSupabaseServiceRoleClient('loading monthly log details');

  const monthlyLog = await fetchMonthlyLogRecord(logId, supabase);
  if (!monthlyLog) {
    notFound();
  }

  const activeLeaseContext = monthlyLog.unit_id
    ? await loadActiveLeaseSummary(supabase, monthlyLog.unit_id)
    : { summary: null, tenantOptions: [] };

  const [assignedBundle, unassignedPage] = await Promise.all([
    loadAssignedTransactionsBundle(logId, supabase),
    loadUnassignedTransactionsPage(
      { leaseId: activeLeaseContext.summary?.id ?? null, limit: 50 },
      supabase,
    ),
  ]);

  const initialData: {
    assignedTransactions: MonthlyLogTransaction[];
    financialSummary: MonthlyLogFinancialSummary | null;
    unassignedTransactions: MonthlyLogTransaction[];
    unassignedCursor: string | null;
  } = {
    assignedTransactions: assignedBundle.transactions,
    financialSummary: assignedBundle.summary,
    unassignedTransactions: unassignedPage.items,
    unassignedCursor: unassignedPage.nextCursor,
  };

  const unitData = monthlyLog.units
    ? {
        id: monthlyLog.units.id,
        unit_number: monthlyLog.units.unit_number,
        unit_name: monthlyLog.units.unit_name,
        service_plan: monthlyLog.units.service_plan ?? null,
        active_services: parseManagementServices(monthlyLog.units.active_services),
        fee_dollar_amount:
          typeof monthlyLog.units.fee_dollar_amount === 'number'
            ? monthlyLog.units.fee_dollar_amount
            : monthlyLog.units.fee_dollar_amount != null
              ? Number(monthlyLog.units.fee_dollar_amount)
              : null,
      }
    : null;

  const tenantData = monthlyLog.tenants
    ? {
        id: monthlyLog.tenants.id,
        first_name: monthlyLog.tenants.contact?.first_name ?? null,
        last_name: monthlyLog.tenants.contact?.last_name ?? null,
        company_name: monthlyLog.tenants.contact?.company_name ?? null,
      }
    : null;

  const monthlyLogWithRelations = {
    ...monthlyLog,
    units: unitData,
    tenants: tenantData,
    activeLease: activeLeaseContext.summary,
  };

  return (
    <MonthlyLogDetailPageContent
      monthlyLog={monthlyLogWithRelations}
      tasks={[]}
      tenantOptions={activeLeaseContext.tenantOptions}
      initialData={initialData}
    />
  );
}

async function fetchMonthlyLogRecord(
  logId: string,
  supabase: TypedSupabaseClient,
) {
  const { data, error } = await traceAsync('monthlyLog.fetch.record', () =>
    supabase
      .from('monthly_logs')
      .select(
        `
        id,
        period_start,
        stage,
        status,
        notes,
        property_id,
        unit_id,
        tenant_id,
        org_id,
        properties:properties (
          id,
          name
        ),
        units:units (
          id,
          unit_number,
          unit_name,
          service_plan,
          active_services,
          fee_dollar_amount
        ),
        tenants:tenants (
          id,
          contact:contacts (
            display_name,
            first_name,
            last_name,
            company_name
          )
        )
      `,
      )
      .eq('id', logId)
      .maybeSingle(),
  );

  if (error) {
    console.error('[monthly-log] Failed to load log', { logId, error });
    throw error;
  }

  if (!data) return null;

  return data;
}

async function loadActiveLeaseSummary(
  supabase: TypedSupabaseClient,
  unitId: string,
): Promise<{ summary: ActiveLeaseRow & { tenant_names: string[]; total_charges: number } | null; tenantOptions: TenantOption[] }> {
  const { data: leaseRow } = await traceAsync('monthlyLog.activeLease.row', () =>
    supabase
      .from('lease')
      .select(
        `
        id,
        lease_from_date,
        lease_to_date,
        rent_amount,
        status,
        lease_contacts(
          role,
          tenant_id,
          tenants(
            id,
            buildium_tenant_id,
            contact:contacts(
              display_name,
              first_name,
              last_name,
              company_name,
              is_company
            )
          )
        )
      `,
      )
      .eq('unit_id', unitId)
      .eq('status', 'active')
      .order('lease_from_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (!leaseRow) {
    return { summary: null, tenantOptions: [] };
  }

  const normalizedLease: ActiveLeaseRow = {
    ...leaseRow,
    lease_contacts: Array.isArray(leaseRow.lease_contacts) ? leaseRow.lease_contacts : [],
  };

  const tenantOptions = buildTenantOptions(normalizedLease);

  const { data: chargeRows } = await traceAsync('monthlyLog.activeLease.chargeTotals', () =>
    supabase
      .from('transactions')
      .select('total_amount, transaction_type')
      .eq('lease_id', normalizedLease.id)
      .eq('transaction_type', 'Charge'),
  );

  let totalCharges = 0;
  if (Array.isArray(chargeRows)) {
    totalCharges = chargeRows.reduce((sum, row) => {
      const amount =
        typeof row.total_amount === 'number' ? row.total_amount : Number(row.total_amount ?? 0);
      return sum + Math.abs(amount || 0);
    }, 0);
  }

  const tenantNames = tenantOptions.map((option) => option.name);

  return {
    summary: {
      ...normalizedLease,
      tenant_names: tenantNames,
      total_charges: totalCharges,
    },
    tenantOptions,
  };
}

function buildTenantOptions(leaseRow: ActiveLeaseRow): TenantOption[] {
  const tenantOptionMap = new Map<string, TenantOption>();
  const contacts = Array.isArray(leaseRow.lease_contacts) ? leaseRow.lease_contacts : [];

  for (const contact of contacts) {
    if (!contact) continue;
    const record = contact.tenants?.contact;
    const tenantIdRaw = (contact as any)?.tenant_id ?? contact.tenants?.id ?? null;
    if (!record || tenantIdRaw == null) continue;

    const displayName =
      record.display_name ||
      record.company_name ||
      [record.first_name, record.last_name].filter(Boolean).join(' ').trim() ||
      'Tenant';

    const buildiumTenantIdRaw = contact.tenants?.buildium_tenant_id ?? null;
    const buildiumTenantId =
      typeof buildiumTenantIdRaw === 'number'
        ? buildiumTenantIdRaw
        : buildiumTenantIdRaw != null && !Number.isNaN(Number(buildiumTenantIdRaw))
          ? Number(buildiumTenantIdRaw)
          : null;

    tenantOptionMap.set(String(tenantIdRaw), {
      id: String(tenantIdRaw),
      name: displayName,
      buildiumTenantId,
    });
  }

  return Array.from(tenantOptionMap.values());
}

const parseManagementServices = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : null))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : null))
          .filter((item): item is string => Boolean(item));
      }
    } catch {
      // fall through to handling raw postgres array string
    }
    const trimmed = value.trim();
    const stripBraces =
      trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1) : trimmed;
    return stripBraces
      .split(',')
      .map((entry) => entry.trim().replace(/^"(.*)"$/, '$1'))
      .filter((entry) => entry.length > 0);
  }
  return [];
};

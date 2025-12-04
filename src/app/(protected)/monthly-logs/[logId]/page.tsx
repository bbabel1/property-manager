import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import MonthlyLogDetailPageContent from '@/components/monthly-logs/MonthlyLogDetailPageContent';
import type { LeaseTenantOption } from '@/components/leases/types';
import { getSupabaseServiceRoleClient, type TypedSupabaseClient } from '@/lib/db';
import { traceAsync } from '@/lib/metrics/trace';
import {
  loadAssignedTransactionsBundle,
  loadUnassignedTransactionsPage,
} from '@/server/monthly-logs/transactions';
import { listMonthlyLogTasks } from '@/server/monthly-logs/tasks';
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
  try {
    const { logId } = await params;
    const supabase = getSupabaseServiceRoleClient('loading monthly log details');

    const monthlyLog = await fetchMonthlyLogRecord(logId, supabase);
    if (!monthlyLog) {
      notFound();
    }

    const activeLeaseContext = monthlyLog.unit_id
    ? await loadActiveLeaseSummary(supabase, {
        unitId: monthlyLog.unit_id,
        leaseId: monthlyLog.lease_id ?? null,
      })
    : { summary: null, tenantOptions: [] };

  const [assignedBundle, unassignedPage] = await Promise.all([
    loadAssignedTransactionsBundle(logId, supabase),
    loadUnassignedTransactionsPage(
      { leaseId: activeLeaseContext.summary?.id ?? null, limit: 50 },
      supabase,
    ),
  ]);
  const tasks = await listMonthlyLogTasks(logId, supabase);

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
          unit_number: monthlyLog.units.unit_number ?? null,
          unit_name: monthlyLog.units.unit_name ?? null,
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

    // Ensure all data is properly serialized for RSC
    // Convert any Date objects to strings and ensure all values are serializable
    const monthlyLogWithRelations = {
      id: String(monthlyLog.id),
      period_start: typeof monthlyLog.period_start === 'string' 
        ? monthlyLog.period_start 
        : monthlyLog.period_start instanceof Date 
          ? monthlyLog.period_start.toISOString() 
          : String(monthlyLog.period_start ?? ''),
      stage: monthlyLog.stage ?? null,
      status: monthlyLog.status ?? null,
      notes: monthlyLog.notes ?? null,
      property_id: monthlyLog.property_id ? String(monthlyLog.property_id) : null,
      unit_id: monthlyLog.unit_id ? String(monthlyLog.unit_id) : null,
      tenant_id: monthlyLog.tenant_id ? String(monthlyLog.tenant_id) : null,
      org_id: monthlyLog.org_id ? String(monthlyLog.org_id) : null,
      lease_id: monthlyLog.lease_id != null ? Number(monthlyLog.lease_id) : null,
      properties: monthlyLog.properties ? {
        id: String(monthlyLog.properties.id),
        name: monthlyLog.properties.name ?? null,
      } : null,
      units: unitData,
      tenants: tenantData,
      activeLease: activeLeaseContext.summary ? {
        id: Number(activeLeaseContext.summary.id),
        lease_from_date: typeof activeLeaseContext.summary.lease_from_date === 'string' 
          ? activeLeaseContext.summary.lease_from_date 
          : activeLeaseContext.summary.lease_from_date instanceof Date
            ? activeLeaseContext.summary.lease_from_date.toISOString()
            : String(activeLeaseContext.summary.lease_from_date ?? ''),
        lease_to_date: activeLeaseContext.summary.lease_to_date 
          ? (typeof activeLeaseContext.summary.lease_to_date === 'string'
              ? activeLeaseContext.summary.lease_to_date
              : activeLeaseContext.summary.lease_to_date instanceof Date
                ? activeLeaseContext.summary.lease_to_date.toISOString()
                : String(activeLeaseContext.summary.lease_to_date))
          : null,
        rent_amount: typeof activeLeaseContext.summary.rent_amount === 'number' 
          ? activeLeaseContext.summary.rent_amount 
          : null,
        status: activeLeaseContext.summary.status ?? null,
        tenant_names: Array.isArray(activeLeaseContext.summary.tenant_names) 
          ? activeLeaseContext.summary.tenant_names 
          : [],
        total_charges: typeof activeLeaseContext.summary.total_charges === 'number' 
          ? activeLeaseContext.summary.total_charges 
          : 0,
        // Don't include lease_contacts as it might have circular references
        // The client component doesn't need it based on the type definition
      } : null,
    };

    // Ensure all data is serializable for client components
    const serializedInitialData = {
      assignedTransactions: Array.isArray(initialData.assignedTransactions) ? initialData.assignedTransactions : [],
      financialSummary: initialData.financialSummary || null,
      unassignedTransactions: Array.isArray(initialData.unassignedTransactions) ? initialData.unassignedTransactions : [],
      unassignedCursor: typeof initialData.unassignedCursor === 'string' ? initialData.unassignedCursor : null,
    };

    // Ensure all required fields are properly defined and serializable
    // Create a completely fresh object to avoid any potential circular references
    const safeMonthlyLog = {
      id: String(monthlyLogWithRelations.id),
      period_start: String(monthlyLogWithRelations.period_start ?? ''),
      stage: String(monthlyLogWithRelations.stage ?? 'charges'),
      status: String(monthlyLogWithRelations.status ?? 'pending'),
      notes: monthlyLogWithRelations.notes ?? null,
      property_id: monthlyLogWithRelations.property_id ?? null,
      unit_id: monthlyLogWithRelations.unit_id ?? null,
      tenant_id: monthlyLogWithRelations.tenant_id ?? null,
      org_id: monthlyLogWithRelations.org_id ?? null,
      lease_id: monthlyLogWithRelations.lease_id ?? null,
      properties: monthlyLogWithRelations.properties,
      units: monthlyLogWithRelations.units,
      tenants: monthlyLogWithRelations.tenants,
      activeLease: monthlyLogWithRelations.activeLease,
    };

    // Ensure tasks is a plain array
    const safeTasks = Array.isArray(tasks)
      ? tasks.map((task) => ({
          id: String(task.id ?? ''),
          subject: String(task.subject ?? ''),
          statusKey: task.statusKey ?? 'new',
          statusLabel: String(task.statusLabel ?? ''),
          dueDateLabel: String(task.dueDateLabel ?? ''),
          priorityKey: task.priorityKey ?? 'normal',
          priorityLabel: String(task.priorityLabel ?? ''),
          categoryLabel: task.categoryLabel ?? null,
          assignedToLabel: task.assignedToLabel ?? null,
          assignedToInitials: task.assignedToInitials ?? null,
          updatedRelativeLabel: String(task.updatedRelativeLabel ?? ''),
        }))
      : [];

    // Ensure tenantOptions is a plain array
    const safeTenantOptions = Array.isArray(activeLeaseContext.tenantOptions)
      ? activeLeaseContext.tenantOptions.map(option => ({
          id: String(option.id ?? ''),
          label: String(option.label ?? ''),
          buildiumTenantId: option.buildiumTenantId ?? null,
        }))
      : [];

    return (
      <Suspense fallback={<div className="p-6">Loading monthly log details...</div>}>
        <MonthlyLogDetailPageContent
          monthlyLog={safeMonthlyLog}
          tasks={safeTasks}
          tenantOptions={safeTenantOptions}
          initialData={serializedInitialData}
        />
      </Suspense>
    );
  } catch (error) {
    console.error('Error in MonthlyLogDetailPage:', error);
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-red-600">Error Loading Monthly Log</h1>
        <p className="text-gray-600 mt-2">There was an error loading the monthly log details.</p>
        <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
          {error instanceof Error ? error.message : 'Unknown error'}
        </pre>
      </div>
    );
  }
}

async function fetchMonthlyLogRecord(
  logId: string,
  supabase: TypedSupabaseClient,
) {
  const baseSelect = `
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
  `;

  const selectWithLeaseId = `
    lease_id,
    ${baseSelect}
  `;

  const runSelect = (selectFields: string) =>
    supabase.from('monthly_logs').select(selectFields).eq('id', logId).maybeSingle();

  const primaryResult = await traceAsync('monthlyLog.fetch.record', () =>
    runSelect(selectWithLeaseId),
  );

  const isMissingLeaseColumn = (err: unknown) => {
    const message = (err as any)?.message?.toLowerCase?.() ?? '';
    return message.includes('lease_id') && message.includes('column');
  };

  const { data, error } =
    primaryResult.error && isMissingLeaseColumn(primaryResult.error)
      ? await traceAsync('monthlyLog.fetch.record.fallback', () => runSelect(baseSelect))
      : primaryResult;

  if (error) {
    console.error('[monthly-log] Failed to load log', { logId, error });
    throw error;
  }

  if (!data) return null;

  return data;
}

async function loadActiveLeaseSummary(
  supabase: TypedSupabaseClient,
  params: { unitId: string; leaseId?: number | null },
): Promise<{ summary: ActiveLeaseRow & { tenant_names: string[]; total_charges: number } | null; tenantOptions: TenantOption[] }> {
  const { unitId, leaseId } = params;

  const leaseSelect = `
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
  `;

  const buildBaseQuery = () =>
    supabase
      .from('lease')
      .select(leaseSelect)
      .eq('status', 'active')
      .eq('unit_id', unitId);

  let leaseRow: ActiveLeaseRow | null = null;

  if (leaseId) {
    const { data } = await traceAsync('monthlyLog.activeLease.row', () =>
      buildBaseQuery().eq('id', leaseId).limit(1).maybeSingle(),
    );
    leaseRow = (data as ActiveLeaseRow | null) ?? null;
  }

  if (!leaseRow) {
    const { data } = await traceAsync('monthlyLog.activeLease.row.fallback', () =>
      buildBaseQuery().order('lease_from_date', { ascending: false }).limit(1).maybeSingle(),
    );
    leaseRow = (data as ActiveLeaseRow | null) ?? null;
  }

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
      // Check if the string looks like HTML before attempting JSON.parse
      const trimmedValue = value.trim();
      if (trimmedValue.startsWith('<')) {
        console.warn('parseManagementServices received HTML instead of JSON:', trimmedValue.substring(0, 100));
        return [];
      }
      
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : null))
          .filter((item): item is string => Boolean(item));
      }
    } catch (error) {
      // Log the error for debugging but don't throw
      console.warn('parseManagementServices JSON.parse failed:', error, 'value:', typeof value === 'string' ? value.substring(0, 100) : value);
      // fall through to handling raw postgres array string
    }
    const trimmed = value.trim();
    // Additional safety check for HTML content
    if (trimmed.startsWith('<')) {
      console.warn('parseManagementServices received HTML in fallback parsing:', trimmed.substring(0, 100));
      return [];
    }
    const stripBraces =
      trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1) : trimmed;
    return stripBraces
      .split(',')
      .map((entry) => entry.trim().replace(/^"(.*)"$/, '$1'))
      .filter((entry) => entry.length > 0);
  }
  return [];
};

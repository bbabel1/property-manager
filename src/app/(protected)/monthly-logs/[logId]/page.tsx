import Link from 'next/link';
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
import { Body, Heading, Label } from '@/ui/typography';

type MonthlyLogStatus = 'pending' | 'complete' | 'in_progress';
type MonthlyLogRecord = {
  id: string | number;
  period_start: string | Date | null;
  stage: string | null;
  status: MonthlyLogStatus | string | null;
  notes: string | null;
  property_id: string | number | null;
  unit_id: string | number | null;
  tenant_id: string | number | null;
  org_id: string | number | null;
  lease_id: number | null;
  properties?: { id: string | number; name: string | null; service_assignment?: string | null } | null;
  units?: {
    id: string | number;
    unit_number: string | null;
    unit_name: string | null;
  } | null;
  tenants?: {
    id: string | number;
    contact?: {
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      company_name?: string | null;
    } | null;
  } | null;
};
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

type ManagementServicesSummary = {
  servicePlan: string | null;
  activeServices: string[];
  feeType: 'Flat Rate' | 'Percentage' | null;
  feeDollarAmount: number | null;
  feePercentage: number | null;
  billingFrequency: string | null;
};

type ServicePlanAssignmentRow = {
  id: string | number | null;
  plan_id: string | number | null;
  plan_fee_amount: number | null;
  plan_fee_percent: number | null;
  plan_fee_frequency: string | null;
};

type ServiceOfferingAssignmentRow = {
  offering_id: string | number | null;
  is_active?: boolean | null;
};

type ServicePlanServiceRow = {
  offering_id: string | number | null;
};

type ServiceOfferingRow = {
  id: string | number | null;
  name?: string | null;
};

interface MonthlyLogDetailPageProps {
  params: Promise<{ logId: string }>;
}

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
};

export default async function MonthlyLogDetailPage({ params }: MonthlyLogDetailPageProps) {
  try {
    const { logId } = await params;
    const supabase = getSupabaseServiceRoleClient('loading monthly log details');

    const normalizeDate = (value: unknown): string | null => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') return value;
      return value != null ? String(value) : null;
    };

    const normalizeStatus = (value: unknown): MonthlyLogStatus => {
      if (value === 'complete' || value === 'in_progress') return value;
      return 'pending';
    };

    const monthlyLog = await fetchMonthlyLogRecord(logId, supabase);
    if (!monthlyLog) {
      return (
        <div className="p-6 space-y-3">
          <Heading as="h1" size="h4">
            Monthly log not found
          </Heading>
          <Body tone="muted">
            The monthly log you&apos;re looking for was deleted or no longer exists. Please select
            another log to continue.
          </Body>
          <Label
            as={Link}
            href="/monthly-logs"
            className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Back to monthly logs
          </Label>
        </div>
      );
    }

    const activeLeaseContext = monthlyLog.unit_id
      ? await loadActiveLeaseSummary(supabase, {
          unitId: monthlyLog.unit_id ? String(monthlyLog.unit_id) : '',
          leaseId: monthlyLog.lease_id ?? null,
        })
      : { summary: null, tenantOptions: [] };

    const managementServicesSummary = await loadManagementServicesSummary(supabase, {
      orgId: monthlyLog.org_id ? String(monthlyLog.org_id) : null,
      propertyId: monthlyLog.property_id ? String(monthlyLog.property_id) : null,
      unitId: monthlyLog.unit_id ? String(monthlyLog.unit_id) : null,
      serviceAssignment: monthlyLog.properties?.service_assignment ?? null,
      rentAmount: activeLeaseContext.summary?.rent_amount ?? null,
    });

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
        id: String(monthlyLog.units.id),
        unit_number: monthlyLog.units.unit_number ?? null,
        unit_name: monthlyLog.units.unit_name ?? null,
      }
    : null;

  const tenantData = monthlyLog.tenants
    ? {
        id: String(monthlyLog.tenants.id),
        first_name: monthlyLog.tenants.contact?.first_name ?? null,
        last_name: monthlyLog.tenants.contact?.last_name ?? null,
        company_name: monthlyLog.tenants.contact?.company_name ?? null,
      }
    : null;

    // Ensure all data is properly serialized for RSC
    // Convert any Date objects to strings and ensure all values are serializable
  const monthlyLogWithRelations = {
    id: String(monthlyLog.id),
    period_start: normalizeDate(monthlyLog.period_start) ?? '',
    stage: monthlyLog.stage ?? null,
    status: monthlyLog.status ?? null,
    notes: monthlyLog.notes ?? null,
    property_id: monthlyLog.property_id ? String(monthlyLog.property_id) : null,
    unit_id: monthlyLog.unit_id ? String(monthlyLog.unit_id) : null,
    tenant_id: monthlyLog.tenant_id ? String(monthlyLog.tenant_id) : null,
    org_id: monthlyLog.org_id ? String(monthlyLog.org_id) : null,
    lease_id: monthlyLog.lease_id != null ? Number(monthlyLog.lease_id) : null,
    properties: monthlyLog.properties
      ? {
          id: String(monthlyLog.properties.id),
          name: monthlyLog.properties.name ?? null,
          service_assignment: monthlyLog.properties.service_assignment ?? null,
        }
      : null,
    units: unitData,
    tenants: tenantData,
    managementServices: managementServicesSummary,
    activeLease: activeLeaseContext.summary
      ? {
          id: Number(activeLeaseContext.summary.id),
          lease_from_date: normalizeDate(activeLeaseContext.summary.lease_from_date) ?? '',
          lease_to_date: normalizeDate(activeLeaseContext.summary.lease_to_date),
          rent_amount:
            typeof activeLeaseContext.summary.rent_amount === 'number'
              ? activeLeaseContext.summary.rent_amount
              : null,
          status: activeLeaseContext.summary.status ?? null,
          tenant_names: Array.isArray(activeLeaseContext.summary.tenant_names)
            ? activeLeaseContext.summary.tenant_names
            : [],
          total_charges:
            typeof activeLeaseContext.summary.total_charges === 'number'
              ? activeLeaseContext.summary.total_charges
              : 0,
          // Don't include lease_contacts as it might have circular references
          // The client component doesn't need it based on the type definition
        }
      : null,
  };

    // Ensure all data is serializable for client components
    const serializedInitialData = {
      assignedTransactions: Array.isArray(initialData.assignedTransactions)
        ? initialData.assignedTransactions
        : [],
      financialSummary: initialData.financialSummary || null,
      unassignedTransactions: Array.isArray(initialData.unassignedTransactions)
        ? initialData.unassignedTransactions
        : [],
      unassignedCursor:
        typeof initialData.unassignedCursor === 'string' ? initialData.unassignedCursor : null,
    };

    // Ensure all required fields are properly defined and serializable
    // Create a completely fresh object to avoid any potential circular references
    const safeMonthlyLog = {
      id: String(monthlyLogWithRelations.id),
      period_start: String(monthlyLogWithRelations.period_start ?? ''),
      stage: String(monthlyLogWithRelations.stage ?? 'charges'),
      status: normalizeStatus(monthlyLogWithRelations.status),
      notes: monthlyLogWithRelations.notes ?? null,
      property_id: monthlyLogWithRelations.property_id ?? null,
      unit_id: monthlyLogWithRelations.unit_id ?? null,
      tenant_id: monthlyLogWithRelations.tenant_id ?? null,
      org_id: monthlyLogWithRelations.org_id ?? null,
      lease_id: monthlyLogWithRelations.lease_id ?? null,
      properties: monthlyLogWithRelations.properties,
      units: monthlyLogWithRelations.units,
      tenants: monthlyLogWithRelations.tenants,
      managementServices: monthlyLogWithRelations.managementServices,
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
      ? activeLeaseContext.tenantOptions.map((option) => ({
          id: String(option.id ?? ''),
          name: option.name,
          buildiumTenantId: option.buildiumTenantId ?? null,
        }))
      : [];

    return (
      <Suspense fallback={<Body as="div" className="p-6">Loading monthly log details...</Body>}>
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
        <Heading as="h1" size="h4" className="text-red-600">
          Error Loading Monthly Log
        </Heading>
        <Body className="mt-2 text-gray-600">
          There was an error loading the monthly log details.
        </Body>
        <Body as="pre" size="sm" className="mt-4 overflow-auto rounded bg-gray-100 p-4">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Body>
      </div>
    );
  }
}

async function fetchMonthlyLogRecord(
  logId: string,
  supabase: TypedSupabaseClient,
): Promise<MonthlyLogRecord | null> {
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
      name,
      service_assignment
    ),
    units:units (
      id,
      unit_number,
      unit_name
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
      name,
      service_assignment
    ),
    units:units (
      id,
      unit_number,
      unit_name
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

  const runSelect = async (selectFields: string) => {
    const res = await supabase
      .from('monthly_logs')
      .select(selectFields)
      .eq('id', logId)
      .maybeSingle();
    return { data: (res.data as MonthlyLogRecord | null) ?? null, error: res.error };
  };

  const primaryResult = await traceAsync('monthlyLog.fetch.record', () =>
    runSelect(selectWithLeaseId),
  );

  const isMissingLeaseColumn = (err: unknown) => {
    const message = getErrorMessage(err).toLowerCase();
    return message.includes('lease_id') && message.includes('column');
  };

  const { data, error } =
    primaryResult.error && isMissingLeaseColumn(primaryResult.error)
      ? await traceAsync('monthlyLog.fetch.record.fallback', () => runSelect(baseSelect))
      : primaryResult;

  if (error) {
    console.error('[monthly-log] Failed to load log', {
      logId,
      error: getErrorMessage(error) || error,
    });
    throw error instanceof Error
      ? error
      : new Error('[monthly-log] Failed to load log record', { cause: error });
  }

  if (!data) {
    return null;
  }

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
    const { data } = await traceAsync('monthlyLog.activeLease.row', async () =>
      buildBaseQuery().eq('id', leaseId).limit(1).maybeSingle(),
    );
    leaseRow = (data as ActiveLeaseRow | null) ?? null;
  }

  if (!leaseRow) {
    const { data } = await traceAsync('monthlyLog.activeLease.row.fallback', async () =>
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

  const { data: chargeRows } = await traceAsync('monthlyLog.activeLease.chargeTotals', async () =>
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
    const tenantIdRaw = contact.tenant_id ?? contact.tenants?.id ?? null;
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

async function loadManagementServicesSummary(
  supabase: TypedSupabaseClient,
  params: {
    orgId: string | null;
    propertyId: string | null;
    unitId: string | null;
    serviceAssignment: string | null;
    rentAmount: number | null;
  },
): Promise<ManagementServicesSummary | null> {
  const { orgId, propertyId, unitId, serviceAssignment, rentAmount } = params;
  if (!orgId || !propertyId) return null;

  const wantsUnitLevel = serviceAssignment === 'Unit Level';

  const loadAssignment = async (
    scope: 'unit' | 'property',
  ): Promise<ServicePlanAssignmentRow | null> => {
    const query = supabase
      .from('service_plan_assignments')
      .select('id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency')
      .eq('org_id', orgId)
      .is('effective_end', null)
      .order('effective_start', { ascending: false })
      .limit(1);

    const scoped =
      scope === 'unit' && unitId
        ? query.eq('unit_id', unitId)
        : query.eq('property_id', propertyId).is('unit_id', null);

    const { data } = await scoped.maybeSingle();
    return (data as ServicePlanAssignmentRow | null) ?? null;
  };

  const [unitAssignment, propertyAssignment] = await Promise.all([
    unitId ? loadAssignment('unit') : Promise.resolve(null),
    loadAssignment('property'),
  ]);

  const assignment = wantsUnitLevel ? unitAssignment : propertyAssignment;
  const effectiveAssignment = assignment ?? unitAssignment ?? propertyAssignment;

  const assignmentId = effectiveAssignment?.id ? String(effectiveAssignment.id) : null;
  const planId = effectiveAssignment?.plan_id ? String(effectiveAssignment.plan_id) : null;

  let servicePlan: string | null = null;
  if (planId) {
    const { data: planRow } = await supabase
      .from('service_plans')
      .select('name')
      .eq('id', planId)
      .maybeSingle();
    servicePlan = planRow?.name ? String(planRow.name) : null;
  }

  const isALaCarte = (servicePlan || '').trim().toLowerCase() === 'a-la-carte';

  let activeServices: string[] = [];
  if (planId) {
    if (isALaCarte && assignmentId) {
      const { data: rows } = await supabase
        .from('service_offering_assignments')
        .select('offering_id, is_active')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });
      const assignmentRows: ServiceOfferingAssignmentRow[] = Array.isArray(rows)
        ? (rows as ServiceOfferingAssignmentRow[])
        : [];
      const offeringIds = assignmentRows
        .filter((row) => row.is_active !== false && row.offering_id != null)
        .map((row) => String(row.offering_id))
        .filter(Boolean);
      if (offeringIds.length) {
        const { data: offerings } = await supabase
          .from('service_offerings')
          .select('id, name')
          .in('id', offeringIds);
        const offeringRows: ServiceOfferingRow[] = Array.isArray(offerings)
          ? (offerings as ServiceOfferingRow[])
          : [];
        activeServices = offeringRows
          .map((offering) => (offering.name ? String(offering.name) : ''))
          .filter(Boolean);
      }
    } else {
      const { data: rows } = await supabase
        .from('service_plan_services')
        .select('offering_id')
        .eq('plan_id', planId);
      const servicePlanRows: ServicePlanServiceRow[] = Array.isArray(rows)
        ? (rows as ServicePlanServiceRow[])
        : [];
      const offeringIds = servicePlanRows
        .map((row) => String(row.offering_id ?? ''))
        .filter(Boolean);
      if (offeringIds.length) {
        const { data: offerings } = await supabase
          .from('service_offerings')
          .select('id, name')
          .in('id', offeringIds);
        const offeringRows: ServiceOfferingRow[] = Array.isArray(offerings)
          ? (offerings as ServiceOfferingRow[])
          : [];
        activeServices = offeringRows
          .map((offering) => (offering.name ? String(offering.name) : ''))
          .filter(Boolean);
      }
    }
  }

  const amountFlat =
    effectiveAssignment?.plan_fee_amount != null ? Number(effectiveAssignment.plan_fee_amount) : 0;
  const percent =
    effectiveAssignment?.plan_fee_percent != null ? Number(effectiveAssignment.plan_fee_percent) : 0;
  const billingFrequency = effectiveAssignment?.plan_fee_frequency
    ? String(effectiveAssignment.plan_fee_frequency)
    : null;

  const computedFromPercent =
    percent > 0 && rentAmount != null ? (percent * rentAmount) / 100 : null;
  const feeDollarAmount =
    amountFlat > 0 ? amountFlat : computedFromPercent != null ? computedFromPercent : null;
  const feeType = amountFlat > 0 ? 'Flat Rate' : percent > 0 ? 'Percentage' : null;
  const feePercentage = percent > 0 ? percent : null;

  return {
    servicePlan,
    activeServices,
    feeType,
    feeDollarAmount,
    feePercentage,
    billingFrequency,
  };
}

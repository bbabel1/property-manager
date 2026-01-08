import { supabase, supabaseAdmin } from '@/lib/db';
import type { LeaseAccountOption } from '@/components/leases/types';

type LeaseRow = {
  id: string | number;
  org_id: string | number | null;
  property_id: string | number | null;
  unit_id: string | number | null;
};

type PropertyRow = {
  id: string | number;
  name: string | null;
  address_line1: string | null;
};

type UnitRow = {
  id: string | number;
  unit_number: string | null;
  unit_name: string | null;
};

type LeaseTenantRow = {
  tenant_id: string | number | null;
  tenants?: {
    contacts?: {
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      company_name?: string | null;
    } | null;
  } | null;
};

export type ChargeFormPrefill = {
  leaseId: string;
  orgId: string | null;
  accountOptions: LeaseAccountOption[];
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  prefill?: {
    tenantId?: string | null;
    accountId?: string | null;
    amount?: number | null;
    memo?: string | null;
    date?: string | null;
  };
};

export type ChargeFormPrefillResult =
  | { ok: true; data: ChargeFormPrefill }
  | { ok: false; error: string };

const formatTenantNames = (rows: LeaseTenantRow[]): string | null => {
  const names: string[] = [];
  rows.forEach((row) => {
    const contact = row.tenants?.contacts;
    const display =
      contact?.display_name ||
      [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
      contact?.company_name ||
      null;
    if (display) names.push(display);
  });
  return names.length ? names.join(', ') : null;
};

const normalizeDate = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

export function sanitizeChargePrefillParams(
  params: Record<string, string | string[] | undefined>,
  allowed: { accountIds: Set<string>; tenantIds: Set<string> },
) {
  const pick = (key: string) => {
    const raw = params?.[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  const tenant = pick('tenant');
  const account = pick('account');
  const amountRaw = pick('amount');
  const memoRaw = pick('memo');
  const dateRaw = pick('date');

  const tenantId = tenant && allowed.tenantIds.has(String(tenant)) ? String(tenant) : null;
  const accountId = account && allowed.accountIds.has(String(account)) ? String(account) : null;

  const amountNum = typeof amountRaw === 'string' ? Number(amountRaw) : NaN;
  const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null;

  const memo =
    typeof memoRaw === 'string' && memoRaw.trim().length > 0 && memoRaw.trim().length <= 2000
      ? memoRaw.trim()
      : null;
  const date = normalizeDate(dateRaw);

  return { tenantId, accountId, amount, memo, date };
}

export async function loadChargeFormData(
  leaseIdInput: string | number,
  options?: { searchParams?: Record<string, string | string[] | undefined> },
): Promise<ChargeFormPrefillResult> {
  const leaseIdNum = Number(leaseIdInput);
  if (!Number.isFinite(leaseIdNum)) {
    return { ok: false, error: 'Invalid lease id' };
  }

  const db = supabaseAdmin || supabase;
  if (!db) {
    return { ok: false, error: 'Database unavailable' };
  }
  const dbClient = db as any;

  try {
    const { data: leaseRow, error: leaseError } = (await dbClient
      .from('lease')
      .select('id, org_id, property_id, unit_id')
      .eq('id', leaseIdNum)
      .maybeSingle()) as { data: LeaseRow | null; error: unknown };

    if (leaseError) throw leaseError;
    if (!leaseRow) {
      return { ok: false, error: 'Lease not found' };
    }

    const orgId = leaseRow.org_id ? String(leaseRow.org_id) : null;
    let propertyUnit: string | null = null;
    let tenantNames: string | null = null;

    const propertyPromise =
      leaseRow.property_id != null
        ? (dbClient
            .from('properties')
            .select('id, name, address_line1')
            .eq('id', leaseRow.property_id)
            .maybeSingle() as Promise<{ data: PropertyRow | null; error: unknown }>)
        : Promise.resolve({ data: null, error: null });

    const unitPromise =
      leaseRow.unit_id != null
        ? (dbClient
            .from('units')
            .select('id, unit_number, unit_name')
            .eq('id', leaseRow.unit_id)
            .maybeSingle() as Promise<{ data: UnitRow | null; error: unknown }>)
        : Promise.resolve({ data: null, error: null });

    const tenantsPromise = dbClient
      .from('lease_tenants')
      .select('tenant_id, tenants:tenants(contacts:contacts!tenants_contact_id_fkey(display_name, first_name, last_name, company_name))')
      .eq('lease_id', leaseRow.id)
      .limit(20);

    const [{ data: property }, { data: unit }, { data: tenants }] = await Promise.all([
      propertyPromise,
      unitPromise,
      tenantsPromise,
    ]);

    if (property || unit) {
      const propertyName = property?.name || property?.address_line1 || null;
      const unitLabel = unit?.unit_number || unit?.unit_name || null;
      propertyUnit = [propertyName, unitLabel].filter(Boolean).join(' - ') || propertyName || unitLabel || null;
    }

    const tenantList: LeaseTenantRow[] = Array.isArray(tenants) ? (tenants as LeaseTenantRow[]) : [];
    if (tenantList.length > 0) {
      tenantNames = formatTenantNames(tenantList);
    }

    const accountOptions: LeaseAccountOption[] = [];
    const tenantIds = new Set<string>();
    tenantList.forEach((row) => {
      const id = row?.tenant_id;
      if (id != null) tenantIds.add(String(id));
    });
    if (orgId) {
      const { data: accountsData, error: accountsError } = (await dbClient
        .from('gl_accounts')
        .select('id, name, type, buildium_gl_account_id')
        .eq('org_id', orgId)
        .order('name', { ascending: true })) as { data: any[] | null; error: unknown };
      if (accountsError) throw accountsError;

      (accountsData || []).forEach((row: any) => {
        if (!row?.id) return;
        const buildiumIdRaw = row.buildium_gl_account_id;
        const buildiumId =
          typeof buildiumIdRaw === 'number'
            ? buildiumIdRaw
            : buildiumIdRaw != null && !Number.isNaN(Number(buildiumIdRaw))
              ? Number(buildiumIdRaw)
              : null;
        if (buildiumId == null) return;
        accountOptions.push({
          id: String(row.id),
          name: row.name || 'Account',
          type: row.type || null,
          buildiumGlAccountId: buildiumId,
        });
      });
    }

    const prefill =
      options?.searchParams && accountOptions.length
        ? sanitizeChargePrefillParams(options.searchParams, {
            accountIds: new Set(accountOptions.map((a) => a.id)),
            tenantIds,
          })
        : undefined;

    const data: ChargeFormPrefill = {
      leaseId: String(leaseRow.id),
      orgId,
      accountOptions,
      leaseSummary: {
        propertyUnit,
        tenants: tenantNames,
      },
      prefill,
    };

    return { ok: true, data };
  } catch (error) {
    console.error('Failed to load charge form data', error);
    return { ok: false, error: 'Unable to load charge form data.' };
  }
}

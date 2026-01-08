import { getSupabaseServerClient } from '@/lib/supabase/server';

export type AddLeasePrefill = {
  propertyId?: string | null;
  unitId?: string | null;
  from?: string | null;
  to?: string | null;
  rent?: number | null;
  rentMemo?: string | null;
  rentCycle?: 'Monthly' | 'Weekly' | 'Biweekly' | 'Quarterly' | 'Annually';
  nextDueDate?: string | null;
  depositAmt?: number | null;
  depositDate?: string | null;
  depositMemo?: string | null;
  leaseCharges?: string | null;
};

export type AddLeaseFormData = {
  orgId: string | null;
  leaseSummary?: null;
  propertyOptions: Array<{ id: string; name: string }>;
  unitOptions: Array<{ id: string; unit_number: string | null }>;
  tenantOptions: Array<{ id: string; name: string }>;
  prefill?: AddLeasePrefill;
};

export type AddLeaseFormDataResult =
  | { ok: true; data: AddLeaseFormData }
  | { ok: false; error: string };

const normalizeDate = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const parseAmount = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.replace(/[^0-9.-]/g, '').trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const safeText = (value: string | null | undefined, max = 2000) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
};

const pickFirst = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

export function sanitizeAddLeasePrefillParams(
  params: Record<string, string | string[] | undefined>,
  allowed: { propertyIds: Set<string>; unitIds: Set<string>; tenantIds: Set<string> },
): AddLeasePrefill {
  const propertyIdRaw = pickFirst(params.propertyId ?? params.property);
  const unitIdRaw = pickFirst(params.unitId ?? params.unit);
  const fromRaw = pickFirst(params.from ?? params.start);
  const toRaw = pickFirst(params.to ?? params.end);
  const rentRaw = pickFirst(params.rent);
  const rentMemoRaw = pickFirst(params.rentMemo ?? params.memo);
  const depositAmtRaw = pickFirst(params.deposit ?? params.depositAmt);
  const depositMemoRaw = pickFirst(params.depositMemo);
  const nextDueRaw = pickFirst(params.nextDueDate ?? params.nextDue);
  const depositDateRaw = pickFirst(params.depositDate);
  const leaseChargesRaw = pickFirst(params.notes ?? params.leaseCharges);
  const rentCycleRaw = pickFirst(params.rentCycle);

  const propertyId =
    propertyIdRaw && allowed.propertyIds.has(String(propertyIdRaw)) ? String(propertyIdRaw) : null;
  const unitId = unitIdRaw && allowed.unitIds.has(String(unitIdRaw)) ? String(unitIdRaw) : null;

  const rentCycle =
    rentCycleRaw && ['monthly', 'weekly', 'biweekly', 'quarterly', 'annually'].includes(rentCycleRaw.toLowerCase())
      ? (rentCycleRaw[0].toUpperCase() + rentCycleRaw.slice(1).toLowerCase()) as
          | 'Monthly'
          | 'Weekly'
          | 'Biweekly'
          | 'Quarterly'
          | 'Annually'
      : undefined;

  return {
    propertyId,
    unitId,
    from: normalizeDate(fromRaw),
    to: normalizeDate(toRaw),
    rent: parseAmount(rentRaw),
    rentMemo: safeText(rentMemoRaw, 200),
    rentCycle,
    nextDueDate: normalizeDate(nextDueRaw),
    depositAmt: parseAmount(depositAmtRaw),
    depositDate: normalizeDate(depositDateRaw),
    depositMemo: safeText(depositMemoRaw, 200),
    leaseCharges: safeText(leaseChargesRaw),
  };
}

export async function loadAddLeaseFormData(options?: {
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<AddLeaseFormDataResult> {
  try {
    const supabase = await getSupabaseServerClient();
    const sp = options?.searchParams;
    const unitIdParam = sp ? pickFirst(sp.unitId ?? sp.unit) : null;

    const [{ data: propertiesData, error: propertiesError }, { data: tenantsData }] =
      await Promise.all([
        supabase
          .from('properties')
          .select('id, name, status, org_id')
          .not('status', 'eq', 'Inactive')
          .order('name', { ascending: true })
          .limit(500),
        supabase
          .from('tenants')
          .select('id, contacts:contacts!tenants_contact_id_fkey(display_name, first_name, last_name, company_name)')
          .order('id', { ascending: true })
          .limit(200),
      ]);

    if (propertiesError) {
      console.error('loadAddLeaseFormData: properties error', propertiesError);
      return { ok: false, error: 'Unable to load properties.' };
    }

    const propertyOptions =
      propertiesData
        ?.filter((row) => row && (row as { status?: string | null }).status !== 'Inactive')
        .map((row) => ({
          id: String((row as { id: string | number }).id),
          name: ((row as { name?: string | null }).name ?? 'Property') as string,
          orgId:
            (row as { org_id?: string | number | null }).org_id != null
              ? String((row as { org_id?: string | number | null }).org_id)
              : null,
        })) ?? [];

    const allowedPropertyIds = new Set(propertyOptions.map((p) => p.id));

    let preselectedPropertyId: string | null = null;
    if (sp) {
      const tentativeProperty = pickFirst(sp.propertyId ?? sp.property);
      if (tentativeProperty && allowedPropertyIds.has(String(tentativeProperty))) {
        preselectedPropertyId = String(tentativeProperty);
      }
    }

    let unitOptions: Array<{ id: string; unit_number: string | null }> = [];
    if (preselectedPropertyId) {
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, status')
        .eq('property_id', preselectedPropertyId)
        .not('status', 'eq', 'Inactive')
        .order('unit_number', { ascending: true });
      if (unitsError) {
        console.error('loadAddLeaseFormData: units error', unitsError);
      } else {
        unitOptions =
          unitsData?.map((row) => ({
            id: String((row as { id: string | number }).id),
            unit_number: (row as { unit_number?: string | null }).unit_number ?? null,
          })) ?? [];
      }
    }

    // If a unit was provided in the URL but wasn't returned in the property-prefetch query,
    // fetch it directly to allow preselecting the unit dropdown.
    if (
      preselectedPropertyId &&
      unitIdParam &&
      !unitOptions.some((u) => u.id === String(unitIdParam))
    ) {
      const { data: unitRow, error: unitLookupError } = await supabase
        .from('units')
        .select('id, unit_number, property_id, status')
        .eq('id', unitIdParam)
        .maybeSingle();

      if (unitLookupError) {
        console.error('loadAddLeaseFormData: unit prefill lookup error', unitLookupError);
      } else if (
        unitRow &&
        String((unitRow as { property_id?: string | number | null }).property_id ?? '') ===
          preselectedPropertyId &&
        String((unitRow as { status?: string | null }).status ?? '').toLowerCase() !== 'inactive'
      ) {
        unitOptions.push({
          id: String((unitRow as { id: string | number }).id),
          unit_number: (unitRow as { unit_number?: string | null }).unit_number ?? null,
        });
      }
    }

    const allowedUnitIds = new Set(unitOptions.map((u) => u.id));

    const tenantOptions =
      tenantsData?.map((row) => {
        const contact = (row as any)?.contacts ?? {};
        const display =
          contact?.display_name ||
          [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
          contact?.company_name ||
          'Tenant';
        return { id: String((row as { id: string | number }).id), name: display };
      }) ?? [];
    const allowedTenantIds = new Set(tenantOptions.map((t) => t.id));

    const prefill =
      sp && allowedPropertyIds.size
        ? sanitizeAddLeasePrefillParams(sp, {
            propertyIds: allowedPropertyIds,
            unitIds: allowedUnitIds,
            tenantIds: allowedTenantIds,
          })
        : undefined;

    const orgIdCandidates = new Set(
      propertyOptions
        .map((p) => p.orgId)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    );

    return {
      ok: true,
      data: {
        orgId: orgIdCandidates.size === 1 ? Array.from(orgIdCandidates)[0] : null,
        leaseSummary: null,
        propertyOptions: propertyOptions.map(({ id, name }) => ({ id, name })),
        unitOptions,
        tenantOptions,
        prefill,
      },
    };
  } catch (error) {
    console.error('loadAddLeaseFormData: unexpected error', error);
    return { ok: false, error: 'Unable to load add lease form data.' };
  }
}

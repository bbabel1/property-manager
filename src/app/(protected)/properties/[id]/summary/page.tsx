import { PageColumns, Stack } from '@/components/layout/page-shell';
import PropertyBankingAndServicesCard from '@/components/property/PropertyBankingAndServicesCard';
import PropertyDetailsCard from '@/components/property/PropertyDetailsCard';
import LocationCard from '@/components/property/LocationCard';
import PropertyRecentFilesSection from '@/components/property/PropertyRecentFilesSection';
import PropertyRecentNotesSection from '@/components/property/PropertyRecentNotesSection';
import BuildiumReadinessChecklist from '@/components/onboarding/BuildiumReadinessChecklist';
import BuildiumReadinessChecklist from '@/components/onboarding/BuildiumReadinessChecklist';
import BuildiumReadinessChecklist from '@/components/onboarding/BuildiumReadinessChecklist';
import { supabaseAdmin } from '@/lib/db';
import { PropertyService } from '@/lib/property-service';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import { logger } from '@/lib/logger';
import { fetchPropertyFinancials } from '@/server/financials/property-finance';
import type { Database } from '@/types/database';
import type { PostgrestError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers';

type PropertyDetails = Parameters<typeof PropertyDetailsCard>[0]['property'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyOwner = {
  id: string | null;
  owner_id: string | null;
  contact_id: number | null;
  display_name?: string | null;
  primary_email?: string | null;
  ownership_percentage?: number | null;
  disbursement_percentage?: number | null;
  primary?: boolean | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};
type UnitsSummary = { total: number; occupied: number; available: number };
type AccountSummary = { id: string; name: string; last4: string | null };
type PropertySummary = PropertyRow & {
  owners: PropertyOwner[];
  total_owners: number;
  primary_owner_name: string | null;
  units_summary: UnitsSummary;
  occupancy_rate: number | null;
  operating_account: AccountSummary | null;
  deposit_trust_account: AccountSummary | null;
  property_manager_name?: string | null;
  property_manager_email?: string | null;
  property_manager_phone?: string | null;
  primary_image_url?: string | null;
};
type PropertySummaryRpcResult = {
  property?: PropertyRow | null;
  owners?: PropertyOwner[] | null;
  owner_count?: number | null;
  primary_owner_name?: string | null;
  units_summary?:
    | {
        total?: number | null;
        occupied?: number | null;
        available?: number | null;
      }
    | null;
  occupancy_rate?: number | null;
  property_manager_name?: string | null;
  property_manager_email?: string | null;
  property_manager_phone?: string | null;
  operating_account?: AccountSummary | null;
  deposit_trust_account?: AccountSummary | null;
};

const normalizeOwner = (owner: unknown): PropertyOwner => {
  const value = (owner ?? {}) as Record<string, unknown>;
  const idCandidate =
    value.owner_id ??
    value.id ??
    (typeof value.owner_id === 'number' ? value.owner_id : null) ??
    null;
  const toStringOrNull = (input: unknown): string | null => {
    if (input == null) return null;
    if (typeof input === 'string' || typeof input === 'number') return String(input);
    return null;
  };
  return {
    id: toStringOrNull(value.id ?? idCandidate),
    owner_id: toStringOrNull(value.owner_id ?? idCandidate),
    contact_id: typeof value.contact_id === 'number' ? value.contact_id : null,
    display_name: typeof value.display_name === 'string' ? value.display_name : null,
    primary_email: typeof value.primary_email === 'string' ? value.primary_email : null,
    ownership_percentage:
      typeof value.ownership_percentage === 'number' ? value.ownership_percentage : null,
    disbursement_percentage:
      typeof value.disbursement_percentage === 'number' ? value.disbursement_percentage : null,
    primary:
      typeof value.primary === 'boolean'
        ? value.primary
        : typeof value.primary === 'number'
          ? Boolean(value.primary)
          : null,
    company_name: typeof value.company_name === 'string' ? value.company_name : null,
    first_name: typeof value.first_name === 'string' ? value.first_name : null,
    last_name: typeof value.last_name === 'string' ? value.last_name : null,
  };
};

const normalizeAccount = (account: unknown): AccountSummary | null => {
  if (!account || typeof account !== 'object') return null;
  const value = account as { id?: unknown; name?: unknown; last4?: unknown };
  const id =
    typeof value.id === 'string' || typeof value.id === 'number' ? String(value.id) : null;
  if (!id) return null;
  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Bank account',
    last4:
      typeof value.last4 === 'string'
        ? value.last4
        : typeof value.last4 === 'number'
          ? String(value.last4).slice(-4)
          : null,
  };
};

const normalizeUnitsSummary = (
  units: PropertySummaryRpcResult['units_summary'],
  property: Partial<PropertyRow>,
): UnitsSummary => {
  const rawTotal = units?.total ?? property.total_active_units ?? property.total_units ?? 0;
  const rawOccupied = units?.occupied ?? property.total_occupied_units ?? 0;
  const rawAvailable =
    units?.available ??
    property.total_vacant_units ??
    Math.max((Number(rawTotal) || 0) - (Number(rawOccupied) || 0), 0);

  const toCount = (value: unknown): number => {
    const num = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  return {
    total: toCount(rawTotal),
    occupied: toCount(rawOccupied),
    available: toCount(rawAvailable),
  };
};

const normalizePropertySummary = (input: unknown): PropertySummary | null => {
  if (!input || typeof input !== 'object') return null;
  const source = input as PropertySummaryRpcResult & Partial<PropertySummary>;
  const baseProperty = (source.property as PropertyRow | null | undefined) ?? (source as PropertyRow);
  if (!baseProperty || !('id' in baseProperty)) return null;
  const id = (baseProperty as { id?: unknown }).id;
  if (typeof id !== 'string' && typeof id !== 'number') return null;

  const allowedStatus: PropertyRow['status'][] = ['Active', 'Inactive'];
  const statusCandidate = (baseProperty as { status?: string | null })?.status ?? null;
  const normalizedStatus: PropertyRow['status'] = allowedStatus.includes(
    statusCandidate as PropertyRow['status'],
  )
    ? (statusCandidate as PropertyRow['status'])
    : 'Active';

  const allowedPropertyTypes: PropertyRow['property_type'][] = [
    'Condo',
    'Co-op',
    'Condop',
    'Rental Building',
    'Townhouse',
    'Mult-Family',
  ];
  const propertyTypeCandidate = (baseProperty as { property_type?: string | null })?.property_type ?? null;
  const normalizedPropertyType = allowedPropertyTypes.includes(
    propertyTypeCandidate as PropertyRow['property_type'],
  )
    ? (propertyTypeCandidate as PropertyRow['property_type'])
    : null;

  const postal = (baseProperty as { postal_code?: string | null })?.postal_code;

  const propertyRow: PropertyRow = {
    ...(baseProperty as PropertyRow),
    id: String(id),
    name:
      typeof (baseProperty as { name?: unknown }).name === 'string'
        ? (baseProperty as { name: string }).name
        : 'Property',
    address_line1: (baseProperty as { address_line1?: string | null })?.address_line1 ?? '',
    address_line2: (baseProperty as { address_line2?: string | null })?.address_line2 ?? null,
    address_line3: (baseProperty as { address_line3?: string | null })?.address_line3 ?? null,
    city: (baseProperty as { city?: string | null })?.city ?? null,
    state: (baseProperty as { state?: string | null })?.state ?? null,
    postal_code: typeof postal === 'string' ? postal : '',
    country: (baseProperty as { country?: PropertyRow['country'] | null })?.country ?? 'United States',
    status: normalizedStatus,
    property_type: normalizedPropertyType,
    reserve: (baseProperty as { reserve?: number | null })?.reserve ?? null,
    year_built: (baseProperty as { year_built?: number | null })?.year_built ?? null,
  };

  const owners =
    Array.isArray(source.owners) && source.owners.length
      ? source.owners.map((owner) => normalizeOwner(owner))
      : [];

  return {
    ...propertyRow,
    owners,
    total_owners:
      typeof source.owner_count === 'number' && Number.isFinite(source.owner_count)
        ? source.owner_count
        : owners.length,
    primary_owner_name: source.primary_owner_name ?? propertyRow.primary_owner ?? null,
    units_summary: normalizeUnitsSummary(source.units_summary ?? null, propertyRow),
    occupancy_rate:
      typeof source.occupancy_rate === 'number'
        ? source.occupancy_rate
        : typeof propertyRow.occupancy_rate === 'number'
          ? propertyRow.occupancy_rate
          : null,
    operating_account: normalizeAccount(source.operating_account ?? null),
    deposit_trust_account: normalizeAccount(source.deposit_trust_account ?? null),
    property_manager_name: source.property_manager_name ?? null,
    property_manager_email: source.property_manager_email ?? null,
    property_manager_phone: source.property_manager_phone ?? null,
    primary_image_url: (source as { primary_image_url?: string | null }).primary_image_url ?? null,
  };
};

export default async function SummaryTab({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;
  const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
  const rpcClient = supabaseAdmin as unknown as SupabaseClient<Database> & {
    rpc: (
      fn: 'get_property_summary',
      args: { p_property_id: string },
    ) => Promise<{ data: PropertySummaryRpcResult | null; error: PostgrestError | null }>;
  };
  // Prefer direct service call in RSC to avoid internal HTTP hop.
  // Fetch property details and financials in parallel for faster TTFB.
  // Use UTC date to avoid timezone issues - get today's date in UTC
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const propertyPromise: Promise<PropertySummary | null> = Promise.resolve(
    rpcClient
      .rpc('get_property_summary', { p_property_id: propertyId })
      .then(({ data, error }: { data: PropertySummaryRpcResult | null; error: PostgrestError | null }) => {
        if (error || !data) {
          logger.warn({ error, propertyId }, 'get_property_summary failed, falling back');
          return null;
        }
        const parsed = normalizePropertySummary(data);
        if (!parsed) {
          logger.warn({ propertyId }, 'get_property_summary returned empty payload');
        }
        return parsed;
      }),
  );
  const finPromise = supabaseAdmin
    .rpc('get_property_financials', {
      p_property_id: propertyId,
      p_as_of: today,
    })
    .then(({ data, error }: { data: unknown; error: PostgrestError | null }) => {
      if (error) {
        logger.error({ error, propertyId, asOf: today }, 'Financials RPC error');
        return null;
      }
      return data;
    });

  const [initialProperty, finRaw] = await Promise.all([
    propertyPromise as Promise<PropertySummary | null>,
    finPromise,
  ]);
  let property: PropertySummary | null = initialProperty;

  // Fallback: if property still unavailable (e.g., env misconfig), try internal API with revalidation
  if (!property) {
    try {
      const hdrs = await nextHeaders();
      const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
      const proto = hdrs.get('x-forwarded-proto') ?? 'http';
      const cookieStore = await nextCookies();
      const cookieHeader = cookieStore
        .getAll()
        .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
        .join('; ');
      const url = `${proto}://${host}/api/properties/${propertyId}/details`;
      const res = await fetch(url, {
        headers: { cookie: cookieHeader },
        next: { revalidate: 60, tags: [`property-details:${propertyId}`] },
      });
      if (res.ok) property = normalizePropertySummary(await res.json());
    } catch {}
  }

  // If owners are missing due to RLS or join limitations in the details API, fall back to service
  if (property && (!Array.isArray(property.owners) || property.owners.length === 0)) {
    const svc = await PropertyService.getPropertyById(propertyId);
    const normalizedService = normalizePropertySummary(svc);
    if (
      normalizedService &&
      Array.isArray(normalizedService.owners) &&
      normalizedService.owners.length > 0
    ) {
      property.owners = normalizedService.owners;
      property.total_owners = normalizedService.total_owners;
      if (!property.primary_owner_name && normalizedService.primary_owner_name)
        property.primary_owner_name = normalizedService.primary_owner_name;
    }
  }
  // Always use the shared helper (rollup) to avoid stale cached RPC values
  let fin =
    finRaw && typeof finRaw === 'object' && !Array.isArray(finRaw)
      ? (finRaw as {
          cash_balance?: number;
          security_deposits?: number;
          reserve?: number;
          available_balance?: number;
          as_of?: string;
        })
      : null;

  if (property) {
    const { fin: derivedFin } = await fetchPropertyFinancials(propertyId, today, supabaseAdmin);
    fin = derivedFin;
  }

  // Banking reconciliation details intentionally omitted here; reconciliation lives on bank accounts.

  if (!property) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground text-center">
          Unable to load property details. You may not have access or the property does not exist.
        </div>
      </div>
    );
  }

  const ownersForDetails: PropertyDetails['owners'] = Array.isArray(property.owners)
    ? property.owners.map((owner) => ({
        ...owner,
        id:
          owner.owner_id != null
            ? String(owner.owner_id)
            : owner.id != null
              ? String(owner.id)
              : undefined,
        owner_id:
          owner.owner_id != null
            ? String(owner.owner_id)
            : owner.id != null
              ? String(owner.id)
              : undefined,
        display_name: owner.display_name ?? undefined,
        company_name: owner.company_name ?? undefined,
        first_name: owner.first_name ?? undefined,
        last_name: owner.last_name ?? undefined,
        ownership_percentage: owner.ownership_percentage ?? undefined,
        disbursement_percentage: owner.disbursement_percentage ?? undefined,
        primary: owner.primary ?? undefined,
      }))
    : [];

  const propertyForDetails: PropertyDetails = {
    id: String(property.id),
    name: typeof property.name === 'string' && property.name.length > 0 ? property.name : 'Property',
    address_line1: property.address_line1 ?? undefined,
    address_line2: property.address_line2 ?? undefined,
    city: property.city ?? undefined,
    state: property.state ?? undefined,
    postal_code: property.postal_code ?? undefined,
    country: property.country ?? undefined,
    status: property.status ?? undefined,
    property_type: property.property_type ?? undefined,
    reserve: property.reserve ?? undefined,
    year_built: property.year_built ?? undefined,
    property_manager_name:
      (property as { property_manager_name?: string | null })?.property_manager_name ?? undefined,
    buildium_property_id:
      property && 'buildium_property_id' in property && property.buildium_property_id != null
        ? String((property as { buildium_property_id?: string | number | null }).buildium_property_id)
        : undefined,
    primary_image_url: property.primary_image_url ?? undefined,
    owners: ownersForDetails,
  };

  return (
    <PageColumns
      primary={
        <Stack gap="lg">
          <PropertyDetailsCard property={propertyForDetails} />
          <LocationCard property={property} />
          <PropertyRecentNotesSection propertyId={property.id} />
          <PropertyRecentFilesSection
            propertyId={property.id}
            buildiumPropertyId={property.buildium_property_id ?? null}
            orgId={property.org_id ?? null}
          />
          <BuildiumReadinessChecklist propertyId={property.id} />
        </Stack>
      }
      secondary={
        <Stack gap="lg">
          <PropertyBankingAndServicesCard
            property={property}
            fin={fin ?? undefined}
            showServices={false}
          />
        </Stack>
      }
    />
  );
}

import { PageColumns, Stack } from '@/components/layout/page-shell';
import PropertyBankingAndServicesCard from '@/components/property/PropertyBankingAndServicesCard';
import PropertyDetailsCard from '@/components/property/PropertyDetailsCard';
import LocationCard from '@/components/property/LocationCard';
import PropertyRecentFilesSection from '@/components/property/PropertyRecentFilesSection';
import PropertyRecentNotesSection from '@/components/property/PropertyRecentNotesSection';
import { supabaseAdmin } from '@/lib/db';
import { PropertyService } from '@/lib/property-service';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import { logger } from '@/lib/logger';
import { fetchPropertyFinancials } from '@/server/financials/property-finance';
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers';

type PropertyDetails = Parameters<typeof PropertyDetailsCard>[0]['property'];

export default async function SummaryTab({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;
  const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
  // Prefer direct service call in RSC to avoid internal HTTP hop.
  // Fetch property details and financials in parallel for faster TTFB.
  // Use UTC date to avoid timezone issues - get today's date in UTC
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const propertyPromise = PropertyService.getPropertyById(propertyId);
  const finPromise = supabaseAdmin
    .rpc('get_property_financials', {
      p_property_id: propertyId,
      p_as_of: today,
    })
    .then(({ data, error }) => {
      if (error) {
        logger.error({ error, propertyId, asOf: today }, 'Financials RPC error');
        return null;
      }
      return data;
    });

  const [initialProperty, finRaw] = await Promise.all([propertyPromise, finPromise]);
  let property = initialProperty;

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
      if (res.ok) property = await res.json();
    } catch {}
  }

  // If owners are missing due to RLS or join limitations in the details API, fall back to service
  if (property && (!Array.isArray(property.owners) || property.owners.length === 0)) {
    const svc = await PropertyService.getPropertyById(propertyId);
    if (svc && Array.isArray(svc.owners) && svc.owners.length > 0) {
      property.owners = svc.owners as typeof property.owners;
      property.total_owners = svc.total_owners;
      if (!property.primary_owner_name && svc.primary_owner_name)
        property.primary_owner_name = svc.primary_owner_name;
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
            orgId={
              property && typeof property === 'object' && 'org_id' in property
                ? (property as { org_id?: string | null }).org_id ?? null
                : null
            }
          />
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

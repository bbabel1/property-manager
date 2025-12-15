import { PageColumns, Stack } from '@/components/layout/page-shell';
import PropertyBankingAndServicesCard from '@/components/property/PropertyBankingAndServicesCard';
import PropertyDetailsCard from '@/components/property/PropertyDetailsCard';
import LocationCard from '@/components/property/LocationCard';
import PropertyRecentFilesSection from '@/components/property/PropertyRecentFilesSection';
import PropertyRecentNotesSection from '@/components/property/PropertyRecentNotesSection';
import { supabaseAdmin } from '@/lib/db';
import { PropertyService } from '@/lib/property-service';
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers';

export default async function SummaryTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Prefer direct service call in RSC to avoid internal HTTP hop.
  // Fetch property details and financials in parallel for faster TTFB.
  const today = new Date().toISOString().slice(0, 10);
  const propertyPromise = PropertyService.getPropertyById(id);
  const finPromise = supabaseAdmin
    .rpc('get_property_financials', {
      p_property_id: id,
      p_as_of: today,
    })
    .then(({ data, error }) => {
      if (error) {
        console.error('Financials RPC error:', error.message);
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
      const url = `${proto}://${host}/api/properties/${id}/details`;
      const res = await fetch(url, {
        headers: { cookie: cookieHeader },
        next: { revalidate: 60, tags: [`property-details:${id}`] },
      });
      if (res.ok) property = await res.json();
    } catch {}
  }

  // If owners are missing due to RLS or join limitations in the details API, fall back to service
  if (property && (!Array.isArray(property.owners) || property.owners.length === 0)) {
    const svc = await PropertyService.getPropertyById(id);
    if (svc && Array.isArray(svc.owners) && svc.owners.length > 0) {
      property.owners = svc.owners;
      property.total_owners = svc.total_owners;
      if (!property.primary_owner_name && svc.primary_owner_name)
        property.primary_owner_name = svc.primary_owner_name;
    }
  }
  // If financials missing, tolerate and continue (renders with 0s)

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

  return (
    <PageColumns
      primary={
        <Stack gap="lg">
          <PropertyDetailsCard property={property as any} />
          <LocationCard property={property} />
          <PropertyRecentNotesSection propertyId={property.id} />
          <PropertyRecentFilesSection
            propertyId={property.id}
            buildiumPropertyId={property.buildium_property_id ?? null}
            orgId={(property as any).org_id ?? null}
          />
        </Stack>
      }
      secondary={
        <Stack gap="lg">
          <PropertyBankingAndServicesCard
            property={property}
            fin={
              finRaw && typeof finRaw === 'object' && !Array.isArray(finRaw)
                ? (finRaw as {
                    cash_balance?: number;
                    security_deposits?: number;
                    reserve?: number;
                    available_balance?: number;
                    as_of?: string;
                  })
                : undefined
            }
          />
        </Stack>
      }
    />
  );
}

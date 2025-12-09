import { PageBody, PageShell, Stack } from '@/components/layout/page-shell';
import { PropertyService } from '@/lib/property-service';
import PropertyServicesTab from '@/components/property/PropertyServicesTab';

export default async function PropertyServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await PropertyService.getPropertyById(id);

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
    <PageBody>
      <Stack gap="lg">
        <PropertyServicesTab propertyId={id} property={property as any} />
      </Stack>
    </PageBody>
  );
}

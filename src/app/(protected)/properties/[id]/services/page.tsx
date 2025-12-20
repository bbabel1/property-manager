import { PropertyService } from '@/lib/property-service';
import PropertyServicesPageContent from '@/components/property/PropertyServicesPageContent';

export default async function PropertyServicesPage({ params }: { params: Promise<{ id: string }> }) {
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
    <div className="space-y-6">
      <PropertyServicesPageContent
        propertyId={property.id}
        initialServiceAssignment={property.service_assignment ?? null}
      />
    </div>
  );
}

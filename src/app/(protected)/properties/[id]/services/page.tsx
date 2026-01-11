import { PropertyService } from '@/lib/property-service';
import PropertyServicesPageContent from '@/components/property/PropertyServicesPageContent';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import { ErrorState } from '@/components/ui/state';

export default async function PropertyServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;
  const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
  let property = null;
  try {
    property = await PropertyService.getPropertyById(propertyId);
  } catch (error) {
    return (
      <div className="p-6">
        <ErrorState
          title="Unable to load property services"
          description="We couldn't fetch this property's service assignment. Please try again."
        />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-6">
        <ErrorState
          title="Property not found"
          description="You may not have access or the property does not exist."
        />
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

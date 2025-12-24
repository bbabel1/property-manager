import { PageBody, Stack } from '@/components/layout/page-shell';
import { PropertyService } from '@/lib/property-service';
import ServiceBillingEvents from '@/components/financials/ServiceBillingEvents';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';

export default async function PropertyServiceBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;
  const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
  const property = await PropertyService.getPropertyById(propertyId);

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
        <div>
          <h2 className="text-2xl font-bold text-foreground">Service Billing Events</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            View all service fee billing events and transactions for {property.name || 'this property'}
          </p>
        </div>
        <ServiceBillingEvents propertyId={propertyId} />
      </Stack>
    </PageBody>
  );
}

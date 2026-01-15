import { PageBody, Stack } from '@/components/layout/page-shell';
import { PropertyService } from '@/lib/property-service';
import ServiceBillingEvents from '@/components/financials/ServiceBillingEvents';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import { Body, Heading } from '@/ui/typography';

export default async function PropertyServiceBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;
  const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
  const property = await PropertyService.getPropertyById(propertyId);

  if (!property) {
    return (
      <div className="p-6">
        <Body tone="muted" className="text-center">
          Unable to load property details. You may not have access or the property does not exist.
        </Body>
      </div>
    );
  }

  return (
    <PageBody>
      <Stack gap="lg">
        <div>
          <Heading as="h2" size="h3">
            Service Billing Events
          </Heading>
          <Body tone="muted" size="sm" className="mt-1">
            View all service fee billing events and transactions for {property.name || 'this property'}
          </Body>
        </div>
        <ServiceBillingEvents propertyId={propertyId} />
      </Stack>
    </PageBody>
  );
}

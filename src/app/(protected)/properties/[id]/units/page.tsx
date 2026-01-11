import { PropertyService } from '@/lib/property-service'
import { Building2 } from 'lucide-react'
import UnitsTable from '@/components/property/UnitsTable'
import { resolvePropertyIdentifier } from '@/lib/public-id-utils'
import { EmptyState, ErrorState } from '@/components/ui/state'

export default async function UnitsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params
  const { internalId: propertyId } = await resolvePropertyIdentifier(slug)
  let property = null
  try {
    property = await PropertyService.getPropertyById(propertyId)
  } catch (error) {
    return (
      <div id="panel-units" role="tabpanel" aria-labelledby="units">
        <ErrorState
          title="Unable to load units"
          description="We couldn't fetch this property's units. Please try again."
        />
      </div>
    )
  }

  if (!property || !Array.isArray(property.units)) {
    return (
      <div id="panel-units" role="tabpanel" aria-labelledby="units">
        <EmptyState
          title="No units found"
          description="Add units to this property to start managing rentals and leases."
          icon={<Building2 className="h-16 w-16 text-muted-foreground" aria-hidden="true" />}
        />
      </div>
    )
  }

  return (
    <div id="panel-units" role="tabpanel" aria-labelledby="units">
      <UnitsTable propertyId={propertyId} property={property} initialUnits={property.units} />
    </div>
  )
}

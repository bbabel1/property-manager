import { PropertyService } from '@/lib/property-service'
import { Building2 } from 'lucide-react'
import UnitsTable from '@/components/property/UnitsTable'
import { resolvePropertyIdentifier } from '@/lib/public-id-utils'

export default async function UnitsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params
  const { internalId: propertyId } = await resolvePropertyIdentifier(slug)
  const property = await PropertyService.getPropertyById(propertyId)

  if (!property || !Array.isArray(property.units)) {
    return (
      <div id="panel-units" role="tabpanel" aria-labelledby="units">
        <div className="text-center py-12 border border-dashed border-border rounded-md">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No units found</h3>
          <p className="text-muted-foreground">Add units to this property to start managing rentals and leases.</p>
        </div>
      </div>
    )
  }

  return (
    <div id="panel-units" role="tabpanel" aria-labelledby="units">
      <UnitsTable propertyId={propertyId} property={property} initialUnits={property.units} />
    </div>
  )
}

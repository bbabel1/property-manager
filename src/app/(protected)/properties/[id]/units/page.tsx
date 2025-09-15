import { PropertyService } from '@/lib/property-service'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Building2 } from 'lucide-react'
import UnitsTable from '@/components/property/UnitsTable'

export default async function UnitsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const property = await PropertyService.getPropertyById(id)

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
      <UnitsTable propertyId={id} property={property} initialUnits={property.units as any} />
    </div>
  )
}

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PropertyRecentFilesSection from '@/components/property/PropertyRecentFilesSection'
import { PropertyService } from '@/lib/property-service'

type Props = {
  params: { id: string }
}

export default async function FilesTab({ params }: Props) {
  const propertyId = params.id
  const property = await PropertyService.getPropertyById(propertyId)
  const href = `/files?entityType=property&entityId=${propertyId}`
  const buildiumPropertyId = property?.buildium_property_id ?? null
  const orgId = (property as any)?.org_id ?? null

  return (
    <div id="panel-files" role="tabpanel" aria-labelledby="files" className="space-y-4">
      <PropertyRecentFilesSection
        propertyId={propertyId}
        buildiumPropertyId={buildiumPropertyId}
        orgId={orgId}
      />
      <Card>
        <CardHeader>
          <CardTitle>Manage property files</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-muted-foreground text-sm">
            View and upload documents for this property in the Files workspace. Filters will be
            pre-applied for this property.
          </p>
          <Button asChild>
            <Link href={href}>Open Files</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

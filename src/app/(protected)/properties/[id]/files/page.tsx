import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PropertyRecentFilesSection from '@/components/property/PropertyRecentFilesSection'
import { PropertyService } from '@/lib/property-service'
import { resolvePropertyIdentifier } from '@/lib/public-id-utils'

type Props = {
  params: Promise<{ id: string }>
}

export default async function FilesTab({ params }: Props) {
  const { id } = await params
  const { internalId: propertyId, publicId: propertyPublicId } = await resolvePropertyIdentifier(id)
  const property = await PropertyService.getPropertyById(propertyId)
  const href = `/files?entityType=property&entityId=${propertyPublicId}`
  const buildiumPropertyId = property?.buildium_property_id ?? null
  const orgId = (property && typeof property === 'object' && 'org_id' in property
    ? (property as { org_id?: string | null }).org_id ?? null
    : null)

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

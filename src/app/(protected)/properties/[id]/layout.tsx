import PageHeader from '@/components/layout/PageHeader'
import { PropertyService } from '@/lib/property-service'
import { notFound } from 'next/navigation'

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const property = await PropertyService.getPropertyById(id)
  return (
    <div className="space-y-2">
      {/* Header + Tabs */}
      <PageHeader property={{ id, name: property?.name || 'Property', status: property?.status || null, property_type: (property as any)?.property_type || null }} />
      {/* Tab content */}
      <div className="px-6 pb-8">{children}</div>
    </div>
  )
}

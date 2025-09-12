import PageHeader from '@/components/layout/PageHeader'
import { PropertyService } from '@/lib/property-service'
import { notFound } from 'next/navigation'

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const property = await PropertyService.getPropertyById(params.id)
  if (!property) return notFound()
  return (
    <div className="space-y-2">
      {/* Header + Tabs */}
      <PageHeader property={{ id: property.id, name: property.name, status: property.status, property_type: (property as any).property_type }} />
      {/* Tab content */}
      <div className="px-6 pb-8">{children}</div>
    </div>
  )
}


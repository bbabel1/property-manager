import PageHeader from '@/components/layout/PageHeader'
import { getPropertyShellCached } from '@/lib/property-service'
import { notFound } from 'next/navigation'

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const shell = await getPropertyShellCached(id)
  return (
    <div className="space-y-2">
      {/* Header + Tabs */}
      <PageHeader property={{ id, name: shell?.name || 'Property', status: shell?.status || null, property_type: (shell as any)?.property_type || null }} />
      {/* Tab content */}
      <div className="px-6 pb-8">{children}</div>
    </div>
  )
}

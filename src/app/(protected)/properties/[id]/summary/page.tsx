import InfoCard from '@/components/layout/InfoCard'
import MetaStat from '@/components/layout/MetaStat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Edit } from 'lucide-react'
import { PropertyService } from '@/lib/property-service'
import PropertyNotes from '@/property/PropertyNotes'
import Link from 'next/link'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'
import PropertyDetailsCard from '@/components/property/PropertyDetailsCard'
import LocationCard from '@/components/property/LocationCard'
import ManagementServicesCard from '@/components/property/ManagementServicesCard'
import BankingDetailsCard from '@/components/property/BankingDetailsCard'

export default async function SummaryTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Try internal API first to bypass any RLS and ensure data presence.
  // Falls back to service if API not available.
  let property: any = null
  try {
    const hdrs = await nextHeaders()
    const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
    const proto = hdrs.get('x-forwarded-proto') ?? 'http'
    const cookieStore = await nextCookies()
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
    const url = `${proto}://${host}/api/properties/${id}/details`
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' })
    if (res.ok) {
      property = await res.json()
    }
  } catch {}
  if (!property) {
    property = await PropertyService.getPropertyById(id)
  }
  
  // If owners are missing due to RLS or join limitations in the details API, fall back to service
  if (property && (!Array.isArray(property.owners) || property.owners.length === 0)) {
    const svc = await PropertyService.getPropertyById(id)
    if (svc && Array.isArray(svc.owners) && svc.owners.length > 0) {
      property.owners = svc.owners
      property.total_owners = svc.total_owners
      if (!property.primary_owner_name && svc.primary_owner_name) property.primary_owner_name = svc.primary_owner_name
    }
  }
  // Financials via API route to leverage HTTP caching
  const today = new Date().toISOString().slice(0, 10)
  let fin: any = null
  try {
    const res = await fetch(`/api/properties/${id}/financials?asOf=${today}`, { cache: 'no-store' })
    if (res.ok) fin = await res.json()
  } catch {}

  // Banking reconciliation details intentionally omitted here; reconciliation lives on bank accounts.

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  if (!property) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Unable to load property details. You may not have access or the property does not exist.</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: details + location */}
      <div className="space-y-6 lg:col-span-2">
        <PropertyDetailsCard property={property} />

        <LocationCard property={property} />
      </div>

      {/* Right rail stacked cards */}
      <div className="space-y-6">
        <BankingDetailsCard property={property} fin={fin} />

        {/* Management Services */}
        <ManagementServicesCard property={property} />

        {/* Notes under management services */}
        <PropertyNotes propertyId={property.id} />
      </div>
    </div>
  )
}

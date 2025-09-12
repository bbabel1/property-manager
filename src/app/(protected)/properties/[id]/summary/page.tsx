import InfoCard from '@/components/layout/InfoCard'
import MetaStat from '@/components/layout/MetaStat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Edit } from 'lucide-react'
import { PropertyService } from '@/lib/property-service'
import PropertyNotes from '@/property/PropertyNotes'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'
import PropertyDetailsCard from '@/components/property/PropertyDetailsCard'

export default async function SummaryTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Server-side fetches for fast first paint
  // Try internal API first (bypasses RLS via service role or cookie-bound client), then fall back to service
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
  const supabase = getSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)
  let fin: any = null
  try {
    const { data } = await (supabase as any).rpc('get_property_financials', { p_property_id: id, p_as_of: today })
    fin = data
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

        {/* Location */}
        <InfoCard title="Location" className="rounded-lg shadow-sm" action={<Button variant="outline" size="sm" aria-label="Edit location"><Edit className="h-4 w-4 mr-2"/>Edit</Button>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Borough</p>
              <p className="text-sm text-foreground mt-1">{(property as any).borough || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Neighborhood</p>
              <p className="text-sm text-foreground mt-1">{(property as any).neighborhood || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Longitude</p>
              <p className="text-sm text-foreground mt-1">{(property as any).longitude ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Latitude</p>
              <p className="text-sm text-foreground mt-1">{(property as any).latitude ?? '—'}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location Verified</p>
            <p className={`text-sm mt-1 ${(property as any).location_verified ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {(property as any).location_verified ? 'Verified' : 'Not verified'}
            </p>
          </div>
        </InfoCard>
      </div>

      {/* Right rail stacked cards */}
      <div className="space-y-6">
        <InfoCard title="Cash balance" className="rounded-lg shadow-sm bg-[#e9e9e9] border-[#e3e3e3]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground">Cash balance:</span>
            <span className="text-lg font-bold text-foreground">{formatCurrency(fin?.cash_balance ?? 0)}</span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>- Security deposits and early payments:</span>
              <span>{formatCurrency(fin?.security_deposits ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>- Property reserve:</span>
              <span>{formatCurrency(fin?.reserve ?? (property.reserve || 0))}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-sm text-foreground">Available balance</span>
            <span className="text-sm font-bold text-foreground">{formatCurrency(fin?.available_balance ?? 0)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">as of {new Date(fin?.as_of || new Date()).toLocaleDateString()}</p>
        </InfoCard>

        <InfoCard title="Banking details" className="rounded-lg shadow-sm bg-[#e9e9e9] border-[#e3e3e3]" action={<Button variant="outline" size="sm" aria-label="Edit banking"><Edit className="h-4 w-4 mr-2"/>Edit</Button>}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Operating Account</span>
              <span className="text-sm text-muted-foreground">
                {property.operating_account ? (
                  <Link className="text-primary hover:underline" href={`/bank-accounts/${property.operating_account.id}`}>
                    {`${property.operating_account.name}${property.operating_account.last4 ? ' ••••' + property.operating_account.last4 : ''}`}
                  </Link>
                ) : (
                  'Setup'
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Deposit Trust Account</span>
              <span className="text-sm text-muted-foreground">
                {property.deposit_trust_account ? (
                  <Link className="text-primary hover:underline" href={`/bank-accounts/${property.deposit_trust_account.id}`}>
                    {`${property.deposit_trust_account.name}${property.deposit_trust_account.last4 ? ' ••••' + property.deposit_trust_account.last4 : ''}`}
                  </Link>
                ) : (
                  'Setup'
                )}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">PROPERTY RESERVE</p>
              <span className="font-semibold text-foreground">{formatCurrency(property.reserve || 200)}</span>
            </div>
          </div>
        </InfoCard>

        {/* Management Services */}
        <InfoCard
          title="Management Services"
          className="rounded-lg shadow-sm bg-[#dbe9ff] border-blue-100"
          action={<Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-2"/>Edit</Button>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ASSIGNMENT LEVEL</p>
              <p className="text-sm text-foreground mt-1">{((property as any).service_assignment || '—')}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SERVICE PLAN</p>
              <p className="text-sm text-foreground mt-1">{((property as any).service_plan || '—')}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ACTIVE SERVICES</p>
              <p className="text-sm text-foreground mt-1">{Array.isArray((property as any).active_services) ? (property as any).active_services.join(', ') : '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">MANAGEMENT FEE</p>
              <p className="text-sm text-foreground mt-1">{(() => {
                const fee = (property as any).management_fee
                const type = (property as any).fee_type
                if (fee == null) return '—'
                if (type === 'Percentage') return `${fee}%`
                return formatCurrency(Number(fee) || 0)
              })()}</p>
            </div>
          </div>
        </InfoCard>

        {/* Notes under management services */}
        <PropertyNotes propertyId={property.id} />
      </div>
    </div>
  )
}

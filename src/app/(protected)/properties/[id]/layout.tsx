import PageHeader from '@/components/layout/PageHeader'
import { getPropertyShellCached, PropertyService } from '@/lib/property-service'
import { headers as nextHeaders, cookies as nextCookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/db'

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  // Keep this layout fast and cache-friendly across tab navigations by
  // avoiding dynamic internal API calls. Use the lightweight cached shell.
  // Try cached shell first for speed
  let headerName: string | undefined
  let headerStatus: string | undefined | null
  let headerType: string | undefined | null
  let headerAssign: string | undefined | null
  let headerPlan: string | undefined | null
  let headerBuildiumId: number | null | undefined
  const shell = await getPropertyShellCached(id)
  if (shell) {
    headerName = shell.name
    headerStatus = shell.status ?? null
    headerType = shell.property_type ?? null
    headerAssign = shell.service_assignment ?? null
    headerPlan = shell.service_plan ?? null
    headerBuildiumId = shell.buildium_property_id ?? null
  }
  // If shell missing (e.g., RLS denies anon read), fall back to internal API with session cookies
  if (!headerName) {
    try {
      const hdrs = await nextHeaders()
      const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
      const proto = hdrs.get('x-forwarded-proto') ?? 'http'
      const cookieStore = await nextCookies()
      const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
      const url = `${proto}://${host}/api/properties/${id}/details`
      const res = await fetch(url, { headers: { cookie: cookieHeader }, next: { revalidate: 120, tags: [`property-details:${id}`] } })
      if (res.ok) {
        const data = await res.json()
        headerName = data?.name
        headerStatus = data?.status ?? null
        headerType = data?.property_type ?? null
        headerAssign = data?.service_assignment ?? null
        headerPlan = data?.service_plan ?? null
        headerBuildiumId = data?.buildium_property_id ?? null
      }
    } catch {}
  }

  // If the cached shell didn't include Buildium info, fetch fresh once (no cache)
  if (!headerBuildiumId) {
    try {
      const fresh = await PropertyService.getPropertyShell(id)
      if (fresh?.buildium_property_id) {
        headerBuildiumId = fresh.buildium_property_id
        headerName = headerName || fresh.name
        headerStatus = headerStatus ?? fresh.status ?? null
        headerType = headerType ?? fresh.property_type ?? null
        headerAssign = headerAssign ?? fresh.service_assignment ?? null
        headerPlan = headerPlan ?? fresh.service_plan ?? null
      }
    } catch {}
  }

  if (!headerBuildiumId && supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('properties')
        .select('buildium_property_id')
        .eq('id', id)
        .maybeSingle()
      const buildiumId = (data as { buildium_property_id?: number | null } | null)?.buildium_property_id
      if (buildiumId != null) {
        headerBuildiumId = typeof buildiumId === 'number' ? buildiumId : Number(buildiumId)
      }
    } catch {}
  }

  return (
    <div className="space-y-2">
      <PageHeader property={{
        id,
        name: headerName || 'Property',
        status: headerStatus,
        property_type: headerType,
        service_assignment: headerAssign,
        service_plan: headerPlan,
        buildium_property_id: headerBuildiumId
      }} />
      <div className="px-6 pb-8">{children}</div>
    </div>
  )
}

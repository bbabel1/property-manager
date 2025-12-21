import { PageBody, PageShell } from '@/components/layout/page-shell'
import PageHeader from '@/components/layout/PageHeader'
import { supabaseAdmin } from '@/lib/db'
import { getPropertyShellCached, PropertyService } from '@/lib/property-service'
import { resolvePropertyIdentifier } from '@/lib/public-id-utils'
import { cookies as nextCookies, headers as nextHeaders } from 'next/headers'

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id: slug } = await params
  const { internalId: propertyId, publicId: propertyPublicId } = await resolvePropertyIdentifier(slug)
  // Keep this layout fast and cache-friendly across tab navigations by
  // avoiding dynamic internal API calls. Use the lightweight cached shell.
  // Try cached shell first for speed
  let headerName: string | undefined
  let headerStatus: string | undefined | null
  let headerType: string | undefined | null
  let headerAssign: string | undefined | null
  let headerPlan: string | undefined | null
  let headerBuildiumId: number | null | undefined
  const shell = await getPropertyShellCached(propertyId)
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
      const url = `${proto}://${host}/api/properties/${propertyId}/details`
      const res = await fetch(url, { headers: { cookie: cookieHeader }, next: { revalidate: 120, tags: [`property-details:${propertyId}`] } })
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
      const fresh = await PropertyService.getPropertyShell(propertyId)
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
        .eq('id', propertyId)
        .maybeSingle()
      const buildiumId = (data as { buildium_property_id?: number | null } | null)?.buildium_property_id
      if (buildiumId != null) {
        headerBuildiumId = typeof buildiumId === 'number' ? buildiumId : Number(buildiumId)
      }
    } catch {}
  }

  return (
    <PageShell>
      <div className="px-2 sm:px-4 md:px-6">
        <PageHeader
          property={{
            id: propertyId,
            publicId: propertyPublicId,
            name: headerName || 'Property',
            status: headerStatus,
            property_type: headerType,
            service_assignment: headerAssign,
            service_plan: headerPlan,
            buildium_property_id: headerBuildiumId,
          }}
        />
      </div>
      <PageBody className="pt-0">{children}</PageBody>
    </PageShell>
  )
}

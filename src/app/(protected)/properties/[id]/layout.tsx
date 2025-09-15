import PageHeader from '@/components/layout/PageHeader'
import { getPropertyShellCached } from '@/lib/property-service'
import { headers as nextHeaders, cookies as nextCookies } from 'next/headers'

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
  const shell = await getPropertyShellCached(id)
  if (shell) {
    headerName = shell.name
    headerStatus = shell.status ?? null
    headerType = (shell as any)?.property_type ?? null
    headerAssign = (shell as any)?.service_assignment ?? null
    headerPlan = (shell as any)?.service_plan ?? null
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
      }
    } catch {}
  }

  return (
    <div className="space-y-2">
      <PageHeader property={{ id, name: headerName || 'Property', status: headerStatus, property_type: headerType, service_assignment: headerAssign, service_plan: headerPlan }} />
      <div className="px-6 pb-8">{children}</div>
    </div>
  )
}

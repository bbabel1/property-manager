import PageHeader from '@/components/layout/PageHeader'
import { getPropertyShellCached } from '@/lib/property-service'
import { headers as nextHeaders, cookies as nextCookies } from 'next/headers'

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  // Try internal API with forwarded cookies to populate header; fall back to cached shell
  let headerName: string | undefined
  let headerStatus: string | undefined | null
  let headerType: string | undefined | null
  let headerAssign: string | undefined | null
  let headerPlan: string | undefined | null
  try {
    const hdrs = await nextHeaders()
    const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
    const proto = hdrs.get('x-forwarded-proto') ?? 'http'
    const cookieStore = await nextCookies()
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
    const url = `${proto}://${host}/api/properties/${id}/details`
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      headerName = data?.name
      headerStatus = data?.status ?? null
      headerType = data?.property_type ?? null
      headerAssign = data?.service_assignment ?? null
      headerPlan = data?.service_plan ?? null
    }
  } catch {}
  if (!headerName) {
    const shell = await getPropertyShellCached(id)
    headerName = shell?.name
    headerStatus = shell?.status ?? null
    headerType = (shell as any)?.property_type ?? null
    headerAssign = (shell as any)?.service_assignment ?? null
    headerPlan = (shell as any)?.service_plan ?? null
  }
  return (
    <div className="space-y-2">
      {/* Header + Tabs */}
      <PageHeader property={{ id, name: headerName || 'Property', status: headerStatus || null, property_type: headerType || null, service_assignment: headerAssign || null, service_plan: headerPlan || null }} />
      {/* Tab content */}
      <div className="px-6 pb-8">{children}</div>
    </div>
  )
}

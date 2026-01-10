import PropertiesClient from './PropertiesClient'
import { cookies, headers } from 'next/headers'

type PropertiesSearchParams = Record<string, string | string[] | undefined>
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const DEFAULT_PAGE_SIZE = 25

const toStringParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || ''

export default async function PropertiesPage(props: PageProps) {
  const { searchParams } = props
  const searchParamsPromise = searchParams ?? Promise.resolve<PropertiesSearchParams>({})
  const resolvedParams: PropertiesSearchParams = (await searchParamsPromise) ?? {}
  const pageParam = Number(toStringParam(resolvedParams.page) || '1')
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const search = toStringParam(resolvedParams.search) || ''
  const status = toStringParam(resolvedParams.status) || 'all'
  const type = toStringParam(resolvedParams.type) || 'all'

  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ')
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? ''
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || ''
  const orgHeader = cookieStore.get('x-org-id')?.value

  const qs = new URLSearchParams()
  qs.set('page', String(page))
  qs.set('pageSize', String(DEFAULT_PAGE_SIZE))
  if (search) qs.set('search', search)
  if (status && status !== 'all') qs.set('status', status)
  if (type && type !== 'all') qs.set('type', type)

  let initialData = []
  let initialTotal = 0
  try {
    const res = await fetch(`${origin}/api/properties?${qs.toString()}`, {
      headers: {
        cookie: cookieHeader,
        ...(orgHeader ? { 'x-org-id': orgHeader } : {}),
      },
      next: { tags: ['properties-list'], revalidate: 30 },
    })
    if (res.ok) {
      const payload = await res.json()
      initialData = Array.isArray(payload?.data) ? payload.data : []
      initialTotal = typeof payload?.total === 'number' ? payload.total : initialData.length
    }
  } catch (err) {
    console.warn('Failed to prefetch properties list', err)
  }

  return (
    <PropertiesClient
      initialData={initialData}
      initialTotal={initialTotal}
      initialPage={page}
      initialPageSize={DEFAULT_PAGE_SIZE}
      initialSearch={search}
      initialStatus={status}
      initialType={type}
    />
  )
}

import { NextResponse } from 'next/server'
import { getCommonTimezones, getTimezoneNames } from '@/lib/timezones'

const CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800'

export function GET() {
  const payload = {
    common: getCommonTimezones(),
    all: getTimezoneNames(),
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': CACHE_CONTROL,
    },
  })
}

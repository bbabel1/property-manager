import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  const result: {
    env: {
      NEXT_PUBLIC_SUPABASE_URL_present: boolean
      NEXT_PUBLIC_SUPABASE_ANON_KEY_present: boolean
      NEXT_PUBLIC_SUPABASE_ANON_KEY_len: number
      SUPABASE_SERVICE_ROLE_KEY_present: boolean
      SUPABASE_SERVICE_ROLE_KEY_len: 'set' | 'unset'
    }
    health: {
      url: string | null
      ok: boolean
      status: number
      error: string | null
      body?: string
    }
  } = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL_present: !!url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_present: anon.length > 0,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_len: anon.length,
      SUPABASE_SERVICE_ROLE_KEY_present: svc.length > 0,
      SUPABASE_SERVICE_ROLE_KEY_len: svc.length ? 'set' : 'unset',
    },
    health: {
      url: url ? `${url.replace(/\/$/, '')}/auth/v1/health` : null,
      ok: false,
      status: 0,
      error: null as string | null,
    },
  }

  if (!url) {
    result.health.error = 'NEXT_PUBLIC_SUPABASE_URL not set'
    return NextResponse.json(result, { status: 200 })
  }

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(t)
    result.health.ok = res.ok
    result.health.status = res.status
    try {
      result.health.body = await res.text()
    } catch {
      // ignore
    }
  } catch (e: unknown) {
    result.health.error = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(result, { status: 200 })
}

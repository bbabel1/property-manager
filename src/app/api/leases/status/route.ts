
import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('idempotencyKey')
    if (!key) return NextResponse.json({ error: 'idempotencyKey required' }, { status: 400 })
    const db = supabaseAdmin || supabase
    const { data, error } = await db.from('idempotency_keys').select('response, status_code, created_at').eq('key', key).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ status: 'not_found' }, { status: 404 })
    return NextResponse.json({ status: 'found', status_code: data.status_code ?? 201, response: data.response, created_at: data.created_at })
  } catch (_error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

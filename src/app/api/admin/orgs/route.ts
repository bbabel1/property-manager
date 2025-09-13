import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireRole } from '@/lib/auth/guards'

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const { data, error } = await supabaseAdmin.from('organizations').select('id, name').order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ organizations: data || [] })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const body = await request.json().catch(() => null)
    const name = body?.name?.trim()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({ name })
      .select('id, name')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ organization: data })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

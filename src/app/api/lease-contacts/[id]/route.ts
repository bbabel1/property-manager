import { NextRequest, NextResponse } from 'next/server'
import { requireSupabaseAdmin } from '@/lib/supabase-client'

type Params = { id: string }

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const admin = requireSupabaseAdmin('update lease contact move-in')
    const { id } = params
    const body = await request.json().catch(() => ({} as any))
    const patch: Record<string, any> = {}
    if ('move_in_date' in body) patch.move_in_date = body.move_in_date || null
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }
    patch.updated_at = new Date().toISOString()

    const { data, error } = await admin
      .from('lease_contacts')
      .update(patch)
      .eq('id', id)
      .select('id, move_in_date')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, contact: data })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const admin = requireSupabaseAdmin('delete lease contact')
    const { id } = params
    const { error } = await admin.from('lease_contacts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

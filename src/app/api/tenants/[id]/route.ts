import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

type AllowedTenantFields =
  | 'tax_id'
  | 'comment'
  | 'emergency_contact_name'
  | 'emergency_contact_email'
  | 'emergency_contact_phone'
  | 'emergency_contact_relationship'

const ALLOWED_FIELDS: AllowedTenantFields[] = [
  'tax_id',
  'comment',
  'emergency_contact_name',
  'emergency_contact_email',
  'emergency_contact_phone',
  'emergency_contact_relationship'
]

export async function PATCH(
  request: Request,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const params = 'params' in context ? context.params : { id: '' }
    const { id } = params instanceof Promise ? await params : params

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing tenant id' }, { status: 400 })
    }

    const payload = (await request.json()) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    for (const field of ALLOWED_FIELDS) {
      if (field in payload) {
        const value = payload[field]
        updates[field] = value ?? null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('tenants')
      .update(updates)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

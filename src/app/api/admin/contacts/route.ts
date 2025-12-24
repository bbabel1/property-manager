import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import type { Database } from '@/types/database'

type ContactRow = Database['public']['Tables']['contacts']['Row']
type ContactUpdate = Database['public']['Tables']['contacts']['Update']

// Create or update a user's contact details
// Body: { user_id?: string, first_name?: string, last_name?: string, phone?: string, email?: string }
export async function POST(request: NextRequest) {
  try {
    // Restrict to platform_admin to avoid cross-org contact edits via service role
    await requireRole('platform_admin')

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server not configured with service role' }, { status: 500 })
    }

    const supabaseAdmin = requireSupabaseAdmin('admin contacts')

    const { user_id, first_name, last_name, phone, email } = body

    let existingContact: Pick<ContactRow, 'id'> | null = null
    if (user_id) {
      // First, try to find existing contact by user_id
      const found = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle()

      if (found.error && found.error.code !== 'PGRST116') { // PGRST116 = no rows found
        return NextResponse.json({ error: found.error.message }, { status: 500 })
      }

      existingContact = found.data ?? null
    }

    const contactData: ContactUpdate = {
      user_id: user_id || null,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      primary_phone: phone?.trim() || null,
      primary_email: email?.trim() || null,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingContact) {
      // Update existing contact
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .update(contactData)
        .eq('id', existingContact.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      result = data
    } else {
      // Create new contact
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .insert({
          ...contactData,
          created_at: new Date().toISOString()
        } satisfies Database['public']['Tables']['contacts']['Insert'])
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      result = data
    }

    return NextResponse.json({ success: true, data: result })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = typeof error?.message === 'string' ? error.message : 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

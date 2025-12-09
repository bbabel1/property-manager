import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { resolveResourceOrg, requireOrgMember } from '@/lib/auth/org-guards'

// Returns the latest pending reconciliation for a given property + bank account
export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth()
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('propertyId')
    const bankAccountId = searchParams.get('bankAccountId')
    if (!propertyId || !bankAccountId) return NextResponse.json({ error: 'Missing propertyId or bankAccountId' }, { status: 400 })

    const resolved = await resolveResourceOrg(supabase, 'property', propertyId)
    if (!resolved.ok) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }
    try {
      await requireOrgMember({ client: supabase, userId: user.id, orgId: resolved.orgId })
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : ''
      const status = msg === 'ORG_FORBIDDEN' ? 403 : 401
      return NextResponse.json({ error: 'Forbidden' }, { status })
    }

    const { data, error } = await supabase
      .from('reconciliation_log')
      .select('buildium_reconciliation_id, statement_ending_date')
      .eq('property_id', propertyId)
      .eq('bank_account_id', bankAccountId)
      .eq('is_finished', false)
      .order('statement_ending_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    const status = msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: 'Unauthorized' }, { status })
  }
}

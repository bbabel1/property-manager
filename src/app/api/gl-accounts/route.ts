import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth/guards'
import { resolveUserOrgIds } from '@/lib/auth/org-access'

const normalizeOrgId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let orgId =
      searchParams.get('orgId') ||
      request.headers.get('x-org-id') ||
      request.cookies.get('x-org-id')?.value ||
      null
    const type = searchParams.get('type') || undefined
    const isActive = searchParams.get('isActive')

    const auth = await requireAuth()
    const db = auth.supabase
    const userOrgIds = await resolveUserOrgIds({ supabase: db, user: auth.user })

    if (orgId) {
      const normalized = normalizeOrgId(orgId)
      if (!normalized || !userOrgIds.includes(normalized)) {
        return NextResponse.json({ error: 'Forbidden for organization' }, { status: 403 })
      }
      orgId = normalized
    } else {
      orgId = userOrgIds[0] ?? null
    }

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    let query = db
      .from('gl_accounts')
      .select(
        [
          'id',
          'name',
          'type',
          'sub_type',
          'account_number',
          'default_account_name',
          'cash_flow_classification',
          'description',
          'is_active',
          'is_security_deposit_liability',
          'is_bank_account',
          'is_contra_account',
          'is_credit_card_account',
          'exclude_from_cash_balances',
          'is_default_gl_account',
          'buildium_gl_account_id',
          'buildium_parent_gl_account_id',
          'sub_accounts',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .eq('org_id', orgId)

    if (type) query = query.eq('type', type)
    if (isActive !== null) {
      if (isActive === 'true') query = query.eq('is_active', true)
      if (isActive === 'false') query = query.eq('is_active', false)
    }

    query = query.order('type', { ascending: true })
    query = query.order('name', { ascending: true })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err) {
    logger.error({ err }, 'Error in GET /api/gl-accounts')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

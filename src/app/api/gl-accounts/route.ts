import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase-client'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const type = searchParams.get('type') || undefined
    const isActive = searchParams.get('isActive')

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const db = getServerSupabaseClient('api:gl-accounts:list')
    let query = db
      .from('gl_accounts')
      .select('id, name, type, is_active, is_security_deposit_liability')
      .eq('org_id', orgId)

    if (type) query = query.eq('type', type)
    if (isActive !== null) {
      if (isActive === 'true') query = query.eq('is_active', true)
      if (isActive === 'false') query = query.eq('is_active', false)
    }

    query = query.order('name', { ascending: true })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err) {
    logger.error({ err }, 'Error in GET /api/gl-accounts')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET(req: NextRequest) {
  const admin = supabaseAdmin
  if (!admin) return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'variance' | 'stale' | null
  const table = type === 'variance' ? 'v_reconciliation_variance_alerts'
              : type === 'stale' ? 'v_reconciliation_stale_alerts'
              : 'v_reconciliation_alerts'

  const { data, error } = await admin.from(table).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data, count: Array.isArray(data) ? data.length : 0 })
}


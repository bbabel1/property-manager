import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import supabaseAdmin, { supabase } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// Utility to mask numbers except last 4
function mask(v: string | null | undefined) {
  if (!v) return null
  const s = String(v)
  if (s.length <= 4) return s
  return s.replace(/.(?=.{4}$)/g, '•')
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(request)
    const url = new URL(request.url)
    const reveal = url.searchParams.get('revealNumbers') === 'true'

    // Prefer admin for consistency and to avoid cookie/session coupling. Fall back to SSR client.
    const db = supabaseAdmin || (await getSupabaseServerClient()) || supabase
    const { data, error } = await db
      .from('bank_accounts')
      .select('id, name, bank_account_type, account_number, routing_number, is_active')
      .order('name', { ascending: true })

    if (error) {
      const msg = String((error as any)?.message || '')
      const code = (error as any)?.code
      // Be forgiving in dev if table/columns are missing; return empty array instead of 500
      if (code === '42P01' || code === '42703' || /does not exist|relation/.test(msg)) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: 'Failed to load bank accounts', details: msg }, { status: 500 })
    }

    const rows = (data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      bank_account_type: a.bank_account_type,
      account_number: reveal ? a.account_number : mask(a.account_number),
      routing_number: reveal ? a.routing_number : mask(a.routing_number),
      is_active: a.is_active,
    }))

    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to load bank accounts' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  description: z.string().optional().default(''),
  bank_account_type: z.string().min(1, 'Account type is required'),
  account_number: z.string().min(1, 'Account number is required'),
  routing_number: z.string().min(1, 'Routing number is required'),
  country: z.string().min(1, 'Country is required')
})

export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const json = await request.json().catch(() => ({}))
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join('\n')
      return NextResponse.json({ error: msg || 'Invalid input' }, { status: 400 })
    }
    const body = parsed.data

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured for writes' }, { status: 500 })
    }

    const now = new Date().toISOString()
    const insert = {
      name: body.name,
      description: body.description || null,
      bank_account_type: body.bank_account_type,
      account_number: body.account_number,
      routing_number: body.routing_number,
      is_active: true,
      country: body.country,
      created_at: now,
      updated_at: now,
      last_source: 'local' as const,
      last_source_ts: now
    }

    const { data, error } = await supabaseAdmin
      .from('bank_accounts')
      .insert(insert)
      .select('id, name, bank_account_type, account_number, routing_number, is_active')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create bank account', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 })
  }
}

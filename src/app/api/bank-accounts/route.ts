import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import type { Database } from '@/types/database'
import {
  getServerSupabaseClient,
  hasSupabaseAdmin,
  requireSupabaseAdmin,
  SupabaseAdminUnavailableError,
} from '@/lib/supabase-client'
import { normalizeBankAccountType } from '@/lib/bank-account-service'
import { normalizeCountryWithDefault } from '@/lib/normalizers'
import { mapGoogleCountryToEnum } from '@/lib/utils'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

// Utility to mask numbers except last 4
function mask(v: string | null | undefined) {
  if (!v) return null
  const s = String(v)
  if (s.length <= 4) return s
  return s.replace(/.(?=.{4}$)/g, '•')
}

async function resolveOrgId(request: NextRequest, db: any, userId: string): Promise<string> {
  let orgId: string | null = request.headers.get('x-org-id') || null
  if (!orgId) {
    try {
      const { data: rows } = await db
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', userId)
        .limit(1)
      const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      orgId = (first as any)?.org_id || null
    } catch {
      // ignore and fall through
    }
  }
  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')
  return orgId
}

// Generate a deterministic local-only Buildium GL ID placeholder for an org.
// Kept within 900,000,000..900,099,999 to reduce collision with real Buildium IDs.
function computeLocalGlId(orgId: string, bump: number = 0): number {
  let h = 0
  for (let i = 0; i < orgId.length; i++) {
    h = (h * 31 + orgId.charCodeAt(i)) | 0
  }
  const base = 900_000_000 + (Math.abs(h) % 100_000) // 900,000,000..900,099,999
  const id = base + (bump % 100_000)
  return id
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const url = new URL(request.url)
    const reveal = url.searchParams.get('revealNumbers') === 'true'

    // Prefer admin for consistency and to avoid cookie/session coupling. Fall back to SSR client.
    const db = getServerSupabaseClient()
    // Scope to organization for predictable results
    let orgId: string | null = null
    try {
      orgId = await resolveOrgId(request, db, user.id)
    } catch {
      // If org cannot be resolved, return empty to avoid leaking cross-org data
      return NextResponse.json([])
    }
    const { data, error } = await db
      .from('bank_accounts')
      .select('id, name, bank_account_type, account_number, routing_number, is_active')
      .eq('org_id', orgId)
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
  account_number: z
    .string()
    .regex(/^[0-9]{4,17}$/, 'Account number must be 4–17 digits'),
  routing_number: z
    .string()
    .regex(/^[0-9]{9}$/, 'Routing number must be 9 digits'),
  country: z.string().min(1, 'Country is required')
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const json = await request.json().catch(() => ({}))
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join('\n')
      return NextResponse.json({ error: msg || 'Invalid input' }, { status: 400 })
    }
    const body = parsed.data

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server not configured for writes (service role missing)' }, { status: 501 })
    }

    const admin = requireSupabaseAdmin('bank accounts POST')

    // Resolve organization context (required by schema/RLS)
    const orgId = await resolveOrgId(request, admin, user.id)

    // Prevent duplicate accounts within the same org by routing+account number
    const { data: existingAccount, error: existingErr } = await admin
      .from('bank_accounts')
      .select('id, name, bank_account_type, account_number, routing_number, is_active')
      .eq('org_id', orgId)
      .eq('account_number', body.account_number)
      .eq('routing_number', body.routing_number)
      .limit(1)
      .maybeSingle()

    if (!existingErr && existingAccount) {
      return NextResponse.json(
        { error: 'Bank account already exists', existing: existingAccount },
        { status: 409 }
      )
    }

    // Find or create a default GL account for bank accounts
    let glAccountId: string
    const { data: existingGLAccount, error: glError } = await admin
      .from('gl_accounts')
      .select('id')
      .eq('org_id', orgId)
      .eq('is_bank_account', true)
      .limit(1)
      .maybeSingle()

    if (glError || !existingGLAccount) {
      // Create a default GL account for bank accounts
      let attempts = 0
      let created: { id: string } | null = null
      let lastErr: any = null
      while (attempts < 5 && !created) {
        const placeholderId = computeLocalGlId(orgId, attempts)
        const { data: newGLAccount, error: createGLError } = await admin
          .from('gl_accounts')
          .insert({
            buildium_gl_account_id: placeholderId,
            name: 'Default Bank Account GL',
            type: 'Asset',
            is_bank_account: true,
            is_active: true,
            org_id: orgId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single()
        if (!createGLError && newGLAccount) {
          created = newGLAccount
          break
        }
        lastErr = createGLError
        // If duplicate buildium_gl_account_id, bump and retry
        const msg = String(createGLError?.message || '')
        if (!/duplicate key value/.test(msg)) break
        attempts++
      }
      if (!created) {
        return NextResponse.json({
          error: 'Failed to create default GL account',
          details: lastErr?.message || 'Unknown error'
        }, { status: 500 })
      }
      glAccountId = created.id
    } else {
      glAccountId = existingGLAccount.id
    }

    const now = new Date().toISOString()
    const normalizedCountry = normalizeCountryWithDefault(mapGoogleCountryToEnum(body.country))
    const insert = {
      name: body.name,
      description: body.description || null,
      bank_account_type: normalizeBankAccountType(body.bank_account_type),
      account_number: body.account_number,
      routing_number: body.routing_number,
      is_active: true,
      country: normalizedCountry,
      created_at: now,
      updated_at: now,
      last_source: 'local' as const,
      last_source_ts: now,
      // Required fields for database schema
      buildium_bank_id: 0, // Default value for local accounts
      gl_account: glAccountId, // Reference to GL account
      org_id: orgId,
    } as Database['public']['Tables']['bank_accounts']['Insert']

    const { data, error } = await admin
      .from('bank_accounts')
      .insert(insert as any)
      .select('id, name, bank_account_type, account_number, routing_number, is_active')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create bank account', details: error.message }, { status: 500 })
    }

    // Optional immediate sync to Buildium
    const url = new URL(request.url)
    const syncToBuildium = url.searchParams.get('syncToBuildium') === 'true'
    if (syncToBuildium) {
      // Load full row for mapping and enrich with GLAccountId if available
      const { data: full, error: fetchErr } = await admin
        .from('bank_accounts')
        .select('*')
        .eq('id', data.id)
        .single()
      if (fetchErr || !full) {
        return NextResponse.json({ error: 'Created locally but failed to load for Buildium sync', details: fetchErr?.message }, { status: 500 })
      }

      let payload: any = { ...full }
      try {
        if (full.gl_account) {
          const { data: gl } = await admin
            .from('gl_accounts')
            .select('buildium_gl_account_id')
            .eq('id', full.gl_account)
            .maybeSingle()
          const glId = gl?.buildium_gl_account_id
          if (typeof glId === 'number' && glId > 0) payload = { ...payload, GLAccountId: glId }
        }
      } catch {}

      const result = await buildiumEdgeClient.syncBankAccountToBuildium(payload)
      if (!result.success) {
        const currentBuildiumId = full.buildium_bank_id ?? undefined
        if (typeof currentBuildiumId === 'number') {
          try {
            await admin.rpc('update_buildium_sync_status', {
              p_entity_type: 'bankAccount',
              p_entity_id: data.id,
              p_buildium_id: currentBuildiumId,
              p_status: 'failed',
              p_error_message: result.error || 'Unknown error'
            })
          } catch {}
        }
        return NextResponse.json({ success: true, data, buildiumSync: { success: false, error: result.error } })
      }

      // Ensure local record stores the returned Buildium Id
      if (result.buildiumId) {
        try {
          await admin.from('bank_accounts').update({ buildium_bank_id: result.buildiumId, updated_at: new Date().toISOString() }).eq('id', data.id)
          await admin.rpc('update_buildium_sync_status', {
            p_entity_type: 'bankAccount',
            p_entity_id: data.id,
            p_buildium_id: result.buildiumId,
            p_status: 'synced'
          })
        } catch {}
      }

      return NextResponse.json({ success: true, data: { ...data, buildium_bank_id: result.buildiumId ?? undefined } })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 })
  }
}

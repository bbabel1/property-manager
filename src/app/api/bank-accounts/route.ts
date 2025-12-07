import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { resolveUserOrgIds } from '@/lib/auth/org-access'
import { hasRole, type AppRole } from '@/lib/auth/roles'
import { normalizeBankAccountType } from '@/lib/bank-account-service'
import { normalizeCountryWithDefault } from '@/lib/normalizers'
import { mapGoogleCountryToEnum } from '@/lib/utils'

// Utility to mask numbers except last 4
function mask(v: string | null | undefined) {
  if (!v) return null
  const s = String(v)
  if (s.length <= 4) return s
  return s.replace(/.(?=.{4}$)/g, '•')
}

async function resolveOrgId(request: NextRequest, userOrgIds: string[]): Promise<string> {
  const requested = request.headers.get('x-org-id')
  if (requested) {
    const normalized = requested.trim()
    if (normalized && userOrgIds.includes(normalized)) return normalized
    throw new Error('ORG_FORBIDDEN')
  }
  if (!userOrgIds.length) throw new Error('ORG_CONTEXT_REQUIRED')
  return userOrgIds[0]
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
    const auth = await requireAuth()
    const orgId = await resolveOrgId(request, await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user }))

    const { data, error } = await auth.supabase
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
      account_number: mask(a.account_number),
      routing_number: mask(a.routing_number),
      is_active: a.is_active,
    }))

    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if ((error as Error)?.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden for organization' }, { status: 403 })
    }
    if ((error as Error)?.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
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
    const auth = await requireAuth()
    const json = await request.json().catch(() => ({}))
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => i.message).join('\n')
      return NextResponse.json({ error: msg || 'Invalid input' }, { status: 400 })
    }
    const body = parsed.data

    const allowedRoles: AppRole[] = ['org_admin', 'org_manager', 'platform_admin']
    if (!hasRole(auth.roles, allowedRoles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Resolve organization context (required by schema/RLS)
    const orgId = await resolveOrgId(
      request,
      await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user })
    )

    // Prevent duplicate accounts within the same org by routing+account number
    const { data: existingAccount, error: existingErr } = await auth.supabase
      .from('bank_accounts')
      .select('id, name, bank_account_type, account_number, routing_number, is_active')
      .eq('org_id', orgId)
      .eq('account_number', body.account_number)
      .eq('routing_number', body.routing_number)
      .limit(1)
      .maybeSingle()

    if (!existingErr && existingAccount) {
      const maskedExisting = {
        ...existingAccount,
        account_number: mask(existingAccount.account_number),
        routing_number: mask(existingAccount.routing_number)
      }
      return NextResponse.json(
        { error: 'Bank account already exists', existing: maskedExisting },
        { status: 409 }
      )
    }

    // Find or create a default GL account for bank accounts
    let glAccountId: string
    const { data: existingGLAccount, error: glError } = await auth.supabase
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
        const { data: newGLAccount, error: createGLError } = await auth.supabase
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
    }

    const { data, error } = await auth.supabase
      .from('bank_accounts')
      .insert(insert as any)
      .select('id, name, bank_account_type, account_number, routing_number, is_active')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create bank account', details: error.message }, { status: 500 })
    }
    const maskedData = {
      ...data,
      account_number: mask(data.account_number),
      routing_number: mask(data.routing_number)
    }

    return NextResponse.json(maskedData)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if ((error as Error)?.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden for organization' }, { status: 403 })
    }
    if ((error as Error)?.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 })
  }
}

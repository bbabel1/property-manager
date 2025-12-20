import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { resolveUserOrgIds } from '@/lib/auth/org-access'
import { hasRole, type AppRole } from '@/lib/auth/roles'
import { normalizeCountryWithDefault } from '@/lib/normalizers'
import { mapGoogleCountryToEnum } from '@/lib/utils'
import { normalizeBankAccountType } from '@/lib/gl-bank-account-normalizers'

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
      .from('gl_accounts')
      .select('id, name, bank_account_type, bank_account_number, bank_routing_number, is_active')
      .eq('org_id', orgId)
      .eq('is_bank_account', true)
      .order('name', { ascending: true })

    if (error) {
      const msg = String((error as any)?.message || '')
      return NextResponse.json({ error: 'Failed to load bank accounts', details: msg }, { status: 500 })
    }

    const rows = (data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      bank_account_type: a.bank_account_type,
      account_number: mask(a.bank_account_number),
      routing_number: mask(a.bank_routing_number),
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
    const { data: existing, error: existingErr } = await auth.supabase
      .from('gl_accounts')
      .select('id, name, bank_account_number')
      .eq('org_id', orgId)
      .eq('is_bank_account', true)
      .eq('bank_account_number', body.account_number)
      .eq('bank_routing_number', body.routing_number)
      .limit(1)
      .maybeSingle()
    if (!existingErr && existing) {
      return NextResponse.json(
        {
          error: 'Bank account already exists',
          existing: {
            id: (existing as any).id,
            name: (existing as any).name,
            account_number: mask((existing as any).bank_account_number),
          },
        },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()
    const normalizedCountry = normalizeCountryWithDefault(mapGoogleCountryToEnum(body.country))
    // Create a new bank GL account row
    let createdGl: { id: string; bank_account_number?: string | null; bank_routing_number?: string | null; bank_account_type?: string | null; is_active?: boolean | null } | null = null
    let attempts = 0
    while (attempts < 25 && !createdGl) {
      const placeholderId = computeLocalGlId(orgId, attempts)
      const { data, error } = await auth.supabase
        .from('gl_accounts')
        .insert({
          buildium_gl_account_id: placeholderId,
          name: body.name,
          description: body.description || null,
          type: 'Asset',
          is_bank_account: true,
          is_active: true,
          org_id: orgId,
          created_at: now,
          updated_at: now,
          buildium_bank_account_id: null,
          bank_account_type: normalizeBankAccountType(body.bank_account_type) as any,
          bank_account_number: body.account_number,
          bank_routing_number: body.routing_number,
          bank_country: normalizedCountry as any,
          bank_last_source: 'local' as any,
          bank_last_source_ts: now,
        } as any)
        .select('id, bank_account_type, bank_account_number, bank_routing_number, is_active')
        .single()
      if (!error && data) {
        createdGl = data as any
        break
      }
      const msg = String((error as any)?.message || '')
      if (!/duplicate key value/.test(msg)) {
        return NextResponse.json({ error: 'Failed to create bank account', details: msg }, { status: 500 })
      }
      attempts++
    }

    if (!createdGl) {
      return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 })
    }
    const maskedData = {
      id: createdGl.id,
      name: body.name,
      bank_account_type: createdGl.bank_account_type ?? null,
      account_number: mask(createdGl.bank_account_number),
      routing_number: mask(createdGl.bank_routing_number),
      is_active: createdGl.is_active ?? true,
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

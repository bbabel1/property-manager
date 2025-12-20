import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/guards'
import { resolveUserOrgIds } from '@/lib/auth/org-access'
import { hasRole, type AppRole } from '@/lib/auth/roles'
import { normalizeCountryWithDefault } from '@/lib/normalizers'
import { mapGoogleCountryToEnum } from '@/lib/utils'
import { normalizeBankAccountType } from '@/lib/gl-bank-account-normalizers'

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

function computeLocalGlId(seed: string, bump: number = 0): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  const base = 900_000_000 + (Math.abs(h) % 100_000)
  return base + (bump % 100_000)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const orgId = await resolveOrgId(request, await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user }))

    const { data, error } = await auth.supabase
      .from('gl_accounts')
      .select('id, name, description, is_active, bank_account_type, bank_account_number, bank_country')
      .eq('org_id', orgId)
      .eq('is_bank_account', true)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to load bank accounts', details: error.message }, { status: 500 })
    }

    const rows = (data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      bank_account_type: a.bank_account_type ?? null,
      account_number: mask(a.bank_account_number),
      is_active: a.is_active,
      country: a.bank_country ?? null,
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
  account_number: z.string().regex(/^[0-9]{4,17}$/, 'Account number must be 4–17 digits'),
  routing_number: z.string().regex(/^[0-9]{9}$/, 'Routing number must be 9 digits'),
  country: z.string().min(1, 'Country is required'),
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

    const orgId = await resolveOrgId(
      request,
      await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user })
    )

    const now = new Date().toISOString()
    const normalizedCountry = normalizeCountryWithDefault(mapGoogleCountryToEnum(body.country))

    // Prevent duplicates within the same org by routing+account number.
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

    // Generate a local placeholder Buildium GL id for the new GL account.
    let glId: number | null = null
    let createdGl: { id: string } | null = null
    let attempts = 0
    while (attempts < 25 && !createdGl) {
      glId = computeLocalGlId(`${orgId}:${body.name}`, attempts)
      const { data, error } = await auth.supabase
        .from('gl_accounts')
        .insert({
          buildium_gl_account_id: glId,
          name: body.name,
          description: body.description || null,
          type: 'Asset',
          is_bank_account: true,
          is_active: true,
          org_id: orgId,
          created_at: now,
          updated_at: now,
          // Bank fields on gl_accounts
          buildium_bank_account_id: null,
          bank_account_type: normalizeBankAccountType(body.bank_account_type) as any,
          bank_account_number: body.account_number,
          bank_routing_number: body.routing_number,
          bank_country: normalizedCountry as any,
          bank_balance: 0,
          bank_buildium_balance: 0,
          bank_last_source: 'local' as any,
          bank_last_source_ts: now,
        } as any)
        .select('id')
        .single()

      if (!error && data) {
        createdGl = data
        break
      }
      const msg = String((error as any)?.message || '')
      if (!/duplicate key value/.test(msg)) {
        return NextResponse.json({ error: 'Failed to create bank GL account', details: msg }, { status: 500 })
      }
      attempts++
    }

    if (!createdGl) {
      return NextResponse.json({ error: 'Failed to create bank GL account' }, { status: 500 })
    }

    return NextResponse.json({
      id: createdGl.id,
      name: body.name,
      description: body.description || null,
      bank_account_type: normalizeBankAccountType(body.bank_account_type),
      account_number: mask(body.account_number),
      is_active: true,
      country: normalizedCountry,
    })
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

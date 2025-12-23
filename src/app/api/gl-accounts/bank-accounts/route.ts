import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/guards'
import { resolveUserOrgIds } from '@/lib/auth/org-access'
import { hasRole, type AppRole } from '@/lib/auth/roles'
import { createBankGlAccountWithBuildium } from '@/lib/bank-account-create'
import { supabaseAdmin } from '@/lib/db'

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const orgId = await resolveOrgId(request, await resolveUserOrgIds({ supabase: auth.supabase, user: auth.user }))

    const { data, error } = await auth.supabase
      .from('gl_accounts')
      .select('id, name, description, is_active, bank_account_type, bank_account_number, bank_country, buildium_gl_account_id, bank_balance, bank_buildium_balance, bank_check_printing_info, bank_electronic_payments')
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
      buildium_gl_account_id: a.buildium_gl_account_id ?? null,
      bank_balance: a.bank_balance ?? null,
      bank_buildium_balance: a.bank_buildium_balance ?? null,
      bank_check_printing_info: a.bank_check_printing_info ?? null,
      bank_electronic_payments: a.bank_electronic_payments ?? null,
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
  bank_information_lines: z.array(z.string()).max(5).optional().default([]),
  company_information_lines: z.array(z.string()).max(5).optional().default([]),
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

    const result = await createBankGlAccountWithBuildium({
      supabase: supabaseAdmin || auth.supabase,
      orgId,
      payload: body,
    })

    if (!result.success) {
      if (result.status === 409 && result.existing) {
        return NextResponse.json(
          {
            error: result.error,
            existing: {
              id: result.existing.id,
              name: result.existing.name,
              account_number: mask(result.existing.bank_account_number),
            },
          },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status || 500 },
      )
    }

    return NextResponse.json({
      id: result.record.id,
      name: result.record.name ?? body.name,
      description: result.record.description ?? body.description ?? null,
      bank_account_type: result.record.bank_account_type ?? null,
      account_number: mask(result.record.bank_account_number),
      is_active: result.record.is_active ?? true,
      country: result.record.bank_country ?? body.country,
      buildium_gl_account_id: result.record.buildium_gl_account_id,
      bank_balance: result.record.bank_balance ?? null,
      bank_buildium_balance: result.record.bank_buildium_balance ?? null,
      bank_check_printing_info: result.record.bank_check_printing_info ?? null,
      bank_electronic_payments: result.record.bank_electronic_payments ?? null,
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

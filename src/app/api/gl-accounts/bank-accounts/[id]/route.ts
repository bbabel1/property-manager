import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { resolveUserOrgIds } from '@/lib/auth/org-access';
import { hasRole, type AppRole } from '@/lib/auth/roles';
import {
  updateBankGlAccountWithBuildium,
  type UpdateBankAccountPayload,
} from '@/lib/bank-account-create';
import { supabaseAdmin } from '@/lib/db';

function mask(v: string | null | undefined) {
  if (!v) return null;
  const s = String(v);
  if (s.length <= 4) return s;
  return s.replace(/.(?=.{4}$)/g, '•');
}

const UpdateSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  description: z.string().optional().default(''),
  bank_account_type: z.string().min(1, 'Account type is required'),
  account_number: z.string().regex(/^[0-9]{4,17}$/, 'Account number must be 4–17 digits'),
  routing_number: z.string().regex(/^[0-9]{9}$/, 'Routing number must be 9 digits'),
  country: z.string().min(1, 'Country is required'),
  bank_information_lines: z.array(z.string()).max(5).optional().default([]),
  company_information_lines: z.array(z.string()).max(5).optional().default([]),
  is_active: z.boolean().optional(),
}) satisfies z.ZodType<UpdateBankAccountPayload>;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Bank account id is required' }, { status: 400 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('\n');
      return NextResponse.json({ error: msg || 'Invalid input' }, { status: 400 });
    }

    const allowedRoles: AppRole[] = ['org_admin', 'org_manager', 'platform_admin'];
    if (!hasRole(auth.roles, allowedRoles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userOrgIds = await resolveUserOrgIds({
      supabase: auth.supabase,
      user: auth.user,
    });

    const { data: existing, error: fetchError } = await auth.supabase
      .from('gl_accounts')
      .select(
        'id, org_id, buildium_gl_account_id, name, description, bank_account_type, bank_account_number, bank_routing_number, bank_country, bank_check_printing_info, is_active',
      )
      .eq('id', id)
      .eq('is_bank_account', true)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to load bank account', details: fetchError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const orgId = existing.org_id ? String(existing.org_id) : null;
    if (!orgId) {
      return NextResponse.json({ error: 'Bank account missing organization' }, { status: 400 });
    }
    if (!userOrgIds.includes(orgId)) {
      return NextResponse.json({ error: 'Forbidden for organization' }, { status: 403 });
    }

    const dbClient = supabaseAdmin || auth.supabase;

    const result = await updateBankGlAccountWithBuildium({
      supabase: dbClient,
      orgId,
      glAccountId: id,
      buildiumId: existing.buildium_gl_account_id,
      payload: parsed.data,
      currentIsActive: existing.is_active,
      existingCheckPrintingInfo: existing.bank_check_printing_info as Record<string, unknown> | null,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status || 500 },
      );
    }

    return NextResponse.json({
      id: result.record.id,
      name: result.record.name ?? parsed.data.name,
      description: result.record.description ?? parsed.data.description ?? null,
      bank_account_type: result.record.bank_account_type ?? null,
      account_number: mask(result.record.bank_account_number),
      is_active: result.record.is_active ?? parsed.data.is_active ?? true,
      country: result.record.bank_country ?? parsed.data.country,
      buildium_gl_account_id: result.record.buildium_gl_account_id ?? existing.buildium_gl_account_id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 });
  }
}

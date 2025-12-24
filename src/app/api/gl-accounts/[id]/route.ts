import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/guards';
import { requireOrgAdmin } from '@/lib/auth/org-guards';
import { BuildiumEdgeClient } from '@/lib/buildium-edge-client';
import { getOrgScopedBuildiumConfig } from '@/lib/buildium/credentials-manager';
import { supabaseAdmin } from '@/lib/db';

const UpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  account_number: z.string().trim().nullable().optional(),
  type: z.string().trim().optional(),
  sub_type: z.string().trim().nullable().optional(),
  default_account_name: z.string().trim().nullable().optional(),
  cash_flow_classification: z.string().trim().nullable().optional(),
  is_active: z.boolean().optional(),
  exclude_from_cash_balances: z.boolean().optional(),
  is_contra_account: z.boolean().optional(),
  is_bank_account: z.boolean().optional(),
  is_credit_card_account: z.boolean().optional(),
});

type SafePayload = z.infer<typeof UpdateSchema>;

const GL_ACCOUNT_SAFE_SELECT =
  'id,org_id,buildium_gl_account_id,name,account_number,description,type,sub_type,default_account_name,cash_flow_classification,is_active,exclude_from_cash_balances,is_contra_account,is_bank_account,is_credit_card_account,is_default_gl_account,is_security_deposit_liability,buildium_parent_gl_account_id,sub_accounts,created_at,updated_at' as const;

const cleanNullable = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: 'Missing account id' }, { status: 400 });

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('gl_accounts')
      .select(GL_ACCOUNT_SAFE_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    if (!existing.org_id) {
      return NextResponse.json({ success: false, error: 'Account missing organization' }, { status: 400 });
    }

    await requireOrgAdmin({
      client: auth.supabase,
      userId: auth.user.id,
      orgId: existing.org_id,
    });

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const payload: SafePayload = parsed.data;

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.account_number !== undefined) updates.account_number = cleanNullable(payload.account_number);
    if (payload.description !== undefined) updates.description = cleanNullable(payload.description);
    if (payload.type !== undefined) updates.type = payload.type.trim();
    if (payload.sub_type !== undefined) updates.sub_type = cleanNullable(payload.sub_type);
    if (payload.default_account_name !== undefined) {
      updates.default_account_name = cleanNullable(payload.default_account_name);
    }
    if (payload.cash_flow_classification !== undefined) {
      updates.cash_flow_classification = cleanNullable(payload.cash_flow_classification);
    }
    if (payload.is_active !== undefined) updates.is_active = payload.is_active;
    if (payload.exclude_from_cash_balances !== undefined) {
      updates.exclude_from_cash_balances = payload.exclude_from_cash_balances;
    }
    if (payload.is_contra_account !== undefined) updates.is_contra_account = payload.is_contra_account;
    if (payload.is_bank_account !== undefined) updates.is_bank_account = payload.is_bank_account;
    if (payload.is_credit_card_account !== undefined) {
      updates.is_credit_card_account = payload.is_credit_card_account;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ success: false, error: 'No changes to apply' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('gl_accounts')
      .update(updates)
      .eq('id', id)
      .select(GL_ACCOUNT_SAFE_SELECT)
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    let buildiumSync:
      | { success: boolean; error?: string; skipped?: boolean }
      | null = null;

    if (updated?.buildium_gl_account_id) {
      const config = await getOrgScopedBuildiumConfig(updated.org_id ?? undefined);

      if (config) {
        const buildiumPayload = {
          Id: updated.buildium_gl_account_id,
          Name: updated.name,
          AccountNumber: updated.account_number ?? undefined,
          Description: updated.description ?? undefined,
          Type: updated.type,
          SubType: updated.sub_type ?? undefined,
          DefaultAccountName: updated.default_account_name ?? undefined,
          CashFlowClassification: updated.cash_flow_classification ?? undefined,
          IsActive: updated.is_active ?? undefined,
          IsContraAccount: updated.is_contra_account ?? undefined,
          IsBankAccount: updated.is_bank_account ?? undefined,
          IsCreditCardAccount: updated.is_credit_card_account ?? undefined,
          ExcludeFromCashBalances: updated.exclude_from_cash_balances ?? undefined,
          ParentGLAccountId: updated.buildium_parent_gl_account_id ?? undefined,
        };

        const client = new BuildiumEdgeClient();
        const syncRes = await client.syncGLAccountToBuildium(buildiumPayload);
        buildiumSync = syncRes.success
          ? { success: true }
          : { success: false, error: syncRes.error || 'Failed to sync to Buildium' };
      } else {
        buildiumSync = { success: false, skipped: true, error: 'Buildium integration disabled' };
      }
    }

    return NextResponse.json({
      success: true,
      data: updated,
      buildiumSync: buildiumSync ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

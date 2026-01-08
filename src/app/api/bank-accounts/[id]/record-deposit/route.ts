import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import type { TablesInsert } from '@/types/database';
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers';
import { loadRecordDepositPrefill } from '@/server/bank-accounts/record-deposit';
import type { DepositItemInput, DepositLineInput, DepositPaymentSplitInput } from '@/lib/deposit-service';
import { createDepositWithMeta, touchDepositMeta } from '@/lib/deposit-service';

type BankAccountRow = { id: string; org_id: string | null; buildium_gl_account_id: number | null };
type PaymentLineRow = {
  gl_account_id: string | null;
  amount?: number | null;
  posting_type?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
};
type PaymentRow = {
  id: string;
  total_amount: number | null;
  buildium_transaction_id: number | null;
  bank_gl_account_id: string | null;
  memo?: string | null;
  tenant_id?: string | null;
  paid_to_tenant_id?: string | null;
  transaction_lines: PaymentLineRow[];
};
type PropertyRow = { id: string; name: string | null; address_line1: string | null; buildium_property_id: number | null };
type UnitRow = { id: string; unit_number: string | null; unit_name: string | null; buildium_unit_id: number | null };
type TenantRow = {
  id: string;
  contacts?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
  } | null;
};
type GlAccountRow = { id: string; buildium_gl_account_id: number | null };

const parseCurrencyInput = (value: string | null | undefined) => {
  if (typeof value !== 'string') return 0;
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const OtherItemSchema = z
  .object({
    id: z.string(),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    glAccountId: z.string().min(1),
    description: z.string().max(2000).optional(),
    amount: z.string(),
  })
  .refine((item) => parseCurrencyInput(item.amount) >= 0, 'Invalid amount');

const PayloadSchema = z.object({
  bankAccountId: z.string().min(1),
  date: z.string().min(1),
  memo: z.string().max(2000).optional(),
  printDepositSlips: z.boolean().optional(),
  paymentTransactionIds: z.array(z.string()).optional(),
  otherItems: z.array(OtherItemSchema).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('platform_admin');
    const { id } = await params;
    const result = await loadRecordDepositPrefill(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error('Failed to load record deposit prefill via API', error);
    return NextResponse.json({ error: 'Unable to load record deposit data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('platform_admin');
    const { id: pageBankAccountId } = await params;

    const body = await request.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: issue?.message ?? 'Invalid request' } },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const targetBankAccountId = payload.bankAccountId || pageBankAccountId;

    // Load bank account and org context
    const { data: bankAccount, error: bankErr } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, org_id, buildium_gl_account_id')
      .eq('id', targetBankAccountId)
      .eq('is_bank_account', true)
      .maybeSingle<BankAccountRow>();
    if (bankErr || !bankAccount) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Bank account not found' } },
        { status: 404 },
      );
    }

    const orgId = bankAccount.org_id ?? null;
    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'UNPROCESSABLE_ENTITY', message: 'Bank account is missing organization context' } },
        { status: 422 },
      );
    }
    const udfGlAccountId = await resolveUndepositedFundsGlAccountId(supabaseAdmin, orgId);
    if (!udfGlAccountId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Undeposited Funds GL account could not be resolved.',
          },
        },
        { status: 422 },
      );
    }

    const paymentIds = payload.paymentTransactionIds ?? [];
    const otherItems = payload.otherItems ?? [];

    let paymentsTotal = 0;
    const paymentRows: Array<{
      id: string;
      amount: number;
      buildium_transaction_id: number | null;
      property_id: string | null;
      unit_id: string | null;
      tenant_id: string | null;
      paid_to_tenant_id: string | null;
    }> = [];
    if (paymentIds.length > 0) {
      const { data: payments, error: payErr } = await supabaseAdmin
        .from('transactions')
        .select(
          `
          id,
          total_amount,
          buildium_transaction_id,
          bank_gl_account_id,
          memo,
          tenant_id,
          paid_to_tenant_id,
          transaction_lines!inner(gl_account_id, amount, posting_type, property_id, unit_id)
        `,
        )
        .in('id', paymentIds)
        .eq('transaction_lines.gl_account_id', udfGlAccountId)
        .limit(1000)
        .returns<PaymentRow[]>();
      if (payErr) throw payErr;

      (payments || []).forEach((row) => {
        if (row.bank_gl_account_id !== udfGlAccountId) return;
        const lineAmount =
          (row.transaction_lines || [])
            .filter((l) => l.gl_account_id === udfGlAccountId)
            .reduce((max: number, l) => {
              const v = Math.abs(Number(l.amount ?? NaN));
              return Number.isFinite(v) && v > max ? v : max;
            }, 0) || 0;
        const amtRaw = Number(row.total_amount ?? 0);
        const lineWithProperty = (row.transaction_lines || []).find(
          (l) => l.gl_account_id === udfGlAccountId && l.property_id,
        );
        const amt = lineAmount > 0 ? lineAmount : amtRaw;
        paymentRows.push({
          id: String(row.id),
          amount: Number.isFinite(amt) ? amt : 0,
          buildium_transaction_id:
            typeof row.buildium_transaction_id === 'number' ? row.buildium_transaction_id : null,
          property_id: lineWithProperty?.property_id ?? null,
          unit_id: lineWithProperty?.unit_id ?? null,
          tenant_id: row.tenant_id ? String(row.tenant_id) : null,
          paid_to_tenant_id: row.paid_to_tenant_id ? String(row.paid_to_tenant_id) : null,
        });
      });
      paymentsTotal = paymentRows.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
    }

    const propertyIds = Array.from(
      new Set(
        [
          ...paymentRows.map((p) => p.property_id).filter(Boolean),
          ...otherItems.map((i) => i.propertyId).filter(Boolean),
        ].map(String),
      ),
    ).slice(0, 500);
    const unitIds = Array.from(
      new Set(
        [
          ...paymentRows.map((p) => p.unit_id).filter(Boolean),
          ...otherItems.map((i) => i.unitId).filter(Boolean),
        ].map(String),
      ),
    ).slice(0, 500);
    const propertyLabelById = new Map<string, string>();
    const propertyBuildiumById = new Map<string, number>();
    if (propertyIds.length > 0) {
      const { data: props } = await supabaseAdmin
        .from('properties')
        .select('id, name, address_line1, buildium_property_id')
        .in('id', propertyIds)
        .limit(1000)
        .returns<PropertyRow[]>();
      (props || []).forEach((p) => {
        const label = `${p?.name || 'Property'}${p?.address_line1 ? ` • ${p.address_line1}` : ''}`;
        if (!p?.id) return;
        const idStr = String(p.id);
        propertyLabelById.set(idStr, label);
        if (typeof p.buildium_property_id === 'number') {
          propertyBuildiumById.set(idStr, p.buildium_property_id);
        }
      });
    }
    const unitLabelById = new Map<string, string>();
    if (unitIds.length > 0) {
      const { data: units } = await supabaseAdmin
        .from('units')
        .select('id, unit_number, unit_name, buildium_unit_id')
        .in('id', unitIds)
        .limit(2000)
        .returns<UnitRow[]>();
      (units || []).forEach((u) => {
        const label = u?.unit_number || u?.unit_name || 'Unit';
        if (u?.id) unitLabelById.set(String(u.id), label);
      });
    }

    const unitBuildiumById = new Map<string, number>();
    if (unitIds.length > 0) {
      const { data: units } = await supabaseAdmin
        .from('units')
        .select('id, buildium_unit_id')
        .in('id', unitIds)
        .limit(2000)
        .returns<UnitRow[]>();
      (units || []).forEach((u) => {
        if (typeof u?.buildium_unit_id === 'number') unitBuildiumById.set(String(u.id), u.buildium_unit_id);
      });
    }

    const tenantIds = new Set<string>();
    paymentRows.forEach((p) => {
      if (p.tenant_id) tenantIds.add(p.tenant_id);
      if (p.paid_to_tenant_id) tenantIds.add(p.paid_to_tenant_id);
    });
    const tenantNameById = new Map<string, string>();
    if (tenantIds.size > 0) {
      const { data: tenants } = await supabaseAdmin
        .from('tenants')
        .select(
          `
          id,
          contacts:contacts!tenants_contact_id_fkey (
            display_name,
            first_name,
            last_name,
            company_name
          )
        `,
        )
        .in('id', Array.from(tenantIds))
        .limit(2000)
        .returns<TenantRow[]>();
      (tenants || []).forEach((t) => {
        const contact = t?.contacts || {};
        const name =
          contact.display_name ||
          [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
          contact.company_name ||
          null;
        if (name && t?.id) tenantNameById.set(String(t.id), name);
      });
    }

    const paidByLabels = new Set<string>();
    paymentRows.forEach((p) => {
      const tenantName =
        (p.tenant_id && tenantNameById.get(p.tenant_id)) ||
        (p.paid_to_tenant_id && tenantNameById.get(p.paid_to_tenant_id)) ||
        null;
      const propLabel = p.property_id ? propertyLabelById.get(String(p.property_id)) : null;
      const unitLabel = p.unit_id ? unitLabelById.get(String(p.unit_id)) : null;
      const fallbackLabel = propLabel ? `${propLabel}${unitLabel ? ` · ${unitLabel}` : ''}` : unitLabel;
      const finalLabel = tenantName || fallbackLabel;
      if (finalLabel) paidByLabels.add(finalLabel);
    });
    const paidByLabel =
      paidByLabels.size > 1
        ? `${Array.from(paidByLabels)[0]} +${paidByLabels.size - 1}`
        : Array.from(paidByLabels)[0] || null;

    const otherTotal = otherItems.reduce((sum, item) => sum + parseCurrencyInput(item.amount), 0);
    const total = paymentsTotal + otherTotal;

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Select at least one payment or add an other deposit item amount.',
          },
        },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();

    const transactionInsert: TablesInsert<'transactions'> = {
      date: payload.date,
      memo: payload.memo ?? null,
      paid_by_label: paidByLabel,
      total_amount: total,
      transaction_type: 'Deposit',
      status: 'Paid',
      org_id: orgId,
      bank_gl_account_id: targetBankAccountId,
      print_receipt: Boolean(payload.printDepositSlips),
      email_receipt: false,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const lineRows: DepositLineInput[] = [];
    lineRows.push({
      gl_account_id: targetBankAccountId,
      amount: total,
      posting_type: 'Debit',
      memo: payload.memo ?? null,
      account_entity_type: 'Company',
      account_entity_id: null,
      date: payload.date,
      property_id: null,
      unit_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (paymentsTotal > 0) {
      lineRows.push({
        gl_account_id: udfGlAccountId,
        amount: paymentsTotal,
        posting_type: 'Credit',
        memo: payload.memo ?? null,
        account_entity_type: 'Company',
        account_entity_id: null,
        date: payload.date,
        property_id: null,
        unit_id: null,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    otherItems.forEach((item) => {
      const amt = parseCurrencyInput(item.amount);
      if (!Number.isFinite(amt) || amt <= 0) return;
      lineRows.push({
        gl_account_id: item.glAccountId,
        amount: amt,
        posting_type: 'Credit',
        memo: item.description ?? payload.memo ?? null,
        account_entity_type: item.propertyId ? 'Rental' : 'Company',
        account_entity_id: null,
        date: payload.date,
        property_id: item.propertyId || null,
        unit_id: item.unitId || null,
        created_at: nowIso,
        updated_at: nowIso,
      });
    });

    const depositItems: DepositItemInput[] = paymentRows.map((p) => ({
      payment_transaction_id: p.id,
      buildium_payment_transaction_id: p.buildium_transaction_id,
      amount: p.amount,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const paymentSplits: DepositPaymentSplitInput[] =
      paymentRows.length > 0
        ? paymentRows.map((p) => {
            const buildiumPropertyId =
              p.property_id != null ? propertyBuildiumById.get(String(p.property_id)) : null;
            const buildiumUnitId = p.unit_id != null ? unitBuildiumById.get(String(p.unit_id)) : null;
            return {
              amount: p.amount,
              buildium_payment_transaction_id: p.buildium_transaction_id,
              accounting_entity_type: buildiumPropertyId ? 'Rental' : null,
              accounting_entity_id: buildiumPropertyId ?? null,
              accounting_unit_id: buildiumUnitId ?? null,
              created_at: nowIso,
              updated_at: nowIso,
            };
          })
        : [];

    const { transactionId: depositTransactionId, depositId } = await createDepositWithMeta({
      transaction: transactionInsert,
      lines: lineRows,
      depositItems,
      paymentSplits,
      buildiumSyncStatus: 'pending',
    });

    // Push to Buildium (best-effort)
    try {
      const bankBuildiumId =
        bankAccount?.buildium_gl_account_id != null
          ? Number(bankAccount.buildium_gl_account_id)
          : null;
      const paymentBuildiumIds = paymentRows
        .map((p) => p.buildium_transaction_id)
        .filter((id): id is number => typeof id === 'number');

      if (bankBuildiumId && (paymentBuildiumIds.length > 0 || otherItems.length > 0)) {
        const buildiumClient = await getOrgScopedBuildiumClient(orgId ?? undefined);

        // Map other deposit items to Buildium lines (only include when GL + property/unit Buildium IDs are present)
        const otherLines: Array<Record<string, unknown>> = [];
        if (otherItems.length > 0) {
          const glIds = Array.from(new Set(otherItems.map((i) => i.glAccountId).filter(Boolean))).slice(0, 500);
          const { data: glRows } = await supabaseAdmin
            .from('gl_accounts')
            .select('id, buildium_gl_account_id')
            .in('id', glIds)
            .returns<GlAccountRow[]>();
          const glBuildiumById = new Map<string, number>();
          (glRows || []).forEach((g) => {
            if (typeof g?.buildium_gl_account_id === 'number') glBuildiumById.set(String(g.id), g.buildium_gl_account_id);
          });

          otherItems.forEach((item) => {
            const amt = parseCurrencyInput(item.amount);
            if (!Number.isFinite(amt) || amt <= 0) return;
            const glBuildiumId = glBuildiumById.get(String(item.glAccountId));
            if (typeof glBuildiumId !== 'number') return;

            let accountingEntity: { Id: number; AccountingEntityType: 'Rental'; UnitId?: number } | null = null;
            if (item.propertyId) {
              const buildiumPropertyId = propertyBuildiumById.get(String(item.propertyId));
              const buildiumUnitId = item.unitId ? unitBuildiumById.get(String(item.unitId)) : undefined;
              if (typeof buildiumPropertyId === 'number') {
                accountingEntity = {
                  Id: buildiumPropertyId,
                  AccountingEntityType: 'Rental',
                  UnitId: typeof buildiumUnitId === 'number' ? buildiumUnitId : undefined,
                };
              }
            }

            otherLines.push({
              GLAccountId: glBuildiumId,
              AccountingEntity: accountingEntity,
              Memo: item.description || payload.memo || undefined,
              Amount: amt,
            });
          });
        }

        const buildiumPayload: Record<string, unknown> = {
          EntryDate: payload.date,
          Memo: payload.memo || undefined,
          PaymentTransactionIds: paymentBuildiumIds,
          Lines: otherLines,
        };

        const buildiumResult = await buildiumClient.makeRequest<Record<string, unknown>>(
          'POST',
          `/bankaccounts/${bankBuildiumId}/deposits`,
          buildiumPayload,
        );

        const buildiumDepositRaw = buildiumResult?.Id ?? (buildiumResult as { id?: unknown })?.id;
        const buildiumDepositId =
          typeof buildiumDepositRaw === 'number'
            ? buildiumDepositRaw
            : Number.isFinite(Number(buildiumDepositRaw))
              ? Number(buildiumDepositRaw)
              : null;
        if (buildiumDepositId != null) {
          const syncedAt = new Date().toISOString();
          await supabaseAdmin
            .from('transactions')
            .update({ buildium_transaction_id: buildiumDepositId, updated_at: syncedAt })
            .eq('id', depositTransactionId);
          await touchDepositMeta(
            depositTransactionId,
            {
              buildium_deposit_id: buildiumDepositId,
              buildium_sync_status: 'synced',
              buildium_sync_error: null,
              buildium_last_synced_at: syncedAt,
            },
            supabaseAdmin,
          );
        }
      }
    } catch (err) {
      console.error('Failed to sync deposit to Buildium', err);
      await touchDepositMeta(
        depositTransactionId,
        {
          buildium_sync_status: 'failed',
          buildium_sync_error: err instanceof Error ? err.message : 'Unknown Buildium sync error',
        },
        supabaseAdmin,
      );
    }

    return NextResponse.json({ data: { transactionId: depositTransactionId, depositId } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to record deposit',
        },
      },
      { status: 500 },
    );
  }
}

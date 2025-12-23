import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import { canonicalUpsertBuildiumBankTransaction } from '@/lib/buildium/canonical-upsert';
import { resolveBuildiumAccountingEntityType } from '@/app/api/journal-entries/buildium-sync';
import type { Database } from '@/types/database';

const parseCurrencyInput = (value: string | null | undefined) => {
  if (typeof value !== 'string') return 0;
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TransactionLineRow = Database['public']['Tables']['transaction_lines']['Row'];
type TransactionLineInsert = Database['public']['Tables']['transaction_lines']['Insert'];
type GlAccountRow = Database['public']['Tables']['gl_accounts']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];

type TransactionContextRow = Pick<
  TransactionRow,
  'id' | 'transaction_type' | 'payment_method' | 'check_number' | 'reference_number' | 'bank_gl_account_id'
>;

type TransactionDetailsRow = Pick<
  TransactionRow,
  | 'id'
  | 'org_id'
  | 'bank_gl_account_id'
  | 'date'
  | 'memo'
  | 'check_number'
  | 'status'
  | 'buildium_transaction_id'
  | 'buildium_bill_id'
  | 'payee_buildium_id'
  | 'payee_buildium_type'
  | 'payee_name'
  | 'vendor_id'
  | 'total_amount'
>;

type VendorContact = {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type VendorRowWithContact = Pick<Database['public']['Tables']['vendors']['Row'], 'id' | 'buildium_vendor_id'> & {
  contact?: VendorContact | null;
};

type OwnerContact = VendorContact & { is_company?: boolean | null };

type OwnerRowWithContact = Pick<Database['public']['Tables']['owners']['Row'], 'id' | 'buildium_owner_id'> & {
  contacts?: OwnerContact | null;
};

type TransactionWithBank = Pick<
  TransactionRow,
  'id' | 'org_id' | 'date' | 'memo' | 'check_number' | 'buildium_transaction_id' | 'payee_buildium_id' | 'payee_buildium_type' | 'bank_gl_account_id'
> & {
  gl_accounts?: Pick<GlAccountRow, 'buildium_gl_account_id'> | null;
};

async function assertCheckInBankAccountContext(params: {
  bankAccountId: string;
  transactionId: string;
}) {
  const { bankAccountId, transactionId } = params;

  const { data: txData, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, payment_method, check_number, reference_number, bank_gl_account_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (txError) throw txError;
  const tx = (txData ?? null) as TransactionContextRow | null;
  if (!tx) return { ok: false as const, status: 404, message: 'Transaction not found' };
  const txType = String(tx.transaction_type ?? '').toLowerCase();
  const paymentMethod = typeof tx.payment_method === 'string' ? tx.payment_method.toLowerCase() : '';
  const hasCheckNumber = Boolean(tx.check_number) || Boolean(tx.reference_number);
  const isCheckTx =
    txType === 'check' ||
    hasCheckNumber ||
    (txType === 'payment' && (paymentMethod === 'check' || hasCheckNumber));
  if (!isCheckTx) {
    return { ok: false as const, status: 400, message: 'Transaction is not a check' };
  }

  if (tx.bank_gl_account_id === bankAccountId) {
    return { ok: true as const, tx };
  }

  const { data: bankLine } = await supabaseAdmin
    .from('transaction_lines')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('gl_account_id', bankAccountId)
    .limit(1)
    .maybeSingle();
  if (!bankLine) {
    return { ok: false as const, status: 404, message: 'Check not found for this bank account' };
  }

  return { ok: true as const, tx };
}

const AllocationSchema = z.object({
  id: z.string().optional(),
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  glAccountId: z.string().min(1),
  description: z.string().max(2000).optional(),
  referenceNumber: z.string().max(255).optional(),
  amount: z.string(),
});

const PatchSchema = z
  .object({
    action: z.enum(['void']).optional(),
    bank_gl_account_id: z.string().nullable().optional(),
    date: z.string().min(1).optional(),
    memo: z.string().max(2000).nullable().optional(),
    check_number: z.string().max(50).nullable().optional(),
    payeeType: z.enum(['Vendor', 'RentalOwner']).optional(),
    payeeId: z.string().min(1).optional(),
    allocations: z.array(AllocationSchema).optional(),
  })
  .refine((data) => (data.action ? true : Boolean(data.date && data.bank_gl_account_id)), {
    message: 'Missing required fields',
    path: ['form'],
  });

type BuildiumCheckLinePayload = {
  GLAccountId: number;
  AccountingEntity: {
    Id: number;
    AccountingEntityType: 'Rental' | 'Association' | 'Commercial';
    UnitId?: number;
  };
  Amount: number;
  Memo?: string | null;
  ReferenceNumber?: string | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  try {
    await requireRole('platform_admin');
    const { id: bankAccountId, transactionId } = await params;

    const membership = await assertCheckInBankAccountContext({ bankAccountId, transactionId });
    if (!membership.ok) {
      return NextResponse.json({ error: membership.message }, { status: membership.status });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = PatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json({ error: issue?.message ?? 'Invalid request' }, { status: 400 });
    }

    const body = parsed.data;
    const now = new Date().toISOString();

    // Load current check details
    const { data: txRow, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, org_id, bank_gl_account_id, date, memo, check_number, status, buildium_transaction_id, buildium_bill_id, payee_buildium_id, payee_buildium_type, payee_name, vendor_id, total_amount',
      )
      .eq('id', transactionId)
      .maybeSingle();
    if (txErr || !txRow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const txDetails = txRow as TransactionDetailsRow;
    const isLockedByBill = Boolean(txDetails.buildium_bill_id);

    // VOID action (local only)
    if (body.action === 'void') {
      const { error: voidErr } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'Cancelled', updated_at: now })
        .eq('id', transactionId);
      if (voidErr) {
        return NextResponse.json({ error: 'Failed to void check' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    const nextBankGlAccountId =
      body.bank_gl_account_id !== undefined
        ? body.bank_gl_account_id
        : txDetails.bank_gl_account_id ?? bankAccountId;

    // Payee mapping
    let payee_buildium_id: number | null = txDetails.payee_buildium_id ?? null;
    let payee_buildium_type: string | null = txDetails.payee_buildium_type ?? null;
    let payee_name: string | null = txDetails.payee_name ?? null;
    let vendor_id: string | null = txDetails.vendor_id ?? null;

    if (body.payeeType && body.payeeId) {
      if (body.payeeType === 'Vendor') {
        const { data: vendor } = await supabaseAdmin
          .from('vendors')
          .select(
            'id, buildium_vendor_id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
          )
          .eq('id', body.payeeId)
          .maybeSingle();
        const buildiumVendorId =
          vendor && typeof (vendor as VendorRowWithContact).buildium_vendor_id === 'number'
            ? (vendor as VendorRowWithContact).buildium_vendor_id
            : null;
        if (!buildiumVendorId) {
          return NextResponse.json({ error: 'Selected vendor is missing a Buildium ID' }, { status: 400 });
        }
        const c = (vendor as VendorRowWithContact | null)?.contact ?? null;
        const display =
          c?.display_name ||
          c?.company_name ||
          [c?.first_name, c?.last_name].filter(Boolean).join(' ') ||
          null;
        vendor_id = vendor?.id ? String(vendor.id) : null;
        payee_buildium_id = buildiumVendorId;
        payee_buildium_type = 'Vendor';
        payee_name = display;
      } else {
        const { data: owner } = await supabaseAdmin
          .from('owners')
          .select('id, buildium_owner_id, contacts!owners_contact_fk(display_name, company_name, first_name, last_name, is_company)')
          .eq('id', body.payeeId)
          .maybeSingle();
        const buildiumOwnerId =
          owner && typeof (owner as OwnerRowWithContact).buildium_owner_id === 'number'
            ? (owner as OwnerRowWithContact).buildium_owner_id
            : null;
        if (!buildiumOwnerId) {
          return NextResponse.json({ error: 'Selected owner is missing a Buildium ID' }, { status: 400 });
        }
        const c = (owner as OwnerRowWithContact | null)?.contacts ?? null;
        const display =
          c?.display_name ||
          (c?.is_company ? c?.company_name : null) ||
          [c?.first_name, c?.last_name].filter(Boolean).join(' ') ||
          null;
        vendor_id = null;
        payee_buildium_id = buildiumOwnerId;
        payee_buildium_type = 'RentalOwner';
        payee_name = display;
      }
    }

    const updateTx: Record<string, unknown> = { updated_at: now };
    if (body.date !== undefined) updateTx.date = body.date;
    if (body.memo !== undefined) updateTx.memo = body.memo ?? null;
    if (body.check_number !== undefined) updateTx.check_number = body.check_number ?? null;
    if (body.bank_gl_account_id !== undefined) updateTx.bank_gl_account_id = nextBankGlAccountId ?? null;
    updateTx.vendor_id = vendor_id;
    updateTx.payee_buildium_id = payee_buildium_id;
    updateTx.payee_buildium_type = payee_buildium_type;
    updateTx.payee_name = payee_name;

    // Update allocations (unless bill-locked)
    let allocationTotal = Number(txDetails.total_amount ?? 0);
    if (Array.isArray(body.allocations) && !isLockedByBill) {
      const allocations = body.allocations;
      allocationTotal = allocations.reduce((sum, line) => sum + parseCurrencyInput(line.amount), 0);
      updateTx.total_amount = allocationTotal;

      // Find current bank-side lines (gl_accounts.is_bank_account)
      const { data: existingLines } = await supabaseAdmin
        .from('transaction_lines')
        .select('id, gl_account_id, posting_type')
        .eq('transaction_id', transactionId)
        .limit(5000);

      const lineIdsToDelete: string[] = [];
      const existingBankLineIds: string[] = [];
      (existingLines as TransactionLineRow[] | null | undefined)?.forEach((l) => {
        const glId = l?.gl_account_id ? String(l.gl_account_id) : null;
        if (!glId) return;
        if (glId === bankAccountId) {
          existingBankLineIds.push(String(l.id));
          return;
        }
        lineIdsToDelete.push(String(l.id));
      });

      if (lineIdsToDelete.length) {
        await supabaseAdmin.from('transaction_lines').delete().in('id', lineIdsToDelete);
      }

      const nextDate = body.date ?? txDetails.date;
      const nextMemo = body.memo !== undefined ? body.memo : txDetails.memo;

      const insertRows: TransactionLineInsert[] = allocations.map((line) => ({
        transaction_id: transactionId,
        gl_account_id: line.glAccountId,
        amount: parseCurrencyInput(line.amount),
        posting_type: 'Debit',
        memo: line.description ? line.description : null,
        reference_number: line.referenceNumber ? line.referenceNumber : null,
        date: nextDate,
        property_id: line.propertyId || null,
        unit_id: line.unitId || null,
        account_entity_type: 'Company',
        account_entity_id: null,
        created_at: now,
        updated_at: now,
      }));

      if (insertRows.length) {
        const { error: insErr } = await supabaseAdmin.from('transaction_lines').insert(insertRows);
        if (insErr) {
          return NextResponse.json({ error: 'Failed to update allocations' }, { status: 500 });
        }
      }

      // Ensure a bank credit line exists
      if (existingBankLineIds.length > 0) {
        await supabaseAdmin
          .from('transaction_lines')
          .update({
            gl_account_id: nextBankGlAccountId,
            amount: allocationTotal,
            posting_type: 'Credit',
            memo: nextMemo ?? null,
            date: nextDate,
            updated_at: now,
          })
          .in('id', existingBankLineIds);
      } else if (nextBankGlAccountId) {
        await supabaseAdmin.from('transaction_lines').insert({
          transaction_id: transactionId,
          gl_account_id: nextBankGlAccountId,
          amount: allocationTotal,
          posting_type: 'Credit',
          memo: nextMemo ?? null,
          date: nextDate,
          property_id: null,
          unit_id: null,
          account_entity_type: 'Company',
          account_entity_id: null,
          created_at: now,
          updated_at: now,
        } satisfies TransactionLineInsert);
      }
    }

    const { error: updateErr } = await supabaseAdmin.from('transactions').update(updateTx).eq('id', transactionId);
    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update check' }, { status: 500 });
    }

    // Best-effort: push update to Buildium using PUT /bankaccounts/{bankAccountId}/checks/{checkId}
    try {
      const { data: refreshedTxData } = await supabaseAdmin
        .from('transactions')
        .select(
          `
          id,
          org_id,
          date,
          memo,
          check_number,
          buildium_transaction_id,
          payee_buildium_id,
          payee_buildium_type,
          bank_gl_account_id,
          gl_accounts!transactions_bank_gl_account_id_fkey(buildium_gl_account_id)
        `,
        )
        .eq('id', transactionId)
        .maybeSingle();
      const refreshedTx = (refreshedTxData ?? null) as TransactionWithBank | null;

      const buildiumCheckId =
        refreshedTx && typeof (refreshedTx.buildium_transaction_id) === 'number'
          ? refreshedTx.buildium_transaction_id
          : null;
      const buildiumBankAccountId =
        refreshedTx?.gl_accounts && typeof refreshedTx.gl_accounts.buildium_gl_account_id === 'number'
          ? refreshedTx.gl_accounts.buildium_gl_account_id
          : null;
      const payeeId =
        refreshedTx && typeof refreshedTx.payee_buildium_id === 'number'
          ? refreshedTx.payee_buildium_id
          : null;
      const payeeType =
        refreshedTx && typeof refreshedTx.payee_buildium_type === 'string'
          ? refreshedTx.payee_buildium_type
          : null;

      if (buildiumCheckId && buildiumBankAccountId && payeeId && payeeType) {
        const { data: lines } = await supabaseAdmin
          .from('transaction_lines')
          .select('gl_account_id, amount, memo, reference_number, property_id, unit_id, posting_type')
          .eq('transaction_id', transactionId)
          .limit(5000);

        const allocationLines = (lines as TransactionLineRow[] | null | undefined)?.filter((l) => {
          const glId = l?.gl_account_id ? String(l.gl_account_id) : null;
          if (!glId) return false;
          if (glId === String(refreshedTx?.bank_gl_account_id ?? '')) return false;
          return String(l?.posting_type ?? '') === 'Debit';
        }) ?? [];

        const glIds = Array.from(new Set(allocationLines.map((l) => String(l.gl_account_id))));
        const propertyIds = Array.from(
          new Set(allocationLines.map((l) => (l?.property_id ? String(l.property_id) : null)).filter(Boolean)),
        ) as string[];
        const unitIds = Array.from(
          new Set(allocationLines.map((l) => (l?.unit_id ? String(l.unit_id) : null)).filter(Boolean)),
        ) as string[];

        const { data: glRows } = await supabaseAdmin
          .from('gl_accounts')
          .select('id, buildium_gl_account_id')
          .in('id', glIds);
        let propRows: PropertyRow[] = [];
        if (propertyIds.length) {
          const { data } = await supabaseAdmin
            .from('properties')
            .select('id, buildium_property_id, rental_type')
            .in('id', propertyIds);
          propRows = (data ?? []) as PropertyRow[];
        }
        let unitRows: UnitRow[] = [];
        if (unitIds.length) {
          const { data } = await supabaseAdmin.from('units').select('id, buildium_unit_id').in('id', unitIds);
          unitRows = (data ?? []) as UnitRow[];
        }

        const glBuildiumById = new Map<string, number>();
        (glRows as GlAccountRow[] | null | undefined)?.forEach((g) => {
          if (typeof g?.buildium_gl_account_id === 'number') glBuildiumById.set(String(g.id), g.buildium_gl_account_id);
        });

        const propBuildiumById = new Map<string, { id: number; rentalType: string | null }>();
        (propRows || []).forEach((p) => {
          if (typeof p?.buildium_property_id === 'number')
            propBuildiumById.set(String(p.id), {
              id: p.buildium_property_id,
              rentalType: typeof p?.rental_type === 'string' ? p.rental_type : null,
            });
        });

        const unitBuildiumById = new Map<string, number>();
        (unitRows || []).forEach((u) => {
          if (typeof u?.buildium_unit_id === 'number') unitBuildiumById.set(String(u.id), u.buildium_unit_id);
        });

        const buildiumLines: BuildiumCheckLinePayload[] = allocationLines
          .map((l) => {
            const glBuildiumId = glBuildiumById.get(String(l.gl_account_id));
            if (!glBuildiumId) return null;
            const propIdLocal = l?.property_id ? String(l.property_id) : null;
            const propMeta = propIdLocal ? propBuildiumById.get(propIdLocal) : null;
            if (!propMeta) return null;

            const accountingEntityType = resolveBuildiumAccountingEntityType(propMeta.rentalType);
            const unitIdLocal = l?.unit_id ? String(l.unit_id) : null;
            const unitBuildiumId = unitIdLocal ? unitBuildiumById.get(unitIdLocal) : undefined;

            return {
              GLAccountId: glBuildiumId,
              AccountingEntity: {
                Id: propMeta.id,
                AccountingEntityType: accountingEntityType,
                UnitId: typeof unitBuildiumId === 'number' ? unitBuildiumId : undefined,
              },
              Amount: Number(l?.amount ?? 0),
              Memo: l?.memo ? String(l.memo) : null,
              ReferenceNumber: l?.reference_number ? String(l.reference_number) : null,
            };
          })
          .filter((line): line is BuildiumCheckLinePayload => Boolean(line));

        const payload: Record<string, unknown> = {
          Payee: { Id: payeeId, Type: payeeType },
          EntryDate: refreshedTx?.date,
          CheckNumber: refreshedTx?.check_number ?? null,
          Memo: refreshedTx?.memo ?? null,
          Lines: buildiumLines,
        };

        const orgId = refreshedTx?.org_id || undefined;
        const buildiumClient = await getOrgScopedBuildiumClient(orgId ?? undefined);
        await buildiumClient.makeRequest(
          'PUT',
          `/bankaccounts/${buildiumBankAccountId}/checks/${buildiumCheckId}`,
          payload,
        );

        await canonicalUpsertBuildiumBankTransaction({
          bankAccountId: buildiumBankAccountId,
          transactionId: buildiumCheckId,
        });
      }
    } catch {
      // Best-effort: never block local updates on Buildium.
    }

    return NextResponse.json({ success: true, total_amount: allocationTotal });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update check' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  try {
    await requireRole('platform_admin');
    const { id: bankAccountId, transactionId } = await params;

    const membership = await assertCheckInBankAccountContext({ bankAccountId, transactionId });
    if (!membership.ok) {
      return NextResponse.json({ error: membership.message }, { status: membership.status });
    }

    const { error: deleteErr } = await supabaseAdmin.from('transactions').delete().eq('id', transactionId);
    if (deleteErr) {
      return NextResponse.json({ error: 'Failed to delete check' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete check' },
      { status: 500 },
    );
  }
}

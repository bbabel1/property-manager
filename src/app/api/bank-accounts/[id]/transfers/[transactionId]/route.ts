import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { buildCanonicalTransactionPatch } from '@/lib/transaction-canonical';
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import type { Tables } from '@/types/database';

type GlAccountRow = Tables<'gl_accounts'>;
type TransactionRow = Tables<'transactions'>;
type PropertyRow = Tables<'properties'>;
type UnitRow = Tables<'units'>;

const parseAmount = (value: string) => {
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PatchSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('transfer'),
    date: z.string().min(1),
    propertyId: z.string().nullable().optional(),
    unitId: z.string().nullable().optional(),
    fromBankAccountId: z.string().min(1),
    toBankAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    mode: z.literal('deposit'),
    date: z.string().min(1),
    propertyId: z.string().nullable().optional(),
    unitId: z.string().nullable().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    mode: z.literal('withdrawal'),
    date: z.string().min(1),
    propertyId: z.string().nullable().optional(),
    unitId: z.string().nullable().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).nullable().optional(),
  }),
]);

async function assertTransferInBankAccountContext(params: {
  bankAccountId: string;
  transactionId: string;
}) {
  const { bankAccountId, transactionId } = params;

  const { data: tx, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, bank_gl_account_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (txError) throw txError;
  if (!tx) return { ok: false as const, status: 404, message: 'Transaction not found' };

  // Must be reachable from the bank account page context.
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
  if (!bankLine)
    return { ok: false as const, status: 404, message: 'Transfer not found for this bank account' };

  return { ok: true as const, tx };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  try {
    await requireRole('platform_admin');
    const { id: bankAccountId, transactionId } = await params;

    const membership = await assertTransferInBankAccountContext({ bankAccountId, transactionId });
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
    const amount = Math.abs(parseAmount(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }
    if (body.mode === 'transfer' && body.fromBankAccountId === body.toBankAccountId) {
      return NextResponse.json(
        { error: 'Transfer from and transfer to must be different bank accounts.' },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();

    const bankAccountIdForHeader =
      body.mode === 'transfer' ? body.fromBankAccountId : body.bankAccountId;

    // Validate bank + offset accounts exist
    if (body.mode === 'transfer') {
      const [{ data: fromAccount }, { data: toAccount }] = await Promise.all([
        supabaseAdmin
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', body.fromBankAccountId)
          .maybeSingle(),
        supabaseAdmin
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', body.toBankAccountId)
          .maybeSingle(),
      ]);
      if (!fromAccount || fromAccount.is_bank_account !== true) {
        return NextResponse.json(
          { error: 'Transfer-from bank account not found.' },
          { status: 404 },
        );
      }
      if (!toAccount || toAccount.is_bank_account !== true) {
        return NextResponse.json({ error: 'Transfer-to bank account not found.' }, { status: 404 });
      }
    } else {
      const [{ data: bankAccount }, { data: glAccount }] = await Promise.all([
        supabaseAdmin
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', body.bankAccountId)
          .maybeSingle(),
        supabaseAdmin
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', body.glAccountId)
          .maybeSingle(),
      ]);
      if (!bankAccount || bankAccount.is_bank_account !== true) {
        return NextResponse.json({ error: 'Bank account not found.' }, { status: 404 });
      }
      if (!glAccount || glAccount.is_bank_account === true) {
        return NextResponse.json({ error: 'Offsetting GL account not found.' }, { status: 404 });
      }
    }

    // Resolve labels + Buildium AccountingEntity for canonical paid-by fields
    let propertyLabel: string | null = null;
    let unitLabel: string | null = null;
    let buildiumPropertyId: number | null = null;
    let buildiumUnitId: number | null = null;

    if (body.propertyId) {
      const { data: propertyRow } = await supabaseAdmin
        .from('properties')
        .select('name, address_line1, buildium_property_id')
        .eq('id', body.propertyId)
        .maybeSingle();
      buildiumPropertyId =
        propertyRow && typeof propertyRow.buildium_property_id === 'number'
          ? propertyRow.buildium_property_id
          : null;
      if (buildiumPropertyId == null) {
        return NextResponse.json(
          {
            error:
              'Selected property is not linked to Buildium. Link the property before assigning it to a transfer.',
          },
          { status: 422 },
        );
      }

      propertyLabel = propertyRow?.name || propertyRow?.address_line1 || 'Property';

      if (body.unitId) {
        const { data: unitRow } = await supabaseAdmin
          .from('units')
          .select('unit_number, unit_name, buildium_unit_id')
          .eq('id', body.unitId)
          .maybeSingle();
        if (unitRow && typeof unitRow.buildium_unit_id === 'number') {
          buildiumUnitId = unitRow.buildium_unit_id;
        }
        unitLabel = unitRow?.unit_number || unitRow?.unit_name || null;
      }
    }

    const canonicalPatch = buildCanonicalTransactionPatch({
      paidByCandidates: [
        body.propertyId
          ? {
              accountingEntityId: buildiumPropertyId,
              accountingEntityType: 'Rental',
              accountingUnitId: buildiumUnitId,
              amount,
            }
          : { accountingEntityType: 'Company', accountingEntityId: 0, amount },
      ],
      labelContext: body.propertyId ? { propertyName: propertyLabel, unitLabel } : undefined,
    });

    // Update transaction header
    // IMPORTANT: For "Record other transaction" / "Edit other transaction", keep the local
    // `transactions.transaction_type` as "Other" regardless of the selected mode.
    // Buildium models these as "Other" with different posting structures/endpoints.
    const transactionType = 'Other';

    const { error: updateTxErr } = await supabaseAdmin
      .from('transactions')
      .update({
        date: body.date,
        memo: body.memo ?? null,
        total_amount: amount,
        bank_gl_account_id: bankAccountIdForHeader,
        transaction_type: transactionType,
        updated_at: nowIso,
        ...canonicalPatch,
      })
      .eq('id', transactionId);
    if (updateTxErr) {
      return NextResponse.json({ error: 'Failed to update transfer' }, { status: 500 });
    }

    // Build lines to match the selected mode
    const commonLine = {
      amount,
      memo: body.memo ?? null,
      date: body.date,
      property_id: body.propertyId ?? null,
      unit_id: body.unitId ?? null,
      account_entity_type: body.propertyId ? 'Rental' : 'Company',
      account_entity_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const lines =
      body.mode === 'transfer'
        ? [
            {
              ...commonLine,
              gl_account_id: body.fromBankAccountId,
              posting_type: 'Credit' as const,
            },
            { ...commonLine, gl_account_id: body.toBankAccountId, posting_type: 'Debit' as const },
          ]
        : body.mode === 'deposit'
          ? [
              { ...commonLine, gl_account_id: body.bankAccountId, posting_type: 'Debit' as const },
              { ...commonLine, gl_account_id: body.glAccountId, posting_type: 'Credit' as const },
            ]
          : [
              { ...commonLine, gl_account_id: body.bankAccountId, posting_type: 'Credit' as const },
              { ...commonLine, gl_account_id: body.glAccountId, posting_type: 'Debit' as const },
            ];

    // Use SQL function for atomic replace with locking and validation
    const { error: replaceErr } = await supabaseAdmin.rpc('replace_transaction_lines', {
      p_transaction_id: transactionId,
      p_lines: lines.map((line) => ({
        gl_account_id: line.gl_account_id,
        amount: line.amount,
        posting_type: line.posting_type,
        memo: line.memo,
        account_entity_type: line.account_entity_type,
        account_entity_id: line.account_entity_id,
        property_id: line.property_id,
        unit_id: line.unit_id,
        buildium_property_id: null,
        buildium_unit_id: null,
        buildium_lease_id: null,
        date: line.date,
        created_at: line.created_at,
        updated_at: line.updated_at,
      })),
      p_validate_balance: true,
    });

    if (replaceErr) {
      return NextResponse.json({ error: 'Failed to update transaction lines' }, { status: 500 });
    }

    // Best-effort sync to Buildium (per Open API, powered by Buildium (v1))
    // Note: Buildium uses a single transaction ID across all modes (transfer/deposit/withdrawal).
    // We call the appropriate endpoint based on the selected mode, but always use the same
    // buildium_transaction_id stored in transactions.buildium_transaction_id.
    try {
      const { data: txRow } = await supabaseAdmin
        .from('transactions')
        .select(
          `
          id,
          org_id,
          buildium_transaction_id,
          bank_gl_account_id,
          gl_accounts!transactions_bank_gl_account_id_fkey(buildium_gl_account_id)
        `,
        )
        .eq('id', transactionId)
        .maybeSingle();

      const buildiumTxnId =
        txRow && typeof (txRow as TransactionRow).buildium_transaction_id === 'number'
          ? (txRow as TransactionRow).buildium_transaction_id
          : null;
      const buildiumBankId =
        txRow?.gl_accounts && typeof txRow.gl_accounts.buildium_gl_account_id === 'number'
          ? txRow.gl_accounts.buildium_gl_account_id
          : null;

      if (buildiumTxnId && buildiumBankId) {
        const orgId = txRow.org_id ?? undefined;
        const buildiumClient = await getOrgScopedBuildiumClient(orgId);

        // Resolve Buildium property/unit IDs
        let buildiumPropertyId: number | null = null;
        let buildiumUnitId: number | null = null;
        if (body.propertyId) {
          const { data: propRow } = await supabaseAdmin
            .from('properties')
            .select('buildium_property_id')
            .eq('id', body.propertyId)
            .maybeSingle();
          buildiumPropertyId =
            propRow && typeof (propRow as PropertyRow).buildium_property_id === 'number'
              ? (propRow as PropertyRow).buildium_property_id
              : null;

          if (body.unitId) {
            const { data: unitRow } = await supabaseAdmin
              .from('units')
              .select('buildium_unit_id')
              .eq('id', body.unitId)
              .maybeSingle();
            if (unitRow && typeof (unitRow as UnitRow).buildium_unit_id === 'number') {
              buildiumUnitId = (unitRow as UnitRow).buildium_unit_id;
            }
          }
        }

        const accountingEntity =
          buildiumPropertyId != null
            ? {
                Id: buildiumPropertyId,
                AccountingEntityType: 'Rental' as const,
                UnitId: buildiumUnitId ?? undefined,
              }
            : { Id: 0, AccountingEntityType: 'Company' as const };

        if (body.mode === 'transfer') {
          // PUT /bankaccounts/{bankAccountId}/transfers/{transferId}
          // from: body.fromBankAccountId => buildiumBankId (already derived)
          // to: need Buildium id for toBankAccountId
          const { data: toRow } = await supabaseAdmin
            .from('gl_accounts')
            .select('buildium_gl_account_id')
            .eq('id', body.toBankAccountId)
            .maybeSingle<GlAccountRow>();
          const buildiumToId =
            toRow && typeof (toRow as GlAccountRow).buildium_gl_account_id === 'number'
              ? (toRow as GlAccountRow).buildium_gl_account_id
              : null;

          if (buildiumToId) {
            const payload = {
              EntryDate: body.date,
              TransferToBankAccountId: buildiumToId,
              TotalAmount: amount,
              Memo: body.memo ?? undefined,
              AccountingEntity: accountingEntity,
            };

            await buildiumClient.makeRequest(
              'PUT',
              `/bankaccounts/${buildiumBankId}/transfers/${buildiumTxnId}`,
              payload,
            );
          }
        } else if (body.mode === 'deposit') {
          // PUT /bankaccounts/{bankAccountId}/deposits/{depositId}
          const { data: glRow } = await supabaseAdmin
            .from('gl_accounts')
            .select('buildium_gl_account_id')
            .eq('id', body.glAccountId)
            .maybeSingle();
          const buildiumOffsetId =
            glRow && typeof (glRow as GlAccountRow).buildium_gl_account_id === 'number'
              ? (glRow as GlAccountRow).buildium_gl_account_id
              : null;

          if (buildiumOffsetId) {
            const payload = {
              EntryDate: body.date,
              Memo: body.memo ?? undefined,
              Lines: [
                {
                  GLAccountId: buildiumOffsetId,
                  Amount: amount,
                  AccountingEntity: accountingEntity,
                },
              ],
            };

            await buildiumClient.makeRequest(
              'PUT',
              `/bankaccounts/${buildiumBankId}/deposits/${buildiumTxnId}`,
              payload,
            );
          }
        } else if (body.mode === 'withdrawal') {
          // PUT /bankaccounts/{bankAccountId}/withdrawals/{withdrawalId}
          const { data: glRow } = await supabaseAdmin
            .from('gl_accounts')
            .select('buildium_gl_account_id')
            .eq('id', body.glAccountId)
            .maybeSingle();
          const buildiumOffsetId =
            glRow && typeof (glRow as GlAccountRow).buildium_gl_account_id === 'number'
              ? (glRow as GlAccountRow).buildium_gl_account_id
              : null;

          if (buildiumOffsetId) {
            const payload = {
              EntryDate: body.date,
              OffsetGLAccountId: buildiumOffsetId,
              Amount: amount,
              Memo: body.memo ?? undefined,
              AccountingEntity: accountingEntity,
            };

            await buildiumClient.makeRequest(
              'PUT',
              `/bankaccounts/${buildiumBankId}/withdrawals/${buildiumTxnId}`,
              payload,
            );
          }
        }
      }
    } catch (err) {
      // Best-effort: keep local update even if Buildium sync fails
      console.error('Buildium update failed for transfer/deposit/withdrawal edit', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update transfer' },
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

    const membership = await assertTransferInBankAccountContext({ bankAccountId, transactionId });
    if (!membership.ok) {
      return NextResponse.json({ error: membership.message }, { status: membership.status });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', transactionId);
    if (deleteErr) {
      return NextResponse.json({ error: 'Failed to delete transfer' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete transfer' },
      { status: 500 },
    );
  }
}

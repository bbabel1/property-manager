import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import { buildCanonicalTransactionPatch } from '@/lib/transaction-canonical';

type BuildiumIdResponse = { Id?: number; id?: number };

const parseAmount = (value: string) => {
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PayloadSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('transfer'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    fromBankAccountId: z.string().min(1),
    toBankAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
  z.object({
    mode: z.literal('deposit'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
  z.object({
    mode: z.literal('withdrawal'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
]);

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

    const nowIso = new Date().toISOString();
    const data = parsed.data;

    if (data.mode === 'transfer') {
      const amount = parseAmount(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Amount must be greater than zero.' } },
          { status: 400 },
        );
      }
      if (data.fromBankAccountId === data.toBankAccountId) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Transfer from and transfer to must be different bank accounts.',
            },
          },
          { status: 400 },
        );
      }

      const [{ data: fromAccount }, { data: toAccount }] = await Promise.all([
        supabaseAdmin
          .from('gl_accounts')
          .select('id, org_id, buildium_gl_account_id')
          .eq('id', data.fromBankAccountId)
          .eq('is_bank_account', true)
          .maybeSingle(),
        supabaseAdmin
          .from('gl_accounts')
          .select('id, buildium_gl_account_id')
          .eq('id', data.toBankAccountId)
          .eq('is_bank_account', true)
          .maybeSingle(),
      ]);

      if (!fromAccount) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Transfer-from bank account not found.' } },
          { status: 404 },
        );
      }
      if (!toAccount) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Transfer-to bank account not found.' } },
          { status: 404 },
        );
      }

      const buildiumFromId =
        typeof fromAccount?.buildium_gl_account_id === 'number' ? fromAccount.buildium_gl_account_id : null;
      const buildiumToId =
        typeof toAccount?.buildium_gl_account_id === 'number' ? toAccount.buildium_gl_account_id : null;

      if (!buildiumFromId || !buildiumToId) {
        return NextResponse.json(
          {
            error: {
              code: 'UNPROCESSABLE_ENTITY',
              message: 'Both bank accounts must be linked to Buildium before creating a transfer.',
            },
          },
          { status: 422 },
        );
      }

      let accountingEntity:
        | {
            Id: number;
            AccountingEntityType: 'Rental' | 'Company' | 'Association';
            UnitId?: number;
          }
        | null = null;
      let propertyLabel: string | null = null;
      let unitLabel: string | null = null;
      let companyLabel: string | null = null;

      const orgId = fromAccount?.org_id;
      if (orgId) {
        const { data: orgRow } = await supabaseAdmin
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .maybeSingle();
        companyLabel = orgRow?.name ?? null;
      }

      if (data.propertyId) {
        const { data: propertyRow } = await supabaseAdmin
          .from('properties')
          .select('name, address_line1, buildium_property_id')
          .eq('id', data.propertyId)
          .maybeSingle();
        const buildiumPropertyId =
          propertyRow && typeof propertyRow.buildium_property_id === 'number'
            ? propertyRow.buildium_property_id
            : null;

        if (buildiumPropertyId == null) {
          return NextResponse.json(
            {
              error: {
                code: 'UNPROCESSABLE_ENTITY',
                message:
                  'Selected property is not linked to Buildium. Link the property before creating a transfer.',
              },
            },
            { status: 422 },
          );
        }

        let buildiumUnitId: number | undefined;
        if (data.unitId) {
          const { data: unitRow } = await supabaseAdmin
            .from('units')
            .select('unit_number, unit_name, buildium_unit_id')
            .eq('id', data.unitId)
            .maybeSingle();
          if (unitRow && typeof unitRow.buildium_unit_id === 'number') {
            buildiumUnitId = unitRow.buildium_unit_id;
          }
          unitLabel = unitRow?.unit_number || unitRow?.unit_name || null;
        }

        propertyLabel = propertyRow?.name || propertyRow?.address_line1 || 'Property';

        accountingEntity = {
          Id: buildiumPropertyId,
          AccountingEntityType: 'Rental',
          UnitId: buildiumUnitId,
        };
      } else {
        accountingEntity = { Id: 0, AccountingEntityType: 'Company' };
      }

      const buildiumClient = await getOrgScopedBuildiumClient(fromAccount?.org_id ?? undefined);
      const buildiumPayload = {
        EntryDate: data.date,
        TransferToBankAccountId: buildiumToId,
        TotalAmount: amount,
        Memo: data.memo ?? undefined,
        AccountingEntity: accountingEntity ?? undefined,
      };

      let buildiumTransferId: number | null = null;
      try {
        const buildiumResponse = await buildiumClient.makeRequest<BuildiumIdResponse>(
          'POST',
          `/bankaccounts/${buildiumFromId}/transfers`,
          buildiumPayload,
        );
        buildiumTransferId =
          typeof buildiumResponse?.Id === 'number'
            ? buildiumResponse.Id
            : typeof buildiumResponse?.id === 'number'
              ? buildiumResponse.id
              : null;
      } catch (err) {
        return NextResponse.json(
          {
            error: {
              code: 'BUILDIUM_ERROR',
              message:
                err instanceof Error
                  ? err.message
                  : 'Failed to create Buildium transfer (bankaccounts/{bankAccountId}/transfers).',
            },
          },
          { status: 502 },
        );
      }

      const canonicalPatch = buildCanonicalTransactionPatch({
        paidByCandidates: [
          accountingEntity
            ? {
                accountingEntityId: accountingEntity.Id,
                accountingEntityType: accountingEntity.AccountingEntityType,
                accountingUnitId: accountingEntity.UnitId,
                amount,
              }
            : { accountingEntityType: 'Company', accountingEntityId: 0, amount },
        ],
        labelContext: data.propertyId
          ? { propertyName: propertyLabel, unitLabel }
          : { propertyName: companyLabel || 'Company' },
      });

      // Create local transaction after Buildium succeeds to keep systems aligned.
      const { data: tx, error: txErr } = await supabaseAdmin
        .from('transactions')
        .insert({
          date: data.date,
          memo: data.memo ?? null,
          total_amount: amount,
          transaction_type: 'Other',
          status: 'Paid',
          org_id: fromAccount?.org_id ?? null,
          bank_gl_account_id: data.fromBankAccountId,
          buildium_transaction_id: buildiumTransferId,
          created_at: nowIso,
          updated_at: nowIso,
          ...canonicalPatch,
        })
        .select('id')
        .maybeSingle();
      if (txErr || !tx?.id) throw txErr ?? new Error('Failed to create transfer');

      const lines = [
        {
          transaction_id: tx.id,
          gl_account_id: data.fromBankAccountId,
          amount,
          posting_type: 'Credit',
          memo: data.memo ?? null,
          account_entity_type: data.propertyId ? 'Rental' : 'Company',
          account_entity_id: null,
          date: data.date,
          property_id: data.propertyId ?? null,
          unit_id: data.unitId ?? null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          transaction_id: tx.id,
          gl_account_id: data.toBankAccountId,
          amount,
          posting_type: 'Debit',
          memo: data.memo ?? null,
          account_entity_type: data.propertyId ? 'Rental' : 'Company',
          account_entity_id: null,
          date: data.date,
          property_id: data.propertyId ?? null,
          unit_id: data.unitId ?? null,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ];
      const { error: lineErr } = await supabaseAdmin.from('transaction_lines').insert(lines);
      if (lineErr) throw lineErr;

      return NextResponse.json(
        { data: { transactionId: String(tx.id), buildiumTransferId: buildiumTransferId ?? undefined } },
        { status: 201 },
      );
    }

    // Deposit / Withdrawal
    const amount = parseAmount(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Amount must be greater than zero.' } },
        { status: 400 },
      );
    }

    const bankId = data.bankAccountId || pageBankAccountId;
    const { data: bankAccount } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, org_id')
      .eq('id', bankId)
      .eq('is_bank_account', true)
      .maybeSingle();
    if (!bankAccount) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Bank account not found.' } },
        { status: 404 },
      );
    }

    let propertyLabel: string | null = null;
    let unitLabel: string | null = null;
    let buildiumPropertyId: number | null = null;
    let buildiumUnitId: number | undefined;
    let companyLabel: string | null = null;

    if (bankAccount?.org_id) {
      const { data: orgRow } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', bankAccount.org_id)
        .maybeSingle();
      companyLabel = orgRow?.name ?? null;
    }

    if (data.propertyId) {
      const { data: propertyRow } = await supabaseAdmin
        .from('properties')
        .select('name, address_line1, buildium_property_id')
        .eq('id', data.propertyId)
        .maybeSingle();
      buildiumPropertyId =
        propertyRow && typeof propertyRow.buildium_property_id === 'number'
          ? propertyRow.buildium_property_id
          : null;
      propertyLabel = propertyRow?.name || propertyRow?.address_line1 || 'Property';

      if (buildiumPropertyId == null) {
        return NextResponse.json(
          {
            error: {
              code: 'UNPROCESSABLE_ENTITY',
              message: 'Selected property is not linked to Buildium. Link the property before continuing.',
            },
          },
          { status: 422 },
        );
      }

      if (data.unitId) {
        const { data: unitRow } = await supabaseAdmin
          .from('units')
          .select('unit_number, unit_name, buildium_unit_id')
          .eq('id', data.unitId)
          .maybeSingle();
        if (unitRow && typeof unitRow.buildium_unit_id === 'number') {
          buildiumUnitId = unitRow.buildium_unit_id;
        }
        unitLabel = unitRow?.unit_number || unitRow?.unit_name || null;
      }
    }

    const canonicalPatch = buildCanonicalTransactionPatch({
      paidByCandidates: [
        data.propertyId
          ? {
              accountingEntityId: buildiumPropertyId ?? undefined,
              accountingEntityType: 'Rental',
              accountingUnitId: buildiumUnitId,
              amount,
            }
          : { accountingEntityType: 'Company', accountingEntityId: 0, amount },
      ],
      labelContext: data.propertyId
        ? { propertyName: propertyLabel, unitLabel }
        : { propertyName: companyLabel || 'Company' },
    });

    // IMPORTANT: For "Record other transaction", keep the local `transactions.transaction_type`
    // as "Other" regardless of the selected mode to mirror Buildium's backend modeling.
    const transactionType = 'Other';
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        date: data.date,
        memo: data.memo ?? null,
        total_amount: amount,
        transaction_type: transactionType,
        status: 'Paid',
        org_id: bankAccount?.org_id ?? null,
        bank_gl_account_id: bankId,
        created_at: nowIso,
        updated_at: nowIso,
        ...canonicalPatch,
      })
      .select('id')
      .maybeSingle();
    if (txErr || !tx?.id) throw txErr ?? new Error('Failed to create transaction');

    const bankPostingType = data.mode === 'deposit' ? 'Debit' : 'Credit';
    const otherPostingType = data.mode === 'deposit' ? 'Credit' : 'Debit';

    const lines = [
      {
        transaction_id: tx.id,
        gl_account_id: bankId,
        amount,
        posting_type: bankPostingType,
        memo: data.memo ?? null,
        account_entity_type: data.propertyId ? 'Rental' : 'Company',
        account_entity_id: null,
        date: data.date,
        property_id: data.propertyId ?? null,
        unit_id: data.unitId ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        transaction_id: tx.id,
        gl_account_id: data.glAccountId,
        amount,
        posting_type: otherPostingType,
        memo: data.memo ?? null,
        account_entity_type: data.propertyId ? 'Rental' : 'Company',
        account_entity_id: null,
        date: data.date,
        property_id: data.propertyId ?? null,
        unit_id: data.unitId ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];
    const { error: lineErr } = await supabaseAdmin.from('transaction_lines').insert(lines);
    if (lineErr) throw lineErr;

    // Push to Buildium for deposits / withdrawals (best effort with validation)
    if (data.mode === 'deposit' || data.mode === 'withdrawal') {
      const [{ data: bankBuildiumRow }, { data: glBuildiumRow }] = await Promise.all([
        supabaseAdmin
          .from('gl_accounts')
          .select('buildium_gl_account_id')
          .eq('id', bankId)
          .eq('is_bank_account', true)
          .maybeSingle(),
        supabaseAdmin
          .from('gl_accounts')
          .select('buildium_gl_account_id')
          .eq('id', data.glAccountId)
          .eq('is_bank_account', false)
          .maybeSingle(),
      ]);

      const buildiumBankId =
        bankBuildiumRow && typeof bankBuildiumRow.buildium_gl_account_id === 'number'
          ? bankBuildiumRow.buildium_gl_account_id
          : null;
      const buildiumOffsetGlId =
        glBuildiumRow && typeof glBuildiumRow.buildium_gl_account_id === 'number'
          ? glBuildiumRow.buildium_gl_account_id
          : null;

      if (!buildiumBankId || !buildiumOffsetGlId) {
        return NextResponse.json(
          {
            error: {
              code: 'UNPROCESSABLE_ENTITY',
              message:
                data.mode === 'deposit'
                  ? 'Bank account and offsetting GL account must be linked to Buildium before creating a deposit.'
                  : 'Bank account and offsetting GL account must be linked to Buildium before creating a withdrawal.',
            },
          },
          { status: 422 },
        );
      }

      let accountingEntity:
        | {
            Id: number;
            AccountingEntityType: 'Rental' | 'Company' | 'Association';
            UnitId?: number;
          }
        | null = null;

      if (data.propertyId) {
        accountingEntity = {
          Id: buildiumPropertyId!,
          AccountingEntityType: 'Rental',
          UnitId: buildiumUnitId,
        };
      } else {
        accountingEntity = { Id: 0, AccountingEntityType: 'Company' };
      }

      try {
        const buildiumClient = await getOrgScopedBuildiumClient(bankAccount?.org_id ?? undefined);
        if (data.mode === 'deposit') {
          const payload = {
            EntryDate: data.date,
            Memo: data.memo ?? undefined,
            Lines: [
              {
                GLAccountId: buildiumOffsetGlId,
                Amount: amount,
                AccountingEntity: accountingEntity ?? undefined,
              },
            ],
          };

          const buildiumResponse = await buildiumClient.makeRequest<BuildiumIdResponse>(
            'POST',
            `/bankaccounts/${buildiumBankId}/deposits`,
            payload,
          );

          const buildiumDepositId =
            typeof buildiumResponse?.Id === 'number'
              ? buildiumResponse.Id
              : typeof buildiumResponse?.id === 'number'
                ? buildiumResponse.id
                : null;

          if (buildiumDepositId != null) {
            await supabaseAdmin
              .from('transactions')
              .update({
                buildium_transaction_id: buildiumDepositId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', tx.id);
          }
        } else {
          // Buildium: POST /v1/bankaccounts/{bankAccountId}/withdrawals
          // Payload fields per "Open API, powered by Buildium (v1)" Bank Accounts > Create Withdrawal.
          const payload = {
            EntryDate: data.date,
            OffsetGLAccountId: buildiumOffsetGlId,
            Amount: amount,
            Memo: data.memo ?? undefined,
            AccountingEntity: accountingEntity ?? undefined,
          };

          const buildiumResponse = await buildiumClient.makeRequest<BuildiumIdResponse>(
            'POST',
            `/bankaccounts/${buildiumBankId}/withdrawals`,
            payload,
          );

          const buildiumWithdrawalId =
            typeof buildiumResponse?.Id === 'number'
              ? buildiumResponse.Id
              : typeof buildiumResponse?.id === 'number'
                ? buildiumResponse.id
                : null;

          if (buildiumWithdrawalId != null) {
            await supabaseAdmin
              .from('transactions')
              .update({
                buildium_transaction_id: buildiumWithdrawalId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', tx.id);
          }
        }
      } catch (err) {
        return NextResponse.json(
          {
            error: {
              code: 'BUILDIUM_ERROR',
              message:
                err instanceof Error
                  ? err.message
                  : data.mode === 'deposit'
                    ? 'Failed to create Buildium deposit (bankaccounts/{bankAccountId}/deposits).'
                    : 'Failed to create Buildium withdrawal (bankaccounts/{bankAccountId}/withdrawals).',
            },
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ data: { transactionId: String(tx.id) } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to record transaction',
        },
      },
      { status: 500 },
    );
  }
}

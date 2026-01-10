import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumDepositCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { canonicalUpsertBuildiumBankTransaction } from '@/lib/buildium/canonical-upsert'
import { supabaseAdmin } from '@/lib/db'
import { deriveDepositStatusFromBuildiumPayload } from '@/lib/buildium-mappers'
import type { Database } from '@/types/database'
import type { DepositStatus } from '@/types/deposits'

type DepositResponse = Record<string, unknown>

const coerceNumericId = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const nextDepositStatus = (current: DepositStatus | null | undefined, incoming: DepositStatus): DepositStatus => {
  if (current === 'reconciled' || current === 'voided') return current
  if (incoming === 'reconciled') return 'reconciled'
  return incoming
}

async function upsertDepositMetaForTransaction(params: {
  transactionId: string
  orgId: string | null
  buildiumDepositId: number | null
  status: DepositStatus
}) {
  if (!supabaseAdmin) return
  const { transactionId, orgId, buildiumDepositId, status } = params
  if (!orgId) {
    throw new Error(`Missing org_id for transaction ${transactionId}`)
  }
  const nowIso = new Date().toISOString()
  const orgIdStrict: string = orgId

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('deposit_meta')
    .select('id, status, deposit_id')
    .eq('transaction_id', transactionId)
    .maybeSingle()
  if (existingErr && existingErr.code !== 'PGRST116') throw existingErr

  let depositId = existing?.deposit_id ?? null
  if (!depositId) {
    const { data: generated, error: genErr } = await supabaseAdmin
      .rpc('generate_deposit_id', { transaction_id_param: transactionId })
      .single()
    if (genErr) throw genErr
    depositId =
      (generated as any)?.generate_deposit_id ??
      (generated as any)?.deposit_id ??
      (generated as any)?.id ??
      transactionId
  }
  if (!depositId) {
    throw new Error(`Unable to resolve deposit_id for transaction ${transactionId}`)
  }

  const resolvedStatus = nextDepositStatus((existing?.status as DepositStatus | null) ?? null, status)
  const resolvedDepositId: string = String(depositId ?? transactionId)
  const payload: Omit<
    Database['public']['Tables']['deposit_meta']['Insert'],
    'created_at'
  > = {
    transaction_id: transactionId,
    org_id: orgIdStrict,
    deposit_id: resolvedDepositId,
    status: resolvedStatus,
    buildium_deposit_id: buildiumDepositId ?? null,
    buildium_sync_status: 'synced',
    buildium_sync_error: null,
    buildium_last_synced_at: nowIso,
    updated_at: nowIso,
  }

  if (existing?.id) {
    await supabaseAdmin.from('deposit_meta').update(payload).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('deposit_meta').insert({ ...payload, created_at: nowIso })
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    logger.info({ userId: user.id, action: 'get_buildium_deposits' }, 'Fetching Buildium deposits');

    // Buildium API call
    const response = await buildiumFetch('GET', '/bankaccounts/deposits', undefined, undefined, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const deposits = Array.isArray(response.json) ? (response.json as Record<string, unknown>[]) : [];

    if (deposits.length && supabaseAdmin) {
      const nowIso = new Date().toISOString();
      await Promise.all(
        deposits.map(async (deposit) => {
          const buildiumDepositId =
            coerceNumericId(deposit?.Id) ??
            coerceNumericId(deposit?.TransactionId) ??
            coerceNumericId(deposit?.depositId) ??
            null;
          if (!buildiumDepositId) return;

          const bankAccountId =
            coerceNumericId((deposit as any)?.BankAccountId) ??
            coerceNumericId((deposit as any)?.bankAccountId) ??
            null;

          const status = deriveDepositStatusFromBuildiumPayload(deposit);

          const { data: tx, error: txErr } = await supabaseAdmin
            .from('transactions')
            .select('id, org_id')
            .eq('buildium_transaction_id', buildiumDepositId)
            .maybeSingle();
          if (txErr && txErr.code !== 'PGRST116') throw txErr;

          let transactionId = tx?.id ?? null;
          let orgId = tx?.org_id ?? null;

          if (!transactionId && bankAccountId) {
            try {
              await canonicalUpsertBuildiumBankTransaction({
                bankAccountId,
                transactionId: buildiumDepositId,
              });
              const { data: txAfter } = await supabaseAdmin
                .from('transactions')
                .select('id, org_id')
                .eq('buildium_transaction_id', buildiumDepositId)
                .maybeSingle();
              transactionId = txAfter?.id ?? null;
              orgId = txAfter?.org_id ?? null;
            } catch (err) {
              logger.error(
                { err, buildiumDepositId, bankAccountId },
                'Failed to upsert local deposit during Buildium sync',
              );
            }
          }

          if (!transactionId || !orgId) return;

          try {
            await upsertDepositMetaForTransaction({
              transactionId,
              orgId,
              buildiumDepositId,
              status,
            });
          } catch (err) {
            logger.error(
              { err, buildiumDepositId, transactionId },
              'Failed to upsert deposit_meta during Buildium deposit sync',
            );
            await supabaseAdmin
              .from('deposit_meta')
              .update({
                buildium_sync_status: 'failed',
                buildium_sync_error: err instanceof Error ? err.message : String(err),
                buildium_last_synced_at: nowIso,
                updated_at: nowIso,
              })
              .eq('transaction_id', transactionId);
          }
        }),
      );
    }

    return NextResponse.json({
      success: true,
      data: deposits,
      count: Array.isArray(deposits) ? deposits.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium deposits');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium deposits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    logger.info({ userId: user.id, action: 'create_buildium_deposit' }, 'Creating Buildium deposit');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumDepositCreateSchema);

    // Buildium API call
    const response = await buildiumFetch('POST', '/bankaccounts/deposits', undefined, data, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newDeposit = (response.json ?? {}) as DepositResponse;

    try {
      const bankAccountId =
        coerceNumericId(newDeposit?.BankAccountId) ??
        coerceNumericId(newDeposit?.bankAccountId) ??
        coerceNumericId((data as DepositResponse)?.BankAccountId) ??
        coerceNumericId((data as DepositResponse)?.bankAccountId);
      const transactionId =
        coerceNumericId(newDeposit?.Id) ??
        coerceNumericId(newDeposit?.TransactionId) ??
        coerceNumericId(newDeposit?.id) ??
        coerceNumericId(newDeposit?.transactionId);
      const status = deriveDepositStatusFromBuildiumPayload(newDeposit);
      if (bankAccountId && transactionId) {
        await canonicalUpsertBuildiumBankTransaction({
          bankAccountId,
          transactionId,
        });

        if (supabaseAdmin) {
          const { data: tx } = await supabaseAdmin
            .from('transactions')
            .select('id, org_id')
            .eq('buildium_transaction_id', transactionId)
            .maybeSingle();
          if (tx?.id && tx.org_id) {
            await upsertDepositMetaForTransaction({
              transactionId: tx.id,
              orgId: tx.org_id,
              buildiumDepositId: transactionId,
              status,
            });
          }
        }
      } else {
        logger.warn(
          {
            bankAccountId,
            transactionId,
          },
          'Skipping canonical upsert for deposit; missing bankAccountId or transactionId',
        );
      }
    } catch (err) {
      logger.error({ err }, 'Canonical upsert failed for deposit');
      throw err;
    }

    return NextResponse.json({
      success: true,
      data: newDeposit
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium deposit');
    return NextResponse.json(
      { error: 'Failed to create Buildium deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

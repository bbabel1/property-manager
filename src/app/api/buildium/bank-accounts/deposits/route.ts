import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumDepositCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { canonicalUpsertBuildiumBankTransaction } from '@/lib/buildium/canonical-upsert'

type DepositResponse = Record<string, unknown>

const coerceNumericId = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
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

    const deposits = (response.json ?? []) as unknown[];

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
      if (bankAccountId && transactionId) {
        await canonicalUpsertBuildiumBankTransaction({
          bankAccountId,
          transactionId,
        });
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

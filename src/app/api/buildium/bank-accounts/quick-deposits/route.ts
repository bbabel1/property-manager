import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { canonicalUpsertBuildiumBankTransaction } from '@/lib/buildium/canonical-upsert'

type QuickDepositResponse = Record<string, unknown>

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
    logger.info({ userId: user.id, action: 'get_buildium_quick_deposits' }, 'Fetching Buildium quick deposits');

    // Buildium API call
    const response = await buildiumFetch('GET', '/bankaccounts/quickdeposits', undefined, undefined, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const quickDeposits = (response.json ?? []) as unknown[];

    return NextResponse.json({
      success: true,
      data: quickDeposits,
      count: Array.isArray(quickDeposits) ? quickDeposits.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium quick deposits');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium quick deposits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    logger.info({ userId: user.id, action: 'create_buildium_quick_deposit' }, 'Creating Buildium quick deposit');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', '/bankaccounts/quickdeposits', undefined, body, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newQuickDeposit = (response.json ?? {}) as QuickDepositResponse;

    try {
      const bankAccountId =
        coerceNumericId(newQuickDeposit?.BankAccountId) ??
        coerceNumericId(newQuickDeposit?.bankAccountId) ??
        coerceNumericId((body as QuickDepositResponse)?.BankAccountId) ??
        coerceNumericId((body as QuickDepositResponse)?.bankAccountId);
      const transactionId =
        coerceNumericId(newQuickDeposit?.Id) ??
        coerceNumericId(newQuickDeposit?.TransactionId) ??
        coerceNumericId(newQuickDeposit?.id) ??
        coerceNumericId(newQuickDeposit?.transactionId);
      if (bankAccountId && transactionId) {
        await canonicalUpsertBuildiumBankTransaction({
          bankAccountId,
          transactionId,
        });
      } else {
        logger.warn(
          { bankAccountId, transactionId },
          'Skipping canonical upsert for quick deposit; missing bankAccountId or transactionId',
        );
      }
    } catch (err) {
      logger.error({ err }, 'Canonical upsert failed for quick deposit');
      throw err;
    }

    return NextResponse.json({
      success: true,
      data: newQuickDeposit
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium quick deposit');
    return NextResponse.json(
      { error: 'Failed to create Buildium quick deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

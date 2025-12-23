import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { canonicalUpsertBuildiumBankTransaction } from '@/lib/buildium/canonical-upsert'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    logger.info({ userId: user.id, action: 'get_buildium_quick_deposits' }, 'Fetching Buildium quick deposits');

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/quickdeposits', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const quickDeposits = await response.json();

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
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/quickdeposits', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newQuickDeposit = await response.json();

    try {
      const bankAccountId =
        (newQuickDeposit as any)?.BankAccountId ??
        (newQuickDeposit as any)?.bankAccountId ??
        (body as any)?.BankAccountId ??
        (body as any)?.bankAccountId;
      const transactionId =
        (newQuickDeposit as any)?.Id ??
        (newQuickDeposit as any)?.TransactionId ??
        (newQuickDeposit as any)?.id ??
        (newQuickDeposit as any)?.transactionId;
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

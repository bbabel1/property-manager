import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumWithdrawalCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(_request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    logger.info({ userId: user.id, action: 'get_buildium_withdrawals' }, 'Fetching Buildium withdrawals');

    // Buildium API call
    const response = await buildiumFetch('GET', '/bankaccounts/withdrawals', undefined, undefined, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const withdrawals = (response.json ?? []) as unknown[];

    return NextResponse.json({
      success: true,
      data: withdrawals,
      count: Array.isArray(withdrawals) ? withdrawals.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium withdrawals');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium withdrawals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    logger.info({ userId: user.id, action: 'create_buildium_withdrawal' }, 'Creating Buildium withdrawal');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumWithdrawalCreateSchema);

    // Buildium API call
    const response = await buildiumFetch('POST', '/bankaccounts/withdrawals', undefined, data, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newWithdrawal = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: newWithdrawal
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium withdrawal');
    return NextResponse.json(
      { error: 'Failed to create Buildium withdrawal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

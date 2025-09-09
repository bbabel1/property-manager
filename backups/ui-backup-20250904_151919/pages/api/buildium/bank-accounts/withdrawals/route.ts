import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { BuildiumWithdrawalCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'get_buildium_withdrawals' }, 'Fetching Buildium withdrawals');

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/withdrawals', {
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

    const withdrawals = await response.json();

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
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'create_buildium_withdrawal' }, 'Creating Buildium withdrawal');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumWithdrawalCreateSchema);

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/withdrawals', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newWithdrawal = await response.json();

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

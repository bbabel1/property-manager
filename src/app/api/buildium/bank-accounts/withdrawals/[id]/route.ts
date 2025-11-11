import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { BuildiumWithdrawalUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const user = await requireUser(request);
    const withdrawalId = (await params).id;
    
    logger.info({ userId: user.id, withdrawalId, action: 'get_buildium_withdrawal' }, 'Fetching Buildium withdrawal details');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/withdrawals/${withdrawalId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Withdrawal not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const withdrawal = await response.json();

    return NextResponse.json({
      success: true,
      data: withdrawal
    });

  } catch (error) {
    logger.error({ error, withdrawalId: (await params).id }, 'Error fetching Buildium withdrawal details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium withdrawal details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const user = await requireUser(request);
    const withdrawalId = (await params).id;
    
    logger.info({ userId: user.id, withdrawalId, action: 'update_buildium_withdrawal' }, 'Updating Buildium withdrawal');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumWithdrawalUpdateSchema);

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/withdrawals/${withdrawalId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Withdrawal not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedWithdrawal = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedWithdrawal
    });

  } catch (error) {
    logger.error({ error, withdrawalId: (await params).id }, 'Error updating Buildium withdrawal');
    return NextResponse.json(
      { error: 'Failed to update Buildium withdrawal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

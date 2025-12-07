import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumDepositUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    await requireRole('platform_admin')
    const depositId = (await params).id;
    
    logger.info({ userId: user.id, depositId, action: 'get_buildium_deposit' }, 'Fetching Buildium deposit details');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/deposits/${depositId}`, {
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
          { error: 'Deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const deposit = await response.json();

    return NextResponse.json({
      success: true,
      data: deposit
    });

  } catch (error) {
    logger.error({ error, depositId: (await params).id }, 'Error fetching Buildium deposit details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium deposit details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    await requireRole('platform_admin')
    const depositId = (await params).id;
    
    logger.info({ userId: user.id, depositId, action: 'update_buildium_deposit' }, 'Updating Buildium deposit');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumDepositUpdateSchema);

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/deposits/${depositId}`, {
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
          { error: 'Deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedDeposit = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedDeposit
    });

  } catch (error) {
    logger.error({ error, depositId: (await params).id }, 'Error updating Buildium deposit');
    return NextResponse.json(
      { error: 'Failed to update Buildium deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

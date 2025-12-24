import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quickDepositId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    
    logger.info({ userId: user.id, quickDepositId, action: 'get_buildium_quick_deposit' }, 'Fetching Buildium quick deposit details');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/quickdeposits/${quickDepositId}`, {
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
          { error: 'Quick deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const quickDeposit = await response.json();

    return NextResponse.json({
      success: true,
      data: quickDeposit
    });

  } catch (error) {
    logger.error({ error, quickDepositId }, 'Error fetching Buildium quick deposit details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium quick deposit details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quickDepositId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    
    logger.info({ userId: user.id, quickDepositId, action: 'update_buildium_quick_deposit' }, 'Updating Buildium quick deposit');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/quickdeposits/${quickDepositId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Quick deposit not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedQuickDeposit = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedQuickDeposit
    });

  } catch (error) {
    logger.error({ error, quickDepositId: (await params).id }, 'Error updating Buildium quick deposit');
    return NextResponse.json(
      { error: 'Failed to update Buildium quick deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

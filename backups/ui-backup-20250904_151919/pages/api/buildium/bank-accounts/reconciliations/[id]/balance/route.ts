import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const reconciliationId = params.id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'get_buildium_reconciliation_balance' }, 'Fetching Buildium reconciliation balance');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${reconciliationId}/balance`, {
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
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const balance = await response.json();

    return NextResponse.json({
      success: true,
      data: balance
    });

  } catch (error) {
    logger.error({ error, reconciliationId: params.id }, 'Error fetching Buildium reconciliation balance');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium reconciliation balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const reconciliationId = params.id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'update_buildium_reconciliation_balance' }, 'Updating Buildium reconciliation balance');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${reconciliationId}/balance`, {
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
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedBalance = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedBalance
    });

  } catch (error) {
    logger.error({ error, reconciliationId: params.id }, 'Error updating Buildium reconciliation balance');
    return NextResponse.json(
      { error: 'Failed to update Buildium reconciliation balance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

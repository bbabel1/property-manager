import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'get_buildium_reconciliation' }, 'Fetching Buildium reconciliation details');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${reconciliationId}`, {
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

    const reconciliation = await response.json();

    return NextResponse.json({
      success: true,
      data: reconciliation
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error fetching Buildium reconciliation details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium reconciliation details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'update_buildium_reconciliation' }, 'Updating Buildium reconciliation');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${reconciliationId}`, {
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

    const updatedReconciliation = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedReconciliation
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error updating Buildium reconciliation');
    return NextResponse.json(
      { error: 'Failed to update Buildium reconciliation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'get_buildium_reconciliations' }, 'Fetching Buildium reconciliations');

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/reconciliations', {
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

    const reconciliations = await response.json();

    return NextResponse.json({
      success: true,
      data: reconciliations,
      count: Array.isArray(reconciliations) ? reconciliations.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium reconciliations');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium reconciliations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'create_buildium_reconciliation' }, 'Creating Buildium reconciliation');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/reconciliations', {
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

    const newReconciliation = await response.json();

    return NextResponse.json({
      success: true,
      data: newReconciliation
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium reconciliation');
    return NextResponse.json(
      { error: 'Failed to create Buildium reconciliation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

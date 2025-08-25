import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const reconciliationId = params.id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'unclear_reconciliation_transactions' }, 'Unclearing Buildium reconciliation transactions');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${reconciliationId}/uncleartransactions`, {
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
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error({ error, reconciliationId: params.id }, 'Error unclearing Buildium reconciliation transactions');
    return NextResponse.json(
      { error: 'Failed to unclear Buildium reconciliation transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

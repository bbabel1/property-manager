import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const user = await requireUser(request);
    const reconciliationId = (await params).id;
    
    logger.info({ userId: user.id, reconciliationId, action: 'finalize_reconciliation' }, 'Finalizing Buildium reconciliation');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${reconciliationId}/finalize`, {
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

    // Mark finished in reconciliation_log (and sync date if present)
    try {
      const admin = supabaseAdmin
      if (admin) {
        const recId = Number(reconciliationId)
        const statementEndingDate = (result?.StatementEndingDate ?? result?.statementEndingDate) as string | undefined
        await admin.from('reconciliation_log').upsert({
          buildium_reconciliation_id: recId,
          is_finished: true,
          statement_ending_date: statementEndingDate ?? null,
        }, { onConflict: 'buildium_reconciliation_id' })
      }
    } catch (e) {
      logger.warn({ e, reconciliationId }, 'Reconciliation log upsert (finalize) failed; continuing')
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error({ error, reconciliationId: (await params).id }, 'Error finalizing Buildium reconciliation');
    return NextResponse.json(
      { error: 'Failed to finalize Buildium reconciliation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

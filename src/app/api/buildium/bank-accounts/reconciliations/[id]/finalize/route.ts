import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { supabaseAdmin } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    await requireRole('platform_admin')
    const reconciliationId = (await params).id;
    
    logger.info({ reconciliationId, action: 'finalize_reconciliation' }, 'Finalizing Buildium reconciliation');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', `/bankaccounts/reconciliations/${reconciliationId}/finalize`, undefined, body, undefined);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Reconciliation not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const result = response.json ?? {};

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

/**
 * Monthly Statement PDF Generation API
 *
 * POST /api/monthly-logs/[logId]/generate-pdf
 * Generates a PDF statement and stores it in Supabase storage.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { generateAndStoreMonthlyStatement } from '@/lib/monthly-statement-service';

export async function POST(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Generate and store PDF
    const result = await generateAndStoreMonthlyStatement(logId);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'GENERATION_FAILED', message: result.error || 'Failed to generate PDF' } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      pdfUrl: result.url,
    });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/generate-pdf:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

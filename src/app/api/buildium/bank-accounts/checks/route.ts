import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { BuildiumCheckCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { canonicalUpsertBuildiumBankTransaction } from '@/lib/buildium/canonical-upsert';

type BuildiumCheckResponse = {
  BankAccountId?: number | string;
  bankAccountId?: number | string;
  Id?: number | string;
  TransactionId?: number | string;
  id?: number | string;
  transactionId?: number | string;
};

const BuildiumCheckCreateRequestSchema = BuildiumCheckCreateSchema.extend({
  bankAccountId: z.number().int().positive('Bank account ID must be a positive integer'),
});

export async function GET(_request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    logger.info({ userId: user.id, action: 'get_buildium_checks' }, 'Fetching Buildium checks');

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/checks', {
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

    const checks = await response.json();

    return NextResponse.json({
      success: true,
      data: checks,
      count: Array.isArray(checks) ? checks.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium checks');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium checks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    logger.info({ userId: user.id, action: 'create_buildium_check' }, 'Creating Buildium check');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumCheckCreateRequestSchema);
    const { bankAccountId: requestedBankAccountId, ...buildiumPayload } = data;

    // Buildium API call
    const baseUrl = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
    const response = await fetch(`${baseUrl}/bankaccounts/${requestedBankAccountId}/checks`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(buildiumPayload)
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newCheck: BuildiumCheckResponse = await response.json();

    let localTransactionId: string | null = null;
    try {
      const canonicalBankAccountId =
        newCheck.BankAccountId ??
        newCheck.bankAccountId ??
        requestedBankAccountId;
      const transactionId =
        newCheck.Id ??
        newCheck.TransactionId ??
        newCheck.id ??
        newCheck.transactionId;
      if (canonicalBankAccountId && transactionId) {
        const result = await canonicalUpsertBuildiumBankTransaction({
          bankAccountId: canonicalBankAccountId,
          transactionId,
        });
        localTransactionId = result?.transactionId ?? null;
      } else {
        logger.warn(
          { bankAccountId: canonicalBankAccountId, transactionId },
          'Skipping canonical upsert for check; missing bankAccountId or transactionId',
        );
      }
    } catch (err) {
      logger.error({ err }, 'Canonical upsert failed for check');
      throw err;
    }

    return NextResponse.json(
      {
        success: true,
        data: newCheck,
        transactionId: localTransactionId,
      },
      { status: 201 },
    );

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium check');
    return NextResponse.json(
      { error: 'Failed to create Buildium check', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

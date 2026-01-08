import { NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  createCheckPaymentsForBills,
  type CheckPaymentRequestItem,
} from '@/server/bills/pay-bills-by-check';

type RequestPayload = {
  groups?: {
    bankGlAccountId: string | null;
    queueForPrinting?: boolean;
    items: {
      billId: string;
      bankGlAccountId: string | null;
      payDate: string;
      amount: number;
      memo?: string | null;
      checkNumber?: string | null;
    }[];
  }[];
};

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 },
      );
    }

    await requireRole('platform_admin');

    const body = (await request.json().catch(() => ({}))) as RequestPayload;
    const groups = Array.isArray(body.groups) ? body.groups : [];

    const items: CheckPaymentRequestItem[] = [];
    for (const group of groups) {
      const bankGlAccountId = group.bankGlAccountId ?? null;
      const queueForPrinting = Boolean(group.queueForPrinting);
      const lineItems = Array.isArray(group.items) ? group.items : [];
      for (const item of lineItems) {
        if (!item || !item.billId) continue;
        items.push({
          billId: String(item.billId),
          amount: Number(item.amount ?? 0),
          payDate: String(item.payDate || ''),
          bankGlAccountId: item.bankGlAccountId ?? bankGlAccountId,
          memo: item.memo ?? null,
          checkNumber: item.checkNumber ?? null,
          queueForPrinting,
        });
      }
    }

    if (!items.length) {
      return NextResponse.json(
        { error: 'No payment items were provided' },
        { status: 400 },
      );
    }

    const result = await createCheckPaymentsForBills(items);

    const anySuccess = result.some((r) => r.success);
    const allFailed = result.every((r) => !r.success);
    const status = allFailed ? 400 : anySuccess ? 200 : 207;

    return NextResponse.json(
      {
        success: anySuccess && !allFailed,
        results: result,
      },
      { status },
    );
  } catch (error) {
    logger.error({ error }, 'Error creating bill payments by check');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}


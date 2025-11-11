'use client';

import { describeBuildiumPayload } from '@/lib/buildium-response';

export type DeleteBillResponse = {
  confirmationRequired?: boolean;
  confirmation?: {
    token?: string;
    issuedAt?: string;
    expiresAt?: string;
  };
  buildium?: {
    success?: boolean;
    status?: number;
    payload?: unknown;
  };
  error?: string;
  details?: string;
  success?: boolean;
};

export type BuildiumDeletePrompt = {
  buildium?: DeleteBillResponse['buildium'];
  confirmation: {
    token: string;
    issuedAt: string;
    expiresAt?: string;
  };
};

type InitiateDeleteResult =
  | { status: 'deleted' }
  | { status: 'confirm'; prompt: BuildiumDeletePrompt };

export async function initiateBuildiumDelete(
  billId: string,
): Promise<InitiateDeleteResult> {
  const response = await fetch(`/api/bills/${billId}`, { method: 'DELETE' });
  const body = (await response.json().catch(() => null)) as DeleteBillResponse | null;

  if (!response.ok && !body?.confirmationRequired) {
    throw new Error(formatDeleteError(body));
  }

  if (body?.confirmationRequired) {
    const token = body.confirmation?.token;
    const issuedAt = body.confirmation?.issuedAt;
    if (!token || !issuedAt) {
      throw new Error('Missing Buildium confirmation token');
    }
    return {
      status: 'confirm',
      prompt: {
        buildium: body.buildium,
        confirmation: { token, issuedAt, expiresAt: body.confirmation?.expiresAt },
      },
    };
  }

  if (!response.ok) {
    throw new Error(formatDeleteError(body));
  }

  return { status: 'deleted' };
}

export async function finalizeBuildiumDelete(
  billId: string,
  confirmation: BuildiumDeletePrompt['confirmation'],
): Promise<void> {
  const response = await fetch(`/api/bills/${billId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buildiumConfirmation: {
        token: confirmation.token,
        issuedAt: confirmation.issuedAt,
      },
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as DeleteBillResponse | null;
    throw new Error(formatDeleteError(body));
  }
}

function formatDeleteError(body: DeleteBillResponse | null): string {
  if (!body) return 'Failed to delete bill';
  const buildiumMessage = describeBuildiumPayload(body.buildium?.payload);
  if (buildiumMessage) {
    return buildiumMessage;
  }
  if (typeof body.error === 'string') return body.error;
  if (typeof body.details === 'string') return body.details;
  return 'Failed to delete bill';
}

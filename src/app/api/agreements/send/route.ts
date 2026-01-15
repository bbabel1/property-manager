import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';
import { AgreementSendSchema, type AgreementSendResponse } from '@/schemas/onboarding';
import { logger } from '@/lib/logger';

/**
 * Generate a deterministic hash for idempotency
 */
function generateRecipientHash(
  propertyId: string,
  templateId: string | undefined,
  templateName: string | undefined,
  recipients: Array<{ email: string }>,
): string {
  const sortedEmails = recipients.map((r) => r.email.toLowerCase()).sort();
  const hashInput = [propertyId, templateId || templateName || 'default', ...sortedEmails].join('|');
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * POST /api/agreements/send
 * Send agreement with idempotency
 *
 * - Uses idempotency_keys table (not unique constraint)
 * - Key: hash(propertyId + templateId/name + sorted recipients)
 * - Scoped by org_id, TTL 24h
 * - Creates agreement_send_log first, then sends
 * - Returns 409 with { existingLogId, sentAt, recipients } if match found
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireAuth();
    const body = await request.json();

    // Validate request body
    const parseResult = AgreementSendSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Generate idempotency key
    const recipientHash = generateRecipientHash(
      data.propertyId,
      data.templateId,
      data.templateName,
      data.recipients,
    );
    const idempotencyKey = `agreement_send:${orgId}:${recipientHash}`;

    // Check idempotency_keys table for existing send
    const { data: existingKey, error: keyError } = await db
      .from('idempotency_keys')
      .select('key, response, created_at, expires_at')
      .eq('key', idempotencyKey)
      .eq('org_id', orgId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (keyError) {
      logger.error({ error: keyError }, 'Failed to check idempotency key');
    }

    if (existingKey && existingKey.response) {
      const cachedResponse = existingKey.response as {
        logId: string;
        sentAt: string;
        recipients: Array<{ email: string; name?: string }>;
      };
      return NextResponse.json(
        {
          error: {
            code: 'IDEMPOTENT_MATCH',
            message: 'Agreement already sent within the last 24 hours',
          },
          existingLogId: cachedResponse.logId,
          sentAt: cachedResponse.sentAt,
          recipients: cachedResponse.recipients,
        },
        { status: 409 },
      );
    }

    // Verify property exists and belongs to org
    const { data: property, error: propertyError } = await db
      .from('properties')
      .select('id, name, address_line1, org_id')
      .eq('id', data.propertyId)
      .eq('org_id', orgId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    // Create agreement_send_log record FIRST (before webhook)
    const { data: sendLog, error: logError } = await db
      .from('agreement_send_log')
      .insert({
        property_id: data.propertyId,
        onboarding_id: data.onboardingId || null,
        template_id: data.templateId || null,
        template_name: data.templateName || null,
        recipients: data.recipients,
        recipient_hash: recipientHash,
        status: 'sent', // Optimistically set to sent
        webhook_payload: data.webhookPayload || null,
        org_id: orgId,
      })
      .select()
      .single();

    if (logError || !sendLog) {
      logger.error({ error: logError }, 'Failed to create agreement_send_log');
      return NextResponse.json(
        { error: { code: 'LOG_CREATE_FAILED', message: logError?.message || 'Failed to create log' } },
        { status: 500 },
      );
    }

    // Store in idempotency_keys table
    const idempotencyResponse = {
      logId: sendLog.id,
      sentAt: sendLog.sent_at,
      recipients: data.recipients,
    };

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.from('idempotency_keys').upsert({
      key: idempotencyKey,
      org_id: orgId,
      response: idempotencyResponse,
      expires_at: expiresAt.toISOString(),
    });

    // Call webhook if configured (non-blocking)
    const webhookUrl = process.env.AGREEMENT_WEBHOOK_URL;
    if (webhookUrl && data.webhookPayload) {
      // Fire and forget - don't block the response
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data.webhookPayload,
          property_id: data.propertyId,
          property_name: property.name,
          property_address: property.address_line1,
          recipients: data.recipients,
          sent_at: sendLog.sent_at,
          log_id: sendLog.id,
        }),
      })
        .then(async (response) => {
          // Update log with webhook response
          const webhookResponse = {
            status: response.status,
            statusText: response.statusText,
          };
          await db
            .from('agreement_send_log')
            .update({ webhook_response: webhookResponse })
            .eq('id', sendLog.id);
        })
        .catch(async (error) => {
          logger.error({ error }, 'Webhook call failed');
          await db
            .from('agreement_send_log')
            .update({
              webhook_response: { error: error.message },
            })
            .eq('id', sendLog.id);
        });
    }

    // Update onboarding status to AGREEMENT_SENT if onboardingId provided
    if (data.onboardingId) {
      const { error: updateError } = await db
        .from('property_onboarding')
        .update({
          status: 'AGREEMENT_SENT',
          progress: 100,
        })
        .eq('id', data.onboardingId)
        .eq('org_id', orgId);

      if (updateError) {
        logger.error({ error: updateError }, 'Failed to update onboarding status');
      }
    }

    const response: AgreementSendResponse = {
      logId: sendLog.id,
      status: 'sent',
      sentAt: sendLog.sent_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'POST /api/agreements/send failed');

    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN' || error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: { code: error.message, message: 'Organization access denied' } }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

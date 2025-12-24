/**
 * Monthly Statement Email Service
 *
 * Handles the complete workflow for sending monthly statements via email.
 * Includes recipient management, email generation, and audit logging.
 */

import { format } from 'date-fns';
import { supabaseAdmin } from '@/lib/db';
import type { Database } from '@/types/database';
import { getOwnerDrawSummary } from '@/lib/monthly-log-calculations';
import { calculateNetToOwnerValue } from '@/types/monthly-log';
import {
  generateMonthlyStatementPDF,
  uploadStatementPDF,
  uploadStatementSnapshot,
} from '@/lib/monthly-statement-service';
import { getStaffGmailIntegration } from '@/lib/gmail/token-manager';
import { sendEmailViaGmail } from '@/lib/gmail/send-email';
import { getEmailTemplate, renderEmailTemplate } from '@/lib/email-template-service';
import { buildTemplateVariables } from '@/lib/email-templates/variable-mapping';

interface StatementRecipient {
  email: string;
  name: string;
  role?: string;
}

type StatementProperty = Pick<
  Database['public']['Tables']['properties']['Row'],
  'id' | 'name' | 'org_id' | 'statement_recipients'
>;

type StatementUnit = Pick<Database['public']['Tables']['units']['Row'], 'unit_number' | 'unit_name'>;

type MonthlyLogWithRelations = Pick<
  Database['public']['Tables']['monthly_logs']['Row'],
  'id' | 'period_start' | 'pdf_url' | 'property_id' | 'unit_id' | 'org_id'
> & {
  properties: StatementProperty | null;
  units: StatementUnit | null;
};

type StatementEmailRecipientLog = {
  email: string;
  status: 'sent' | 'failed';
  error?: string | null;
};

type StatementEmailRow = Pick<
  Database['public']['Tables']['statement_emails']['Row'],
  'id' | 'sent_at' | 'sent_by_user_id' | 'recipients' | 'pdf_url' | 'status' | 'error_message'
>;

const coerceRecipients = (raw: unknown): StatementRecipient[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const candidate = item as Partial<StatementRecipient>;
      if (typeof candidate?.email !== 'string' || typeof candidate?.name !== 'string') {
        return null;
      }
      return {
        email: candidate.email,
        name: candidate.name,
        role: typeof candidate.role === 'string' ? candidate.role : undefined,
      };
    })
    .filter(Boolean) as StatementRecipient[];
};

const parseRecipientLog = (raw: unknown): StatementEmailRecipientLog | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { email?: unknown; status?: unknown; error?: unknown };
  if (candidate.status !== 'sent' && candidate.status !== 'failed') return null;
  if (typeof candidate.email !== 'string') return null;

  return {
    email: candidate.email,
    status: candidate.status,
    error: typeof candidate.error === 'string' ? candidate.error : null,
  };
};

const normalizeRecipientLogs = (raw: unknown): StatementEmailRecipientLog[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => parseRecipientLog(entry))
    .filter((entry): entry is StatementEmailRecipientLog => Boolean(entry));
};

interface SendStatementResult {
  success: boolean;
  sentCount?: number;
  failedCount?: number;
  recipients?: Array<{
    email: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
  auditLogId?: string;
  error?: string;
}

/**
 * Get statement recipients for a property
 *
 * @param propertyId - UUID of the property
 * @returns List of configured recipients
 */
export async function getStatementRecipients(
  propertyId: string,
): Promise<{ success: boolean; recipients?: StatementRecipient[]; error?: string }> {
  try {
    const { data: property, error } = await supabaseAdmin
      .from('properties')
      .select('statement_recipients')
      .eq('id', propertyId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const recipients = coerceRecipients(property?.statement_recipients);
    return { success: true, recipients };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recipients',
    };
  }
}

/**
 * Send monthly statement to configured recipients
 *
 * Complete workflow:
 * 1. Fetch property recipients
 * 2. Fetch statement data (PDF URL, financial summary)
 * 3. Generate email content
 * 4. Send emails
 * 5. Log to statement_emails audit table
 *
 * @param monthlyLogId - UUID of the monthly log
 * @param userId - UUID of the user sending the statement (optional)
 * @returns Result with sent/failed counts
 */
export async function sendMonthlyStatement(
  monthlyLogId: string,
  userId?: string,
): Promise<SendStatementResult> {
  try {
    if (!userId) {
      return { success: false, error: 'User ID is required to send statements' };
    }

    // 1. Fetch monthly log data with org_id
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        period_start,
        pdf_url,
        property_id,
        unit_id,
        org_id,
        properties (
          id,
          name,
          org_id,
          statement_recipients
        ),
        units (
          unit_number,
          unit_name
        )
      `,
      )
      .eq('id', monthlyLogId)
      .single();

    const monthlyLogWithRelations = (monthlyLog ?? null) as MonthlyLogWithRelations | null;

    if (logError || !monthlyLogWithRelations) {
      return { success: false, error: 'Monthly log not found' };
    }

    // Get org_id from monthly log or property
    const orgId = monthlyLogWithRelations.org_id || monthlyLogWithRelations.properties?.org_id;
    if (!orgId) {
      return { success: false, error: 'Organization ID not found for this monthly log' };
    }

    // Check for Gmail integration (required)
    const gmailIntegration = await getStaffGmailIntegration(userId, orgId);
    if (!gmailIntegration || !gmailIntegration.is_active) {
      return {
        success: false,
        error: 'Gmail integration not connected. Please connect your Gmail account in Settings > Integrations before sending statements.',
      };
    }

    // 2. Refresh/generate the PDF so we always send the current statement
    const pdfResult = await generateMonthlyStatementPDF(monthlyLogId);
    if (!pdfResult.success || !pdfResult.pdf) {
      return { success: false, error: pdfResult.error || 'Failed to generate statement PDF' };
    }

    // Upload the latest copy (updates monthly_logs.pdf_url) and an immutable snapshot for the history record
    const latestUpload = await uploadStatementPDF(monthlyLogId, pdfResult.pdf);
    if (!latestUpload.success || !latestUpload.url) {
      return { success: false, error: latestUpload.error || 'Failed to upload statement PDF' };
    }

    const snapshotUpload = await uploadStatementSnapshot(monthlyLogId, pdfResult.pdf);
    if (!snapshotUpload.success && snapshotUpload.error) {
      console.warn('Failed to store statement snapshot', snapshotUpload.error);
    }
    const pdfUrlForEmail =
      (snapshotUpload.success && snapshotUpload.url) ||
      latestUpload.url ||
      monthlyLogWithRelations.pdf_url;

    // Get recipients from property
    const recipients = coerceRecipients(monthlyLogWithRelations.properties?.statement_recipients);

    if (recipients.length === 0) {
      return {
        success: false,
        error: 'No recipients configured for this property. Please add recipients first.',
      };
    }

    // 2. Fetch financial summary
    const { data: financialData } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        'charges_amount, payments_amount, bills_amount, escrow_amount, management_fees_amount, previous_lease_balance',
      )
      .eq('id', monthlyLogId)
      .single();

    const _totalCharges = financialData?.charges_amount || 0;
    const totalPayments = financialData?.payments_amount || 0;
    const totalBills = financialData?.bills_amount || 0;
    const escrowAmount = financialData?.escrow_amount || 0;
    const managementFees = financialData?.management_fees_amount || 0;
    const previousBalance = financialData?.previous_lease_balance || 0;

    const ownerDrawSummary = await getOwnerDrawSummary(monthlyLogId);
    const ownerDraw = ownerDrawSummary.total;
    const _netToOwner = calculateNetToOwnerValue({
      previousBalance,
      totalPayments,
      totalBills,
      escrowAmount,
      managementFees,
      ownerDraw,
    });

    // 3. Fetch email template from database (with fallback to hardcoded)
    let template = null;
    let baseVariables: Record<string, unknown> | null = null;
    let templateError: string | null = null;

    try {
      template = await getEmailTemplate(orgId, 'monthly_rental_statement');

      if (template && template.status === 'active') {
        // Build comprehensive variable map (without recipient name - will be set per recipient)
        baseVariables = await buildTemplateVariables(monthlyLogId, orgId);
        console.info('[monthly-statement] Loaded active email template', {
          orgId,
          templateId: template?.id,
          templateKey: template.template_key,
          status: template.status,
          monthlyLogId,
        });
      } else {
        templateError =
          'No active monthly statement email template configured for this organization. Add or activate one in Settings > Templates.';
      }
    } catch (templateError) {
      console.error('Error fetching template for monthly statement:', templateError);
      templateError =
        'Failed to load monthly statement email template. Please try again after confirming the template exists and is active.';
    }

    if (!template || !baseVariables) {
      return {
        success: false,
        error: templateError ?? 'A monthly statement email template is required before sending.',
      };
    }

    // Prepare fallback data
    const periodMonth = format(new Date(monthlyLogWithRelations.period_start), 'MMMM yyyy');
    const propertyName = monthlyLogWithRelations.properties?.name || 'Unknown Property';
    const _unitNumber =
      monthlyLogWithRelations.units?.unit_number ||
      monthlyLogWithRelations.units?.unit_name ||
      'N/A';
    const companyName = process.env.COMPANY_NAME || 'Property Management Company';

    // 4. Send emails to each recipient
    const emailResults: Array<{
      email: string;
      status: 'sent' | 'failed';
      error?: string;
    }> = [];

    // Download PDF for attachment
    let pdfBuffer: Buffer | null = null;
    if (pdfUrlForEmail) {
      try {
        const pdfResponse = await fetch(pdfUrlForEmail, {
          headers: {
            'Accept': 'application/pdf',
          },
        });
        if (pdfResponse.ok) {
          const arrayBuffer = await pdfResponse.arrayBuffer();
          pdfBuffer = Buffer.from(arrayBuffer);
        } else {
          console.warn(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
        }
      } catch (pdfError) {
        console.warn('Failed to download PDF for attachment:', pdfError);
        // Continue without attachment - email will still be sent with link
      }
    }

    // Send emails via Gmail API
    for (const recipient of recipients) {
      let finalSubject = '';
      let finalHtml = '';
      let finalText = '';

      // Use template from database; fail fast if rendering breaks to avoid silent fallback
      try {
        // Set recipient-specific variable
        const variables = { ...baseVariables, recipientName: recipient.name };
        
        // Render template
        const rendered = await renderEmailTemplate(template, variables);
        console.info('[monthly-statement] Rendered email template for recipient', {
          orgId,
          templateId: template?.id,
          monthlyLogId,
          recipientEmail: recipient.email,
          subjectPreview: rendered.subject?.slice?.(0, 120) ?? rendered.subject,
          hasHtml: !!rendered.bodyHtml,
          hasText: !!rendered.bodyText,
          warningCount: rendered.warnings?.length ?? 0,
        });
        
        finalSubject = rendered.subject;
        finalHtml = rendered.bodyHtml;
        finalText = rendered.bodyText || '';
        
        if (rendered.warnings && rendered.warnings.length > 0) {
          console.warn('Template render warnings:', rendered.warnings);
        }
      } catch (renderError) {
        console.error('Error rendering monthly statement template:', renderError);
        return {
          success: false,
          error:
            'Failed to render the monthly statement email template. Please fix the template variables and try again.',
        };
      }

      // Prepare attachments
      const attachments = pdfBuffer
        ? [
            {
              filename: `Monthly-Statement-${propertyName}-${periodMonth}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ]
        : undefined;

      // Send via Gmail API
      const emailResult = await sendEmailViaGmail(
        userId,
        orgId,
        {
          to: [
            {
              email: recipient.email,
              name: recipient.name,
              role: recipient.role,
            },
          ],
          subject: finalSubject,
          html: finalHtml,
          text: finalText,
          from: {
            email: gmailIntegration.email,
            name: companyName,
          },
          attachments,
        }
      );

      emailResults.push({
        email: recipient.email,
        status: emailResult.success ? 'sent' : 'failed',
        error: emailResult.error,
      });
    }

    // 5. Count results
    const sentCount = emailResults.filter((r) => r.status === 'sent').length;
    const failedCount = emailResults.filter((r) => r.status === 'failed').length;

    // 6. Log to audit table
    let auditLogId: string | undefined;
    try {
      const { data: auditLog, error: auditError } = await supabaseAdmin
        .from('statement_emails')
        .insert({
          monthly_log_id: monthlyLogId,
          sent_by_user_id: userId || null,
        recipients: emailResults,
        pdf_url: pdfUrlForEmail,
        status: failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'sent',
        error_message: failedCount > 0 ? `${failedCount} recipient(s) failed` : null,
      })
        .select('id')
        .single();

      if (!auditError && auditLog) {
        auditLogId = auditLog.id;
      }
    } catch (auditError) {
      console.error('Error logging to statement_emails:', auditError);
      // Don't fail the whole operation if audit logging fails
    }

    return {
      success: sentCount > 0,
      sentCount,
      failedCount,
      recipients: emailResults,
      auditLogId,
      error: failedCount === emailResults.length ? 'All emails failed to send' : undefined,
    };
  } catch (error) {
    console.error('Error sending monthly statement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send statement',
    };
  }
}

/**
 * Resend a monthly statement (from audit log)
 *
 * @param statementEmailId - UUID of the statement_emails record
 * @param userId - UUID of the user resending the statement
 * @returns Result with sent/failed counts
 */
export async function resendMonthlyStatement(
  statementEmailId: string,
  userId?: string,
): Promise<SendStatementResult> {
  try {
    // Fetch original statement email record
    const { data: statementEmail, error } = await supabaseAdmin
      .from('statement_emails')
      .select('monthly_log_id')
      .eq('id', statementEmailId)
      .single();

    if (error || !statementEmail) {
      return { success: false, error: 'Statement email record not found' };
    }

    // Send using the monthly log ID
    return await sendMonthlyStatement(statementEmail.monthly_log_id, userId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend statement',
    };
  }
}

/**
 * Get statement email history for a monthly log
 *
 * @param monthlyLogId - UUID of the monthly log
 * @returns List of statement email records
 */
export async function getStatementEmailHistory(monthlyLogId: string): Promise<{
  success: boolean;
  history?: Array<{
    id: string;
    sentAt: string;
    sentBy: string | null;
    recipients: StatementEmailRecipientLog[];
    pdfUrl: string | null;
    status: string;
    errorMessage: string | null;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('statement_emails')
      .select('id, sent_at, sent_by_user_id, recipients, pdf_url, status, error_message')
      .eq('monthly_log_id', monthlyLogId)
      .order('sent_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const castedData = (data ?? []) as StatementEmailRow[];

    const history = castedData.map((record) => ({
      id: record.id,
      sentAt: record.sent_at,
      sentBy: record.sent_by_user_id,
      recipients: normalizeRecipientLogs(record.recipients),
      pdfUrl: record.pdf_url ?? null,
      status: record.status,
      errorMessage: record.error_message,
    }));

    return { success: true, history };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch email history',
    };
  }
}

/**
 * Monthly Statement Email Service
 *
 * Handles the complete workflow for sending monthly statements via email.
 * Includes recipient management, email generation, and audit logging.
 */

import { supabaseAdmin } from '@/lib/db';
import {
  sendEmail,
  sendEmailToMultipleRecipients,
  createMonthlyStatementEmailTemplate,
  createMonthlyStatementEmailText,
  type EmailRecipient,
} from '@/lib/email-service';
import { format } from 'date-fns';
import { getOwnerDrawSummary } from '@/lib/monthly-log-calculations';
import { calculateNetToOwnerValue } from '@/types/monthly-log';

interface StatementRecipient {
  email: string;
  name: string;
  role?: string;
}

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

    const recipients = (property?.statement_recipients as StatementRecipient[]) || [];
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
    // 1. Fetch monthly log data
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        period_start,
        pdf_url,
        property_id,
        unit_id,
        properties (
          id,
          name,
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

    if (logError || !monthlyLog) {
      return { success: false, error: 'Monthly log not found' };
    }

    // Check if PDF exists
    if (!monthlyLog.pdf_url) {
      return { success: false, error: 'PDF not generated yet. Please generate the PDF first.' };
    }

    // Get recipients from property
    const recipients =
      ((monthlyLog.properties as any)?.statement_recipients as StatementRecipient[]) || [];

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

    const totalCharges = financialData?.charges_amount || 0;
    const totalPayments = financialData?.payments_amount || 0;
    const totalBills = financialData?.bills_amount || 0;
    const escrowAmount = financialData?.escrow_amount || 0;
    const managementFees = financialData?.management_fees_amount || 0;
    const previousBalance = financialData?.previous_lease_balance || 0;

    const ownerDrawSummary = await getOwnerDrawSummary(monthlyLogId);
    const ownerDraw = ownerDrawSummary.total;
    const netToOwner = calculateNetToOwnerValue({
      previousBalance,
      totalPayments,
      totalBills,
      escrowAmount,
      managementFees,
      ownerDraw,
    });

    // 3. Prepare email data
    const periodMonth = format(new Date(monthlyLog.period_start), 'MMMM yyyy');
    const propertyName = (monthlyLog.properties as any)?.name || 'Unknown Property';
    const unitNumber =
      (monthlyLog.units as any)?.unit_number || (monthlyLog.units as any)?.unit_name || 'N/A';
    const companyName = process.env.COMPANY_NAME || 'Property Management Company';

    // 4. Send emails to each recipient
    const emailResults: Array<{
      email: string;
      status: 'sent' | 'failed';
      error?: string;
    }> = [];

    for (const recipient of recipients) {
      const htmlContent = createMonthlyStatementEmailTemplate({
        recipientName: recipient.name,
        propertyName,
        unitNumber,
        periodMonth,
        netToOwner,
        ownerDraw,
        pdfUrl: monthlyLog.pdf_url,
        companyName,
      });

      const textContent = createMonthlyStatementEmailText({
        recipientName: recipient.name,
        propertyName,
        unitNumber,
        periodMonth,
        netToOwner,
        ownerDraw,
        pdfUrl: monthlyLog.pdf_url,
        companyName,
      });

      const emailResult = await sendEmail({
        to: [
          {
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
          },
        ],
        subject: `Monthly Statement - ${propertyName} (${periodMonth})`,
        html: htmlContent,
        text: textContent,
        tags: [
          { name: 'type', value: 'monthly-statement' },
          { name: 'period', value: periodMonth },
          { name: 'property', value: propertyName },
        ],
      });

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
          pdf_url: monthlyLog.pdf_url,
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
    recipients: any;
    status: string;
    errorMessage: string | null;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('statement_emails')
      .select('id, sent_at, sent_by_user_id, recipients, status, error_message')
      .eq('monthly_log_id', monthlyLogId)
      .order('sent_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const history = (data || []).map((record) => ({
      id: record.id,
      sentAt: record.sent_at,
      sentBy: record.sent_by_user_id,
      recipients: record.recipients,
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

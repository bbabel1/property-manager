/**
 * Email Service
 *
 * Handles email delivery using Resend.
 * Supports transactional emails with attachments and templates.
 */

import { Resend } from 'resend';
import { designTokens } from '@/lib/design-tokens';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY || 're_test_key');

export interface EmailRecipient {
  email: string;
  name: string;
  role?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  from?: {
    email: string;
    name: string;
  };
  replyTo?: string;
  attachments?: EmailAttachment[];
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  failedRecipients?: Array<{
    email: string;
    error: string;
  }>;
}

/**
 * Send an email using Resend
 *
 * @param options - Email sending options
 * @returns Result with message ID or error
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    // Validate API key
    if (!process.env.RESEND_API_KEY) {
      return {
        success: false,
        error: 'RESEND_API_KEY not configured',
      };
    }

    // Default from address
    const from = options.from || {
      email: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
      name: process.env.EMAIL_FROM_NAME || 'Property Management',
    };

    // Format recipient list
    const toAddresses = options.to.map((recipient) =>
      recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email,
    );

    // Prepare email data
    const emailData: any = {
      from: `${from.name} <${from.email}>`,
      to: toAddresses,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      tags: options.tags,
    };

    // Add attachments if provided
    if (options.attachments && options.attachments.length > 0) {
      emailData.attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Send email to multiple recipients individually (not CC/BCC)
 *
 * Useful when you want separate emails per recipient with tracking.
 *
 * @param options - Email sending options with multiple recipients
 * @returns Results for each recipient
 */
export async function sendEmailToMultipleRecipients(
  options: SendEmailOptions,
): Promise<SendEmailResult[]> {
  const results: SendEmailResult[] = [];

  for (const recipient of options.to) {
    const result = await sendEmail({
      ...options,
      to: [recipient],
    });

    results.push({
      ...result,
      failedRecipients: result.success
        ? undefined
        : [{ email: recipient.email, error: result.error || 'Unknown error' }],
    });
  }

  return results;
}

/**
 * Validate email service configuration
 *
 * Checks that Resend API key is configured.
 */
export function validateEmailConfiguration(): { isValid: boolean; error?: string } {
  if (!process.env.RESEND_API_KEY) {
    return {
      isValid: false,
      error: 'RESEND_API_KEY environment variable is not set',
    };
  }

  if (!process.env.EMAIL_FROM_ADDRESS) {
    return {
      isValid: false,
      error: 'EMAIL_FROM_ADDRESS environment variable is not set',
    };
  }

  return { isValid: true };
}

/**
 * Create a professional email template for monthly statements
 *
 * @param data - Template data
 * @returns HTML email content
 */
export function createMonthlyStatementEmailTemplate(data: {
  recipientName: string;
  propertyName: string;
  unitNumber: string;
  periodMonth: string;
  netToOwner: number;
  ownerDraw: number;
  pdfUrl: string;
  companyName: string;
}): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const palette = designTokens.colors;
  const typography = designTokens.typography;
  const spacing = designTokens.spacing;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Statement - ${data.periodMonth}</title>
  <style>
    body {
      font-family: ${typography.body};
      line-height: 1.6;
      color: ${palette.textPrimary};
      max-width: 600px;
      margin: 0 auto;
      padding: ${spacing.lg};
      background-color: ${palette.surfaceMuted};
    }
    .container {
      background: ${palette.surfaceDefault};
      border-radius: 8px;
      padding: ${spacing.xl};
      box-shadow: 0 6px 12px -4px rgb(31 61 86 / 0.08), 0 2px 6px -2px rgb(31 61 86 / 0.05);
    }
    .header {
      border-bottom: 3px solid ${palette.primaryStrong};
      padding-bottom: ${spacing.md};
      margin-bottom: ${spacing.lg};
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: ${palette.primaryStrong};
      font-family: ${typography.heading};
    }
    .header p {
      margin: ${spacing.xs} 0 0 0;
      color: ${palette.textMuted};
      font-size: 14px;
    }
    .summary {
      background: ${palette.surfaceHighlight};
      border: 2px solid ${palette.primary};
      border-radius: 8px;
      padding: ${spacing.lg};
      margin: ${spacing.lg} 0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: ${spacing.xs} 0;
      border-bottom: 1px solid ${palette.borderAccent};
    }
    .summary-row:last-child {
      border-bottom: none;
      margin-top: ${spacing.sm};
      padding-top: ${spacing.md};
      border-top: 2px solid ${palette.primary};
      font-weight: bold;
    }
    .summary-label {
      color: ${palette.infoText};
    }
    .summary-value {
      color: ${palette.textPrimary};
      font-weight: 600;
    }
    .summary-value.highlight {
      color: ${palette.primaryStrong};
      font-size: 18px;
    }
    .button {
      display: inline-block;
      background: ${palette.primary};
      color: ${palette.textOnAccent};
      padding: ${spacing.sm} ${spacing.lg};
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: ${spacing.md} 0;
    }
    .button:hover {
      background: ${palette.primaryStrong};
    }
    .property-info {
      background: ${palette.surfaceMuted};
      border: 1px solid ${palette.borderStrong};
      border-radius: 6px;
      padding: ${spacing.md};
      margin: ${spacing.md} 0;
    }
    .property-info p {
      margin: calc(${spacing.xs} / 2) 0;
      font-size: 14px;
    }
    .footer {
      margin-top: ${spacing.xl};
      padding-top: ${spacing.md};
      border-top: 1px solid ${palette.borderStrong};
      font-size: 12px;
      color: ${palette.textMuted};
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Monthly Statement Ready</h1>
      <p>Statement for ${data.periodMonth}</p>
    </div>

    <p>Dear ${data.recipientName},</p>

    <p>Your monthly statement for <strong>${data.periodMonth}</strong> is now available. Please find the attached PDF or download it using the link below.</p>

    <div class="property-info">
      <p><strong>Property:</strong> ${data.propertyName}</p>
      <p><strong>Unit:</strong> ${data.unitNumber}</p>
      <p><strong>Period:</strong> ${data.periodMonth}</p>
    </div>

    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Net to Owner</span>
        <span class="summary-value">${formatCurrency(data.netToOwner)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Owner Draw (Available for Distribution)</span>
        <span class="summary-value highlight">${formatCurrency(data.ownerDraw)}</span>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${data.pdfUrl}" class="button">Download Statement PDF</a>
    </div>

    <p style="margin-top: 24px;">If you have any questions about this statement, please don't hesitate to contact us.</p>

    <p>Thank you,<br>
    <strong>${data.companyName}</strong></p>

    <div class="footer">
      <p>This is an automated message. Please do not reply directly to this email.</p>
      <p>© ${new Date().getFullYear()} ${data.companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create plain text version of monthly statement email
 *
 * @param data - Template data
 * @returns Plain text email content
 */
export function createMonthlyStatementEmailText(data: {
  recipientName: string;
  propertyName: string;
  unitNumber: string;
  periodMonth: string;
  netToOwner: number;
  ownerDraw: number;
  pdfUrl: string;
  companyName: string;
}): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return `
Monthly Statement Ready - ${data.periodMonth}

Dear ${data.recipientName},

Your monthly statement for ${data.periodMonth} is now available.

Property: ${data.propertyName}
Unit: ${data.unitNumber}
Period: ${data.periodMonth}

Financial Summary:
- Net to Owner: ${formatCurrency(data.netToOwner)}
- Owner Draw (Available for Distribution): ${formatCurrency(data.ownerDraw)}

Download your statement: ${data.pdfUrl}

If you have any questions about this statement, please don't hesitate to contact us.

Thank you,
${data.companyName}

---
This is an automated message. Please do not reply directly to this email.
© ${new Date().getFullYear()} ${data.companyName}. All rights reserved.
  `.trim();
}

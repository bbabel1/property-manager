/**
 * Gmail Email Sending
 * 
 * Sends emails via Gmail API with proper formatting.
 */

import { getGmailClient } from './client';
import { type EmailRecipient, type EmailAttachment } from '@/lib/email-service';

export interface SendGmailEmailOptions {
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
}

export interface SendGmailEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email via Gmail API
 */
export async function sendEmailViaGmail(
  userId: string,
  orgId: string,
  options: SendGmailEmailOptions
): Promise<SendGmailEmailResult> {
  try {
    const gmail = await getGmailClient(userId, orgId);

    // Build RFC 2822 message
    const from = options.from || {
      email: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
      name: process.env.EMAIL_FROM_NAME || 'Property Management',
    };

    // Format recipients
  const toAddresses = options.to.map((recipient) =>
    recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email
  );

  // Build message parts
  const hasAttachments = Array.isArray(options.attachments) && options.attachments.length > 0;
  const attachments = hasAttachments ? options.attachments ?? [] : [];
  const outerBoundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const innerBoundary = `----=_Part_${Date.now() + 1}_${Math.random().toString(36).substring(7)}`;
  let message = '';

    // Headers
    message += `From: ${from.name} <${from.email}>\r\n`;
    message += `To: ${toAddresses.join(', ')}\r\n`;
    message += `Subject: ${options.subject}\r\n`;
    if (options.replyTo) {
      message += `Reply-To: ${options.replyTo}\r\n`;
    }
    message += `MIME-Version: 1.0\r\n`;
    
    if (hasAttachments) {
      // Use multipart/mixed for messages with attachments
      message += `Content-Type: multipart/mixed; boundary="${outerBoundary}"\r\n`;
      message += `\r\n`;
      
      // Add multipart/alternative for text/html parts
      message += `--${outerBoundary}\r\n`;
      message += `Content-Type: multipart/alternative; boundary="${innerBoundary}"\r\n`;
      message += `\r\n`;
    } else {
      // Use multipart/alternative for messages without attachments
      message += `Content-Type: multipart/alternative; boundary="${outerBoundary}"\r\n`;
      message += `\r\n`;
    }

    const textBoundary = hasAttachments ? innerBoundary : outerBoundary;

    // Plain text part
    if (options.text) {
      message += `--${textBoundary}\r\n`;
      message += `Content-Type: text/plain; charset=UTF-8\r\n`;
      message += `Content-Transfer-Encoding: 7bit\r\n`;
      message += `\r\n`;
      message += `${options.text}\r\n`;
    }

    // HTML part
    message += `--${textBoundary}\r\n`;
    message += `Content-Type: text/html; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n`;
    message += `\r\n`;
  message += `${options.html}\r\n`;
  message += `--${textBoundary}--\r\n`;

  // Attachments (if any)
  if (hasAttachments) {
    for (const attachment of attachments) {
        message += `--${outerBoundary}\r\n`;
        message += `Content-Type: ${attachment.contentType || 'application/octet-stream'}\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n`;
        message += `\r\n`;
        
        const content = typeof attachment.content === 'string'
          ? attachment.content
          : attachment.content.toString('base64');
        // Split base64 content into lines (76 chars per line for RFC compliance)
        const lines = content.match(/.{1,76}/g) || [];
        message += lines.join('\r\n');
        message += `\r\n`;
      }
      message += `--${outerBoundary}--\r\n`;
    }

    // Encode message in base64url format (Gmail API requires base64url)
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''); // Remove trailing padding

    // Send via Gmail API
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: response.data.id || undefined,
    };
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
    
    // Handle specific Gmail API errors
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('token')) {
      return {
        success: false,
        error: 'Gmail authentication expired. Please reconnect your Gmail account.',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

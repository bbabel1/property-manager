import {
  StatementRecipientsResponseSchema,
  type StatementRecipient,
} from '@/modules/monthly-logs/schemas/statement-recipient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidRecipientEmail = (email: string) => EMAIL_REGEX.test(email);

const parseRecipients = (text: string): StatementRecipient[] => {
  if (!text) return [];
  try {
    const json = JSON.parse(text);
    const parsed = StatementRecipientsResponseSchema.safeParse(json);
    if (parsed.success) {
      return parsed.data.recipients || [];
    }
    console.warn('Invalid recipients payload', parsed.error.format());
    return [];
  } catch (error) {
    console.warn('Invalid recipients response', error);
    return [];
  }
};

export async function getStatementRecipients(propertyId: string): Promise<StatementRecipient[]> {
  const response = await fetch(`/api/properties/${propertyId}/statement-recipients`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error('Failed to fetch recipients');
  }

  return parseRecipients(text);
}

export async function updateStatementRecipients(
  propertyId: string,
  recipients: StatementRecipient[],
): Promise<void> {
  const response = await fetch(`/api/properties/${propertyId}/statement-recipients`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients }),
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorJson = text ? JSON.parse(text) : {};
      throw new Error(errorJson?.error?.message || 'Failed to save recipients');
    } catch {
      throw new Error('Failed to save recipients');
    }
  }
}

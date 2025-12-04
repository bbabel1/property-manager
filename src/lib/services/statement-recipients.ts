export interface StatementRecipient {
  email: string;
  name: string;
  role: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidRecipientEmail = (email: string) => EMAIL_REGEX.test(email);

const parseJsonSafely = (text: string) => {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};

export async function getStatementRecipients(propertyId: string): Promise<StatementRecipient[]> {
  const response = await fetch(`/api/properties/${propertyId}/statement-recipients`);
  const text = await response.text();
  const data = parseJsonSafely(text) as { recipients?: StatementRecipient[] };

  if (!response.ok) {
    throw new Error('Failed to fetch recipients');
  }

  return data.recipients || [];
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
    const errorData = parseJsonSafely(text) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || 'Failed to save recipients');
  }
}

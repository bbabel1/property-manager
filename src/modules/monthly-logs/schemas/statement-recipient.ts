import { z } from 'zod';

export const StatementRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.string().min(1),
});

export type StatementRecipient = z.infer<typeof StatementRecipientSchema>;

export const StatementRecipientsResponseSchema = z.object({
  recipients: z.array(StatementRecipientSchema).optional(),
});

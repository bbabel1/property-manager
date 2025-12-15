import { z } from 'zod';

export const COMPANY_SENTINEL = '__company__';
export const MAX_JOURNAL_LINES = 50;

export const amountInputSchema = z.union([z.string(), z.number()]).optional().nullable();

export const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  description: z.string().max(255).optional().nullable(),
  debit: amountInputSchema,
  credit: amountInputSchema,
});

export const journalEntrySchemaBase = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  propertyId: z.string().min(1, 'Property or company selection is required'),
  unitId: z.string().optional().nullable(),
  memo: z.string().max(255, 'Memo must be 255 characters or fewer').optional().nullable(),
  lines: z.array(journalLineSchema).min(2, 'Add at least two lines').max(
    MAX_JOURNAL_LINES,
    `You can only add up to ${MAX_JOURNAL_LINES} lines per entry`,
  ),
});

export type JournalEntryPayload = z.infer<typeof journalEntrySchemaBase>;

export const buildJournalEntrySchema = (requireUnit: boolean) =>
  journalEntrySchemaBase.extend({
    unitId: requireUnit ? z.string().min(1, 'Select a unit') : z.string().optional().nullable(),
  });

export type NormalizedJournalLine = {
  accountId: string;
  description: string | null;
  postingType: 'Debit' | 'Credit';
  amount: number;
};

export const cleanJournalMemo = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const normalizeAmountInput = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const roundJournalCurrency = (value: number) => Math.round(value * 100) / 100;

export const normalizeJournalLines = (rawLines: JournalEntryPayload['lines']) => {
  const normalized: NormalizedJournalLine[] = [];
  let debitCount = 0;
  let creditCount = 0;
  let debitTotal = 0;
  let creditTotal = 0;

  rawLines.forEach((line, index) => {
    const debitValue = roundJournalCurrency(Math.abs(normalizeAmountInput(line.debit)));
    const creditValue = roundJournalCurrency(Math.abs(normalizeAmountInput(line.credit)));

    if (debitValue > 0 && creditValue > 0) {
      throw new Error(`Line ${index + 1} cannot have both debit and credit amounts.`);
    }
    if (debitValue === 0 && creditValue === 0) {
      throw new Error(`Line ${index + 1} must include a debit or credit amount.`);
    }

    const postingType: 'Debit' | 'Credit' = debitValue > 0 ? 'Debit' : 'Credit';
    const amount = postingType === 'Debit' ? debitValue : creditValue;
    if (amount <= 0) {
      throw new Error(`Line ${index + 1} amount must be greater than zero.`);
    }
    if (amount > 1_000_000_000) {
      throw new Error(`Line ${index + 1} exceeds the supported limit of $1,000,000,000.`);
    }

    const accountId = line.accountId.trim();
    if (!accountId) {
      throw new Error(`Line ${index + 1} is missing an account.`);
    }

    const description = cleanJournalMemo(line.description ?? '');
    const truncatedDescription =
      description && description.length > 255 ? description.slice(0, 255) : description;

    normalized.push({
      accountId,
      description: truncatedDescription,
      postingType,
      amount,
    });

    if (postingType === 'Debit') {
      debitCount += 1;
      debitTotal += amount;
    } else {
      creditCount += 1;
      creditTotal += amount;
    }
  });

  if (!debitCount || !creditCount) {
    throw new Error('Add at least one debit line and one credit line.');
  }

  const roundedDebit = roundJournalCurrency(debitTotal);
  const roundedCredit = roundJournalCurrency(creditTotal);
  if (Math.abs(roundedDebit - roundedCredit) > 0.005) {
    throw new Error('Debits must equal credits.');
  }

  return {
    lines: normalized,
    debitTotal: roundedDebit,
  };
};

export const parseCurrencyInput = (value?: string | number | null) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

export const sanitizeCurrencyInput = (value: string) => value.replace(/[^0-9.-]/g, '');


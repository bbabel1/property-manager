import { createBuildiumClient, defaultBuildiumConfig } from '@/lib/buildium-client';
import { roundJournalCurrency, type NormalizedJournalLine } from '@/lib/journal-entries';
import type {
  BuildiumAccountingEntityType,
  BuildiumGLEntryLine,
  BuildiumGeneralJournalEntryInput,
} from '@/types/buildium';

export const BUILDUM_MISSING_CREDS_ERROR = 'Buildium API credentials are not configured.';

const hasBuildiumCredentials = Boolean(
  defaultBuildiumConfig.clientId && defaultBuildiumConfig.clientSecret,
);

export const ensureBuildiumConfigured = () => {
  if (!hasBuildiumCredentials) {
    throw new Error(BUILDUM_MISSING_CREDS_ERROR);
  }
};

export const parseBuildiumNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const resolveBuildiumAccountingEntityType = (
  raw?: string | null,
): BuildiumAccountingEntityType => {
  if (!raw) return 'Rental';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'association') return 'Association';
  if (normalized === 'commercial') return 'Commercial';
  return 'Rental';
};

export type BuildiumSyncOptions = {
  date: string;
  memo?: string | null;
  totalAmount: number;
  lines: NormalizedJournalLine[];
  propertyId: number;
  unitId?: number | null;
  accountingEntityType: BuildiumAccountingEntityType;
  accountMap: Map<string, number>;
  existingEntryId?: number | null;
};

export const syncJournalEntryToBuildium = async (
  options: BuildiumSyncOptions,
): Promise<number> => {
  ensureBuildiumConfigured();
  const client = createBuildiumClient(defaultBuildiumConfig);

  const lines: BuildiumGLEntryLine[] = options.lines.map((line) => {
    const buildiumGlAccountId = options.accountMap.get(line.accountId);
    if (!buildiumGlAccountId) {
      throw new Error('One or more GL accounts are missing Buildium mappings.');
    }
    const memo =
      line.description && line.description.length > 255
        ? line.description.slice(0, 255)
        : line.description || undefined;

    const entryLine: BuildiumGLEntryLine = {
      GLAccountId: buildiumGlAccountId,
      Amount: roundJournalCurrency(line.amount),
      PostingType: line.postingType,
    };

    if (memo) {
      entryLine.Memo = memo;
    }

    return entryLine;
  });

  const accountingEntity: BuildiumGeneralJournalEntryInput['AccountingEntity'] = {
    AccountingEntityType: options.accountingEntityType,
    Id: options.propertyId,
  };
  if (options.unitId) {
    accountingEntity.UnitId = options.unitId;
  }

  const payload: BuildiumGeneralJournalEntryInput = {
    AccountingEntity: accountingEntity,
    Date: options.date,
    Memo: options.memo ?? undefined,
    TotalAmount: roundJournalCurrency(options.totalAmount),
    Lines: lines,
  };

  const entry = options.existingEntryId
    ? await client.updateGeneralJournalEntry(options.existingEntryId, payload)
    : await client.createGeneralJournalEntry(payload);

  const buildiumId = parseBuildiumNumericId(entry?.Id);
  if (!buildiumId) {
    throw new Error('Buildium did not return a journal entry ID.');
  }
  return buildiumId;
};


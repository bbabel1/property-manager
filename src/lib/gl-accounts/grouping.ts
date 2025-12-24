export type GlAccountTypeKey = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

export type GlAccountLike = {
  id: string;
  label: string;
  type?: string | null;
};

const ORDER: GlAccountTypeKey[] = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

export function normalizeGlAccountType(value: unknown): GlAccountTypeKey | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return null;
  if (raw === 'asset') return 'Asset';
  if (raw === 'liability') return 'Liability';
  if (raw === 'equity') return 'Equity';
  if (raw === 'income') return 'Income';
  if (raw === 'expense') return 'Expense';
  return null;
}

export function glAccountGroupLabel(type: GlAccountTypeKey): string {
  return `${type} accounts`;
}

export function groupGlAccounts(accounts: GlAccountLike[]): Array<{ type: GlAccountTypeKey; label: string; accounts: GlAccountLike[] }> {
  const map = new Map<GlAccountTypeKey, GlAccountLike[]>();
  for (const acc of accounts) {
    const t = normalizeGlAccountType(acc.type);
    if (!t) continue; // only allow the requested types
    const list = map.get(t) ?? [];
    list.push(acc);
    map.set(t, list);
  }

  return ORDER.filter((t) => (map.get(t) ?? []).length > 0).map((t) => {
    const list = (map.get(t) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label));
    return { type: t, label: glAccountGroupLabel(t), accounts: list };
  });
}



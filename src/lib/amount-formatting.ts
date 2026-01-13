import { formatCurrency } from './transactions/formatting';
import type { AmountTone } from './transactions/formatting';

type AmountDisplayOptions = {
  currencyFormatter?: (value: number) => string;
  useParensForNegative?: boolean;
  showSign?: boolean;
};

export const resolveAmountTone = (value: number | null | undefined): AmountTone => {
  const numeric = Number(value ?? 0) || 0;
  if (numeric === 0) return 'neutral';
  return numeric > 0 ? 'positive' : 'negative';
};

export const amountToneClassName = (tone: AmountTone): string => {
  switch (tone) {
    case 'positive':
      return 'text-emerald-700';
    case 'negative':
      return 'text-rose-700';
    default:
      return 'text-slate-900';
  }
};

export const formatAmountDisplay = (
  value: number | null | undefined,
  {
    currencyFormatter = formatCurrency,
    useParensForNegative = false,
    showSign = false,
  }: AmountDisplayOptions = {},
) => {
  const raw = Number(value ?? 0) || 0;
  const tone = resolveAmountTone(raw);
  const absolute = Math.abs(raw);
  const formatted = currencyFormatter(absolute);

  const prefix =
    showSign && tone !== 'neutral' ? (tone === 'negative' ? '-' : '+') : '';
  const display =
    tone === 'negative' && useParensForNegative ? `(${formatted})` : `${prefix}${formatted}`;

  return { raw, formatted, display, tone };
};

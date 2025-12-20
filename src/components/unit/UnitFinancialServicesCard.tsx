'use client';

import Link from 'next/link';

type Fin = {
  cash_balance?: number;
  security_deposits?: number;
  reserve?: number;
  available_balance?: number;
  as_of?: string;
};

type UnitFinancialSummaryCardProps = {
  fin?: Fin;
  property: {
    id: string;
    reserve?: number | null;
    operating_account?: { id: string; name: string; last4?: string | null };
    deposit_trust_account?: { id: string; name: string; last4?: string | null };
  };
};

const eyebrowLabelClass = 'eyebrow-label';
const metricValueClass = 'text-base font-semibold text-foreground';
const detailLabelClass = 'text-sm font-medium text-muted-foreground';
const detailValueClass = 'text-base font-medium text-foreground';

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);

const formatAsOf = (value?: string) => {
  const fallback = new Date();
  if (!value) return fallback.toLocaleDateString();
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback.toLocaleDateString() : parsed.toLocaleDateString();
};

export default function UnitFinancialServicesCard({
  fin,
  property,
}: UnitFinancialSummaryCardProps) {
  const operatingAccount = property?.operating_account;
  const trustAccount = property?.deposit_trust_account;
  const reserveValue = fin?.reserve ?? property?.reserve ?? 0;

  return (
    <div className="surface-card surface-card--muted relative p-6 text-sm">
      <div className="space-y-3">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h4 className="text-foreground text-lg font-semibold">Finances</h4>
        </div>

        <div className="space-y-2.5 rounded-2xl bg-transparent p-1">
          <div className="space-y-1">
            <p className={eyebrowLabelClass}>Cash balance</p>
            <p className={`${metricValueClass} text-[var(--color-brand-900)]`}>
              {formatCurrency(fin?.cash_balance)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-6">
              <p className={detailLabelClass}>Security deposits &amp; early payments</p>
              <p className={metricValueClass}>{formatCurrency(fin?.security_deposits)}</p>
            </div>
            <div className="flex items-baseline justify-between gap-6">
              <p className={detailLabelClass}>Property reserve</p>
              <p className={metricValueClass}>{formatCurrency(reserveValue)}</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-6">
              <p className={detailLabelClass}>Available balance</p>
              <p className={metricValueClass}>{formatCurrency(fin?.available_balance)}</p>
            </div>
            <p className="text-muted-foreground text-xs font-medium">
              As of {formatAsOf(fin?.as_of)}
            </p>
          </div>

          <div className="card-divider space-y-1 border-t pt-1 pb-1">
            <div className="flex items-baseline justify-between gap-4">
              <p className={detailLabelClass}>Operating account</p>
              <p className={detailValueClass}>
                {operatingAccount ? (
                  <Link
                    className="text-primary focus-visible:ring-offset-background rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                    href={`/bank-accounts/${operatingAccount.id}`}
                  >
                    {`${operatingAccount.name}${operatingAccount.last4 ? ' ****' + operatingAccount.last4 : ''}`}
                  </Link>
                ) : (
                  'Setup'
                )}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <p className={detailLabelClass}>Deposit trust account</p>
              <p className={detailValueClass}>
                {trustAccount ? (
                  <Link
                    className="text-primary focus-visible:ring-offset-background rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                    href={`/bank-accounts/${trustAccount.id}`}
                  >
                    {`${trustAccount.name}${trustAccount.last4 ? ' ****' + trustAccount.last4 : ''}`}
                  </Link>
                ) : (
                  'Setup'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Body, Heading, Label } from '@/ui/typography';

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

const eyebrowLabelClass =
  'text-xs font-medium uppercase tracking-[0.12em] leading-tight text-muted-foreground';

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);

const formatHeldLiability = (value?: number | null) => formatCurrency(Math.abs(value ?? 0));

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
    <div className="relative rounded-lg border border-primary/30 bg-primary/10 p-6">
      <div className="space-y-3">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Heading as="h4" size="h5">
            Finances
          </Heading>
        </div>

        <div className="space-y-2.5 rounded-2xl bg-transparent p-1">
          <div className="space-y-1">
            <Label as="p" size="xs" className={eyebrowLabelClass}>
              Cash balance
            </Label>
            <Heading as="p" size="h6" className="text-brand-900">
              {formatCurrency(fin?.cash_balance)}
            </Heading>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-6">
              <Label as="p" size="sm" tone="muted">
                Security deposits &amp; early payments
              </Label>
              <Heading as="p" size="h6">
                {formatHeldLiability(fin?.security_deposits)}
              </Heading>
            </div>
            <div className="flex items-baseline justify-between gap-6">
              <Label as="p" size="sm" tone="muted">
                Property reserve
              </Label>
              <Heading as="p" size="h6">
                {formatCurrency(reserveValue)}
              </Heading>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-6">
              <Label as="p" size="sm" tone="muted">
                Available balance
              </Label>
              <Heading as="p" size="h6">
                {formatCurrency(fin?.available_balance)}
              </Heading>
            </div>
            <Body as="p" size="xs" tone="muted">
              As of {formatAsOf(fin?.as_of)}
            </Body>
          </div>

          <div className="space-y-1 border-border-subtle border-t pb-1 pt-1">
            <div className="flex items-baseline justify-between gap-4">
              <Label as="p" size="sm" tone="muted">
                Operating account
              </Label>
              <Body as="p" size="sm">
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
              </Body>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <Label as="p" size="sm" tone="muted">
                Deposit trust account
              </Label>
              <Body as="p" size="sm">
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
              </Body>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

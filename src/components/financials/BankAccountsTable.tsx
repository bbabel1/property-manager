'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import RecordDepositForm from '@/components/bank-accounts/RecordDepositForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTitle, FullscreenDialogContent } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import TableRowLink from '@/components/ui/table-row-link';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import type { RecordDepositPrefill } from '@/types/record-deposit';
import { Heading, Label } from '@/ui/typography';

type BankAccountTableRow = {
  id: string;
  name: string | null;
  description: string | null;
  bank_account_number: string | null;
  last_reconciliation_date: string | null;
  undeposited_funds: number | null;
  bank_balance: number | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatCurrency(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) {
    return currencyFormatter.format(0);
  }
  return currencyFormatter.format(Number(amount));
}

function formatDate(value?: string | null) {
  if (!value) return '--';
  try {
    const isoLike = value.includes('T') ? value : `${value}T00:00:00Z`;
    const date = new Date(isoLike);
    if (Number.isNaN(date.getTime())) return '--';
    return dateFormatter.format(date);
  } catch {
    return '--';
  }
}

function maskAccountNumber(value: string | null) {
  if (!value) return '--';
  const s = String(value);
  if (s.length <= 4) return s;
  return s.replace(/.(?=.{4}$)/g, '•');
}

export default function BankAccountsTable({ rows }: { rows: BankAccountTableRow[] }) {
  const router = useRouter();
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [activeBankId, setActiveBankId] = useState<string | null>(null);
  const [isLoadingPrefill, setIsLoadingPrefill] = useState(false);
  const [prefill, setPrefill] = useState<RecordDepositPrefill | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);

  const fetchPrefill = useCallback(async (bankAccountId: string) => {
    setIsLoadingPrefill(true);
    setPrefillError(null);
    try {
      const response = await fetchWithSupabaseAuth(`/api/bank-accounts/${bankAccountId}/record-deposit`, {
        method: 'GET',
      });
      const json = (await response.json().catch(() => ({}))) as { data?: RecordDepositPrefill; error?: string };
      if (!response.ok || !json?.data) {
        const message = json?.error || 'Unable to load record deposit data.';
        throw new Error(message);
      }
      setPrefill(json.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load record deposit data.';
      setPrefillError(message);
    } finally {
      setIsLoadingPrefill(false);
    }
  }, []);

  const handleOpenDeposit = useCallback(
    (bankAccountId: string) => {
      setActiveBankId(bankAccountId);
      setIsDepositOpen(true);
      setPrefill(null);
      setPrefillError(null);
      void fetchPrefill(bankAccountId);
    },
    [fetchPrefill],
  );

  const handleCloseDeposit = useCallback(() => {
    setIsDepositOpen(false);
    setPrefill(null);
    setPrefillError(null);
    setActiveBankId(null);
    setIsLoadingPrefill(false);
  }, []);

  const handleDepositSaved = useCallback(
    (result: { intent: 'save' | 'save-and-new'; transactionId: string | null }) => {
      router.refresh();
      if (result.intent === 'save-and-new' && activeBankId) {
        void fetchPrefill(activeBankId);
        return;
      }
      setIsDepositOpen(false);
      setPrefill(null);
      setPrefillError(null);
    },
    [activeBankId, fetchPrefill, router],
  );

  const currentBankName =
    (activeBankId && rowById.get(activeBankId)?.name) || prefill?.bankAccountName || 'Bank account';

  return (
    <>
      <div className="overflow-x-auto">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs font-[var(--font-weight-semibold)] uppercase tracking-widest">
              <TableHead className="text-muted-foreground w-[18rem]">Name</TableHead>
              <TableHead className="text-muted-foreground w-[10rem]">Account number</TableHead>
              <TableHead className="text-muted-foreground w-[10rem]">EPay enabled</TableHead>
              <TableHead className="text-muted-foreground w-[12rem]">Retail cash enabled</TableHead>
              <TableHead className="text-muted-foreground w-[12rem]">Last reconciliation date</TableHead>
              <TableHead className="text-muted-foreground w-[10rem]">Undeposited funds</TableHead>
              <TableHead className="text-muted-foreground w-[10rem] text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center text-sm">
                  We didn&apos;t find any bank accounts. Try adjusting your filters or add a new bank account.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRowLink
                  key={row.id}
                  href={`/bank-accounts/${row.id}`}
                  className="border-border/70 bg-background hover:bg-muted/40 border-b transition-colors last:border-0"
                >
                  <TableCell className="align-top">
                    <div className="space-y-0.5">
                      <Label as="div" size="sm" className="text-primary">
                        {row.name}
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        {row.description || 'Bank account'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {maskAccountNumber(row.bank_account_number)}
                  </TableCell>
                  <TableCell className="align-top text-sm">--</TableCell>
                  <TableCell className="align-top text-sm">--</TableCell>
                  <TableCell className="align-top text-sm">{formatDate(row.last_reconciliation_date)}</TableCell>
                  <TableCell className="align-top text-sm">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 font-semibold"
                      data-row-link-ignore="true"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleOpenDeposit(row.id);
                      }}
                    >
                      {row.undeposited_funds == null
                        ? '--'
                        : formatCurrency(row.undeposited_funds)}
                    </Button>
                  </TableCell>
                  <TableCell className="align-top text-right text-sm">
                    {formatCurrency(row.bank_balance)}
                  </TableCell>
                </TableRowLink>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isDepositOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDeposit();
        }}
      >
        <FullscreenDialogContent className="bg-background text-foreground">
          <DialogTitle className="sr-only">Record deposit</DialogTitle>
          <div className="flex flex-col gap-0">
            <div className="border-border flex items-center justify-between border-b px-6 py-4">
              <div>
                <Heading as="p" size="h4">
                  Record deposit
                </Heading>
                <div className="text-muted-foreground text-sm">{currentBankName}</div>
              </div>
            </div>

            <div className="min-h-[320px] overflow-y-auto px-6 pb-8 pt-6">
              {isLoadingPrefill ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading undeposited payments...
                </div>
              ) : prefillError ? (
                <div className="text-destructive text-sm">{prefillError}</div>
              ) : prefill ? (
                <RecordDepositForm
                  key={prefill.bankAccountId}
                  bankAccountId={prefill.bankAccountId}
                  bankAccounts={prefill.bankAccounts}
                  defaultBankAccountId={prefill.defaultBankAccountId}
                  undepositedPaymentsTitle={prefill.undepositedPaymentsTitle}
                  undepositedPayments={prefill.undepositedPayments}
                  properties={prefill.properties}
                  units={prefill.units}
                  glAccounts={prefill.glAccounts}
                  onCancel={handleCloseDeposit}
                  onSaved={handleDepositSaved}
                />
              ) : (
                <div className="text-muted-foreground text-sm">
                  Select a bank account to record a deposit.
                </div>
              )}
            </div>
          </div>
        </FullscreenDialogContent>
      </Dialog>
    </>
  );
}

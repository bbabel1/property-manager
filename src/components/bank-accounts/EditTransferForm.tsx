'use client';

import { ArrowRight, Info, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import GlAccountSelectItems from '@/components/gl-accounts/GlAccountSelectItems';

export type TransferBankAccountOption = { id: string; label: string; balance?: number | null };
export type TransferPropertyOption = { id: string; label: string };
export type TransferUnitOption = { id: string; label: string; propertyId: string | null };
export type TransferGlAccountOption = { id: string; label: string; type: string | null };

export type TransferData = {
  id: string;
  date: string;
  memo: string | null;
  amount: number;
  fromBankAccountId: string;
  toBankAccountId: string;
  propertyId: string | null;
  unitId: string | null;
  mode?: 'transfer' | 'deposit' | 'withdrawal';
  glAccountId?: string | null;
};

const COMPANY_SENTINEL = '__company__';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(value) ? value : 0,
  );

const parseAmount = (value: string) => {
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

type Mode = 'transfer' | 'deposit' | 'withdrawal';

export default function EditTransferForm(props: {
  transfer: TransferData;
  bankAccountId: string;
  bankAccounts: TransferBankAccountOption[];
  properties: TransferPropertyOption[];
  units: TransferUnitOption[];
  glAccounts: TransferGlAccountOption[];
  patchUrl: string;
  deleteUrl: string;
  returnHref: string;
}) {
  const router = useRouter();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [mode, setMode] = useState<Mode>(props.transfer.mode ?? 'transfer');
  const [date, setDate] = useState(props.transfer.date?.slice(0, 10) ?? todayIso);
  const [propertyId, setPropertyId] = useState<string>(
    props.transfer.propertyId ? props.transfer.propertyId : COMPANY_SENTINEL,
  );
  const [unitId, setUnitId] = useState<string>(props.transfer.unitId ?? '');
  const [memo, setMemo] = useState<string>(props.transfer.memo ?? '');
  const [fromBankAccountId, setFromBankAccountId] = useState<string>(
    props.transfer.fromBankAccountId || props.bankAccountId,
  );
  const [toBankAccountId, setToBankAccountId] = useState<string>(props.transfer.toBankAccountId);
  const [transferAmount, setTransferAmount] = useState<string>(
    Number.isFinite(props.transfer.amount) ? props.transfer.amount.toFixed(2) : '0.00',
  );

  // deposit / withdrawal fields (same layout as Record other transaction)
  const [bankAccountId, setBankAccountId] = useState<string>(
    props.transfer.fromBankAccountId || props.bankAccountId,
  );
  const [glAccountId, setGlAccountId] = useState<string>(props.transfer.glAccountId ?? '');
  const [otherAmount, setOtherAmount] = useState<string>(
    Number.isFinite(props.transfer.amount) ? props.transfer.amount.toFixed(2) : '0.00',
  );

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const unitsByProperty = useMemo(() => {
    const map = new Map<string | null, TransferUnitOption[]>();
    props.units.forEach((u) => {
      const list = map.get(u.propertyId ?? null) ?? [];
      list.push(u);
      map.set(u.propertyId ?? null, list);
    });
    return map;
  }, [props.units]);

  const propertyItems = useMemo(
    () => [{ id: COMPANY_SENTINEL, label: 'Company (no property)' }, ...props.properties],
    [props.properties],
  );

  const effectiveUnitOptions = useMemo(() => {
    if (!propertyId || propertyId === COMPANY_SENTINEL) return [];
    return unitsByProperty.get(propertyId) ?? [];
  }, [propertyId, unitsByProperty]);

  const fromBalance = useMemo(
    () => props.bankAccounts.find((b) => b.id === fromBankAccountId)?.balance ?? null,
    [fromBankAccountId, props.bankAccounts],
  );
  const toBalance = useMemo(
    () => props.bankAccounts.find((b) => b.id === toBankAccountId)?.balance ?? null,
    [toBankAccountId, props.bankAccounts],
  );

  const selectedBankBalance = useMemo(
    () => props.bankAccounts.find((b) => b.id === bankAccountId)?.balance ?? null,
    [bankAccountId, props.bankAccounts],
  );

  const submit = useCallback(
    async (intent: 'save' | 'delete') => {
      setIsSaving(true);
      setFormError(null);

      try {
        if (intent === 'delete') {
          const res = await fetch(props.deleteUrl, { method: 'DELETE' });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message =
              (body && typeof body.error === 'string' && body.error) ||
              (body?.error?.message as string | undefined) ||
              'Failed to delete transfer.';
            throw new Error(message);
          }
          router.replace(props.returnHref);
          router.refresh();
          return;
        }

        const amountValue = parseAmount(mode === 'transfer' ? transferAmount : otherAmount);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
          setFormError('Enter an amount greater than $0.00.');
          return;
        }

        if (mode === 'transfer') {
          if (fromBankAccountId && toBankAccountId && fromBankAccountId === toBankAccountId) {
            setFormError('Transfer from and transfer to must be different bank accounts.');
            return;
          }
        } else {
          if (!bankAccountId) {
            setFormError('Select a bank account.');
            return;
          }
          if (!glAccountId) {
            setFormError('Select an offsetting GL account.');
            return;
          }
        }

        const payloadBase = {
          mode,
          date,
          propertyId: propertyId && propertyId !== COMPANY_SENTINEL ? propertyId : null,
          unitId: unitId || null,
          memo: memo || null,
        } as const;

        const payload =
          mode === 'transfer'
            ? {
                ...payloadBase,
                fromBankAccountId,
                toBankAccountId,
                amount: transferAmount,
              }
            : {
                ...payloadBase,
                bankAccountId,
                glAccountId,
                amount: otherAmount,
              };

        const res = await fetch(props.patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            (body && typeof body.error === 'string' && body.error) ||
            (body?.error?.message as string | undefined) ||
            'Failed to update transfer.';
          throw new Error(message);
        }

        router.replace(props.returnHref);
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to update transfer.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      date,
      mode,
      bankAccountId,
      glAccountId,
      otherAmount,
      fromBankAccountId,
      memo,
      propertyId,
      props.deleteUrl,
      props.patchUrl,
      props.returnHref,
      router,
      toBankAccountId,
      transferAmount,
      unitId,
    ],
  );

  return (
    <div className="w-full space-y-8 pb-10">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold">Record other transaction</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={() => router.replace(props.returnHref)}
          disabled={isSaving}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="w-full">
        {formError && (
          <div className="border-destructive/20 bg-destructive/10 mb-6 rounded-md border p-4">
            <p className="text-destructive text-sm">{formError}</p>
          </div>
        )}

        <div className="space-y-8">
          <div className="space-y-3">
            <div className="text-sm font-semibold">What kind of transaction are you recording?</div>
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                const next = value === 'deposit' || value === 'withdrawal' ? value : 'transfer';
                setMode(next);
                setFormError(null);
              }}
              className="grid gap-3"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="transfer" id="et-transfer" />
                <Label htmlFor="et-transfer" className="font-normal">
                  Transfer
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="deposit" id="et-deposit" />
                <Label htmlFor="et-deposit" className="font-normal">
                  Deposit
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="withdrawal" id="et-withdrawal" />
                <Label htmlFor="et-withdrawal" className="font-normal">
                  Withdrawal
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold">Transaction details</div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="et-date" className="text-xs font-semibold tracking-wide">
                  DATE <span className="text-destructive">*</span>
                </Label>
                <DatePicker id="et-date" value={date} onChange={(value) => setDate(value ?? '')} />
              </div>

              <div>
                <Label htmlFor="et-property" className="text-xs font-semibold tracking-wide">
                  PROPERTY OR COMPANY <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={propertyId}
                  onValueChange={(value) => {
                    setPropertyId(value);
                    setUnitId('');
                  }}
                >
                  <SelectTrigger id="et-property">
                    <SelectValue placeholder="Select a property or company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyItems.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {propertyId !== COMPANY_SENTINEL ? (
                <div>
                  <Label htmlFor="et-unit" className="text-xs font-semibold tracking-wide">
                    UNIT <span className="text-destructive">*</span>
                  </Label>
                  <Select value={unitId} onValueChange={(value) => setUnitId(value)}>
                    <SelectTrigger id="et-unit">
                      <SelectValue placeholder="Select a unit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {effectiveUnitOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div />
              )}
            </div>

            {mode === 'transfer' ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="et-transfer-from" className="text-xs font-semibold tracking-wide">
                      TRANSFER FROM <span className="text-destructive">*</span>
                    </Label>
                    <Select value={fromBankAccountId} onValueChange={setFromBankAccountId}>
                      <SelectTrigger id="et-transfer-from">
                        <SelectValue placeholder="Select a bank account" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.bankAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Balance:{' '}
                    <span className="text-foreground font-semibold">
                      {formatCurrency(Number(fromBalance ?? 0))}
                    </span>
                  </div>
                  <div>
                    <Label htmlFor="et-transfer-amount" className="text-xs font-semibold tracking-wide">
                      TRANSFER AMOUNT <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="et-transfer-amount"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div className="hidden justify-center pt-10 lg:flex">
                  <ArrowRight className="text-muted-foreground h-5 w-5" aria-hidden />
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="et-transfer-to" className="text-xs font-semibold tracking-wide">
                      TRANSFER TO <span className="text-destructive">*</span>
                    </Label>
                    <Select value={toBankAccountId} onValueChange={setToBankAccountId}>
                      <SelectTrigger id="et-transfer-to">
                        <SelectValue placeholder="Select an account or type to search..." />
                      </SelectTrigger>
                      <SelectContent>
                        {props.bankAccounts
                          .filter((a) => a.id !== fromBankAccountId)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Balance:{' '}
                    <span className="text-foreground font-semibold">
                      {formatCurrency(Number(toBalance ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="et-bank-account" className="text-xs font-semibold tracking-wide">
                    {mode === 'deposit' ? (
                      <>
                        DEPOSIT TO <span className="text-destructive">*</span>
                      </>
                    ) : (
                      <>
                        WITHDRAW FROM <span className="text-destructive">*</span>
                      </>
                    )}
                  </Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger id="et-bank-account">
                      <SelectValue placeholder="Select a bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.bankAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-muted-foreground mt-2 text-sm">
                    Balance:{' '}
                    <span className="text-foreground font-semibold">
                      {formatCurrency(Number(selectedBankBalance ?? 0))}
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="et-offset-gl" className="text-xs font-semibold tracking-wide">
                      OFFSETTING GL ACCOUNT <span className="text-destructive">*</span>
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground inline-flex h-5 w-5 items-center justify-center"
                          aria-label="Offsetting GL account help"
                        >
                          <Info className="h-4 w-4" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>
                          The offsetting GL account acts as a label for this deposit. For instance,
                          if you&apos;re depositing money collected from a washing machine, you
                          might select the &quot;Laundry income&quot; account.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={glAccountId} onValueChange={setGlAccountId}>
                    <SelectTrigger id="et-offset-gl">
                      <SelectValue placeholder="Select an account or type to search..." />
                    </SelectTrigger>
                    <SelectContent>
                      <GlAccountSelectItems accounts={props.glAccounts} />
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="et-other-amount" className="text-xs font-semibold tracking-wide">
                    {mode === 'deposit' ? (
                      <>
                        DEPOSIT AMOUNT <span className="text-destructive">*</span>
                      </>
                    ) : (
                      <>
                        WITHDRAWAL AMOUNT <span className="text-destructive">*</span>
                      </>
                    )}
                  </Label>
                  <Input
                    id="et-other-amount"
                    value={otherAmount}
                    onChange={(e) => setOtherAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="et-memo" className="text-xs font-semibold tracking-wide">
                MEMO
              </Label>
              <Textarea
                id="et-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="min-h-20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.replace(props.returnHref)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit('save')} disabled={isSaving}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void submit('delete')}
            disabled={isSaving}
            className="text-destructive"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { ArrowRight, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GlAccountSelectItems from '@/components/gl-accounts/GlAccountSelectItems';
import { Textarea } from '@/components/ui/textarea';

export type BankAccountOption = { id: string; label: string; balance?: number | null };
export type PropertyOption = { id: string; label: string };
export type UnitOption = { id: string; label: string; propertyId: string | null };
export type GlAccountOption = { id: string; label: string; type: string | null };

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

const PayloadSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('transfer'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    fromBankAccountId: z.string().min(1),
    toBankAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
  z.object({
    mode: z.literal('deposit'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
  z.object({
    mode: z.literal('withdrawal'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
]);

export default function RecordOtherTransactionForm(props: {
  bankAccountId: string;
  bankAccounts: BankAccountOption[];
  properties: PropertyOption[];
  units: UnitOption[];
  glAccounts: GlAccountOption[];
  defaultFromBankAccountId: string;
}) {
  const router = useRouter();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [mode, setMode] = useState<Mode>('transfer');
  const [date, setDate] = useState(todayIso);
  const [propertyId, setPropertyId] = useState<string>(COMPANY_SENTINEL);
  const [unitId, setUnitId] = useState<string>('');
  const [memo, setMemo] = useState('');

  // transfer
  const [fromBankAccountId, setFromBankAccountId] = useState(props.defaultFromBankAccountId);
  const [toBankAccountId, setToBankAccountId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('0.00');

  // deposit/withdrawal
  const [bankAccountId, setBankAccountId] = useState(props.defaultFromBankAccountId);
  const [glAccountId, setGlAccountId] = useState<string>('');
  const [otherAmount, setOtherAmount] = useState<string>('0.00');

  const [isSaving, setIsSaving] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<'save' | 'save-and-new'>('save');
  const [formError, setFormError] = useState<string | null>(null);

  const unitsByProperty = useMemo(() => {
    const map = new Map<string | null, UnitOption[]>();
    props.units.forEach((u) => {
      const list = map.get(u.propertyId ?? null) ?? [];
      list.push(u);
      map.set(u.propertyId ?? null, list);
    });
    return map;
  }, [props.units]);

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

  const propertyItems = useMemo(
    () => [{ id: COMPANY_SENTINEL, label: 'Company (no property)' }, ...props.properties],
    [props.properties],
  );

  const effectiveUnitOptions = useMemo(() => {
    if (!propertyId || propertyId === COMPANY_SENTINEL) return [];
    return unitsByProperty.get(propertyId) ?? [];
  }, [propertyId, unitsByProperty]);

  const submit = useCallback(
    async (intent: 'save' | 'save-and-new') => {
      setSubmitIntent(intent);
      setIsSaving(true);
      setFormError(null);

      try {
        const common = {
          date,
          propertyId: propertyId && propertyId !== COMPANY_SENTINEL ? propertyId : undefined,
          unitId: unitId || undefined,
          memo: memo || undefined,
        };

        const payload =
          mode === 'transfer'
            ? {
                mode,
                ...common,
                fromBankAccountId,
                toBankAccountId,
                amount: transferAmount,
              }
            : {
                mode,
                ...common,
                bankAccountId,
                glAccountId,
                amount: otherAmount,
              };

        const parsed = PayloadSchema.safeParse(payload);
        if (!parsed.success) {
          setFormError(
            parsed.error.issues?.[0]?.message ?? 'Fix the highlighted fields and try again.',
          );
          return;
        }

        const amountValue = parseAmount(
          parsed.data.mode === 'transfer' ? parsed.data.amount : parsed.data.amount,
        );
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
          setFormError('Enter an amount greater than $0.00.');
          return;
        }
        if (
          parsed.data.mode === 'transfer' &&
          parsed.data.fromBankAccountId === parsed.data.toBankAccountId
        ) {
          setFormError('Transfer from and transfer to must be different bank accounts.');
          return;
        }

        const res = await fetch(
          `/api/bank-accounts/${props.bankAccountId}/record-other-transaction`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            (body && typeof body.error === 'string' && body.error) ||
            (body?.error?.message as string | undefined) ||
            (body?.details as string | undefined) ||
            'Failed to record transaction.';
          throw new Error(message);
        }

        toast.success('Transaction recorded');

        if (intent === 'save-and-new') {
          setMemo('');
          setUnitId('');
          setToBankAccountId('');
          setTransferAmount('0.00');
          setGlAccountId('');
          setOtherAmount('0.00');
          setSubmitIntent('save');
          return;
        }

        router.push(`/bank-accounts/${props.bankAccountId}`);
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to record transaction.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      bankAccountId,
      date,
      fromBankAccountId,
      glAccountId,
      memo,
      mode,
      otherAmount,
      propertyId,
      props.bankAccountId,
      router,
      toBankAccountId,
      transferAmount,
      unitId,
    ],
  );

  return (
    <div className="w-full space-y-8 pb-10">
      {formError && (
        <div className="border-destructive/20 bg-destructive/10 rounded-md border p-4">
          <p className="text-destructive text-sm">{formError}</p>
        </div>
      )}

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
            <RadioGroupItem value="transfer" id="rot-transfer" />
            <Label htmlFor="rot-transfer" className="font-normal">
              Transfer
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="deposit" id="rot-deposit" />
            <Label htmlFor="rot-deposit" className="font-normal">
              Deposit
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="withdrawal" id="rot-withdrawal" />
            <Label htmlFor="rot-withdrawal" className="font-normal">
              Withdrawal
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <div className="text-sm font-semibold">Transaction details</div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rot-date" className="text-xs font-semibold tracking-wide">
              DATE <span className="text-destructive">*</span>
            </Label>
            <DatePicker id="rot-date" value={date} onChange={(value) => setDate(value ?? '')} />
          </div>

          <div>
            <Label htmlFor="rot-property" className="text-xs font-semibold tracking-wide">
              PROPERTY OR COMPANY <span className="text-destructive">*</span>
            </Label>
            <Select
              value={propertyId}
              onValueChange={(value) => {
                setPropertyId(value);
                setUnitId('');
              }}
            >
              <SelectTrigger id="rot-property">
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

          {propertyId !== COMPANY_SENTINEL && (
            <div className="sm:col-span-2">
              <Label htmlFor="rot-unit" className="text-xs font-semibold tracking-wide">
                UNIT
              </Label>
              <Select value={unitId} onValueChange={(value) => setUnitId(value)}>
                <SelectTrigger id="rot-unit">
                  <SelectValue placeholder="Select a unit (optional)" />
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
          )}
        </div>

        {mode === 'transfer' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
            <div className="space-y-3">
              <div>
                <Label htmlFor="rot-transfer-from" className="text-xs font-semibold tracking-wide">
                  TRANSFER FROM <span className="text-destructive">*</span>
                </Label>
                <Select value={fromBankAccountId} onValueChange={setFromBankAccountId}>
                  <SelectTrigger id="rot-transfer-from">
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
                <Label
                  htmlFor="rot-transfer-amount"
                  className="text-xs font-semibold tracking-wide"
                >
                  TRANSFER AMOUNT <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rot-transfer-amount"
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
                <Label htmlFor="rot-transfer-to" className="text-xs font-semibold tracking-wide">
                  TRANSFER TO <span className="text-destructive">*</span>
                </Label>
                <Select value={toBankAccountId} onValueChange={setToBankAccountId}>
                  <SelectTrigger id="rot-transfer-to">
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
              <Label htmlFor="rot-deposit-to" className="text-xs font-semibold tracking-wide">
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
                <SelectTrigger id="rot-deposit-to">
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
                <Label htmlFor="rot-offset-account" className="text-xs font-semibold tracking-wide">
                  OFFSETTING GL ACCOUNT <span className="text-destructive">*</span>
                </Label>
                <Info className="text-muted-foreground h-4 w-4" aria-hidden />
              </div>
              <Select value={glAccountId} onValueChange={setGlAccountId}>
                <SelectTrigger id="rot-offset-account">
                  <SelectValue placeholder="Select an account or type to search..." />
                </SelectTrigger>
                <SelectContent>
                  <GlAccountSelectItems accounts={props.glAccounts} />
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="rot-other-amount" className="text-xs font-semibold tracking-wide">
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
                id="rot-other-amount"
                value={otherAmount}
                onChange={(e) => setOtherAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="rot-memo" className="text-xs font-semibold tracking-wide">
            MEMO
          </Label>
          <Textarea
            id="rot-memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="min-h-20"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/bank-accounts/${props.bankAccountId}`)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => submit('save-and-new')}
            disabled={isSaving}
          >
            Save &amp; add another
          </Button>
          <Button type="button" onClick={() => submit('save')} disabled={isSaving}>
            {isSaving && submitIntent === 'save' ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

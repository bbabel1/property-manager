'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { AlertTriangle, Plus, Trash2, UploadCloud, Paperclip } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';

export type BankAccountOption = {
  id: string;
  name: string;
  account_number?: string | null;
};

export type PayeeOption = {
  id: string;
  label: string;
  buildiumId: number | null;
};

export type PropertyOption = {
  id: string;
  label: string;
  buildiumPropertyId: number | null;
  rentalType: string | null;
};

export type UnitOption = {
  id: string;
  label: string;
  propertyId: string | null;
  buildiumUnitId: number | null;
};

export type GlAccountOption = {
  id: string;
  label: string;
  buildiumGlAccountId: number | null;
};

export type BillsPaidRow = {
  dueDate: string | null;
  vendorName: string;
  memo: string | null;
  referenceNumber: string | null;
  amount: number;
};

type CheckAllocationLine = {
  id: string;
  propertyId: string;
  unitId: string;
  glAccountId: string;
  description: string;
  referenceNumber: string;
  amount: string;
};

type CheckData = {
  id: string;
  date: string;
  memo: string | null;
  check_number: string | null;
  bank_gl_account_id: string | null;
  vendor_id: string | null;
  payee_buildium_id: number | null;
  payee_buildium_type: string | null;
  buildium_bill_id: number | null;
  allocations: CheckAllocationLine[];
};

type AttachmentPreview = {
  id: string;
  file: File;
};

const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_SIZE_MB = 20;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const parseCurrencyInput = (value: string | null | undefined) => {
  if (typeof value !== 'string') return 0;
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmtUsd = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(value) ? value : 0,
  );

const AllocationLineSchema = z.object({
  id: z.string(),
  propertyId: z.string().min(1, 'Select a property'),
  unitId: z.string().optional(),
  glAccountId: z.string().min(1, 'Select an account'),
  description: z.string().max(2000).optional(),
  referenceNumber: z.string().max(255).optional(),
  amount: z.string(),
});

const FormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  bankAccountId: z.string().min(1, 'Bank account is required'),
  checkNumber: z.string().max(32).optional(),
  queueForPrinting: z.boolean().optional(),
  payeeType: z.enum(['Vendor', 'RentalOwner']),
  payeeId: z.string().min(1, 'Payee is required'),
  memo: z.string().max(2000).optional(),
  lines: z
    .array(
      AllocationLineSchema.refine(
        (line) => parseCurrencyInput(line.amount) > 0,
        'Enter a positive amount for each line',
      ),
    )
    .min(1, 'Add at least one allocation'),
});

type FormState = z.infer<typeof FormSchema>;

function buildInitialLine(): CheckAllocationLine {
  return {
    id: makeId(),
    propertyId: '',
    unitId: '',
    glAccountId: '',
    description: '',
    referenceNumber: '',
    amount: '',
  };
}

function coerceInitialPayee(check: CheckData): { type: 'Vendor' | 'RentalOwner'; id: string } {
  // Internal references must use local IDs. For vendor payees, use vendor_id.
  // (Rental owner payees are not currently stored as a local owner_id on transactions.)
  if (check.vendor_id) return { type: 'Vendor', id: check.vendor_id };
  return { type: 'Vendor', id: '' };
}

export default function EditCheckForm(props: {
  check: CheckData;
  bankAccountId: string;
  bankAccounts: BankAccountOption[];
  vendors: PayeeOption[];
  rentalOwners: PayeeOption[];
  properties: PropertyOption[];
  units: UnitOption[];
  glAccounts: GlAccountOption[];
  billsPaid?: BillsPaidRow[];
  patchUrl: string;
  deleteUrl: string;
  returnHref: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialPayee = useMemo(() => coerceInitialPayee(props.check), [props.check]);
  const [form, setForm] = useState<FormState>(() => ({
    date: props.check.date?.slice(0, 10) ?? '',
    bankAccountId: props.check.bank_gl_account_id || props.bankAccountId,
    checkNumber: props.check.check_number ?? '',
    queueForPrinting: false,
    payeeType: initialPayee.type,
    payeeId: initialPayee.id,
    memo: props.check.memo ?? '',
    lines: props.check.allocations?.length
      ? props.check.allocations.map((l) => ({
          id: l.id || makeId(),
          propertyId: l.propertyId || '',
          unitId: l.unitId || '',
          glAccountId: l.glAccountId || '',
          description: l.description || '',
          referenceNumber: l.referenceNumber || '',
          amount: l.amount || '',
        }))
      : [buildInitialLine()],
  }));

  const isLockedByBill = Boolean(props.check.buildium_bill_id);

  const unitsByProperty = useMemo(() => {
    const map = new Map<string | null, UnitOption[]>();
    for (const unit of props.units) {
      const list = map.get(unit.propertyId ?? null) ?? [];
      list.push(unit);
      map.set(unit.propertyId ?? null, list);
    }
    return map;
  }, [props.units]);

  const totalAmount = useMemo(
    () => form.lines.reduce((sum, line) => sum + parseCurrencyInput(line.amount), 0),
    [form.lines],
  );

  const payeeOptions = form.payeeType === 'Vendor' ? props.vendors : props.rentalOwners;

  const setFormValue = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((previous) => ({ ...previous, [key]: value }));
      setFieldErrors((previous) => {
        if (!previous[key as string]) return previous;
        const next = { ...previous };
        delete next[key as string];
        return next;
      });
      setFormError(null);
    },
    [],
  );

  const setLineValue = useCallback(
    <K extends keyof CheckAllocationLine>(lineId: string, key: K, value: CheckAllocationLine[K]) => {
      setForm((previous) => ({
        ...previous,
        lines: previous.lines.map((line) => (line.id === lineId ? { ...line, [key]: value } : line)),
      }));
      setFormError(null);
    },
    [],
  );

  const addLine = useCallback(() => {
    setForm((previous) => ({ ...previous, lines: [...previous.lines, buildInitialLine()] }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setForm((previous) => {
      const next = previous.lines.filter((line) => line.id !== lineId);
      return { ...previous, lines: next.length ? next : [buildInitialLine()] };
    });
  }, []);

  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const validateAttachments = useCallback(
    (files: File[]) => {
      if (!files.length) return { ok: true as const, files: [] as File[] };
      const nextCount = attachments.length + files.length;
      if (nextCount > MAX_ATTACHMENT_COUNT) {
        return { ok: false as const, error: `Attachments limited to ${MAX_ATTACHMENT_COUNT} files.` };
      }
      const tooLarge = files.find((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
      if (tooLarge) {
        return { ok: false as const, error: `${tooLarge.name} exceeds ${MAX_ATTACHMENT_SIZE_MB}MB.` };
      }
      return { ok: true as const, files };
    },
    [attachments.length],
  );

  const appendAttachments = useCallback(
    (files: File[]) => {
      const result = validateAttachments(files);
      if (!result.ok) {
        setAttachmentError(result.error);
        return;
      }
      setAttachmentError(null);
      setAttachments((previous) => [
        ...previous,
        ...result.files.map((file) => ({ id: makeId(), file })),
      ]);
    },
    [validateAttachments],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(false);
      const files = Array.from(event.dataTransfer.files ?? []).filter(Boolean);
      appendAttachments(files);
    },
    [appendAttachments],
  );

  const onBrowseFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((previous) => previous.filter((a) => a.id !== id));
  }, []);

  const submit = useCallback(
    async (intent: 'save' | 'void') => {
      setIsSaving(true);
      setFormError(null);
      setFieldErrors({});

      try {
        if (intent === 'save') {
          const parsed = FormSchema.safeParse(form);
          if (!parsed.success) {
            const nextErrors: Record<string, string> = {};
            const first = parsed.error.issues?.[0];
            parsed.error.issues.forEach((issue) => {
              const key = issue.path?.[0] ? String(issue.path[0]) : 'form';
              if (!nextErrors[key]) nextErrors[key] = issue.message;
            });
            setFieldErrors(nextErrors);
            setFormError(first?.message ?? 'Fix the highlighted fields and try again.');
            return;
          }
        }

        const res = await fetch(props.patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            intent === 'void'
              ? { action: 'void' }
              : {
                  bank_gl_account_id: form.bankAccountId || null,
                  date: form.date,
                  memo: form.memo ? form.memo : null,
                  check_number: form.checkNumber ? form.checkNumber : null,
                  payeeType: form.payeeType,
                  payeeId: form.payeeId,
                  allocations: isLockedByBill ? undefined : form.lines,
                },
          ),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            (body && typeof body.error === 'string' && body.error) ||
            (body?.error?.message as string | undefined) ||
            (body?.details as string | undefined) ||
            (intent === 'void' ? 'Failed to void check.' : 'Failed to update check.');
          throw new Error(message);
        }

        toast.success(intent === 'void' ? 'Check voided' : 'Check updated');
        router.replace(props.returnHref);
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to update check.');
      } finally {
        setIsSaving(false);
      }
    },
    [form, isLockedByBill, props.patchUrl, props.returnHref, router],
  );

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to delete this check?')) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const res = await fetch(props.deleteUrl, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (body && typeof body.error === 'string' && body.error) || 'Failed to delete check';
        throw new Error(message);
      }
      toast.success('Check deleted');
      router.replace(props.returnHref);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete check.');
    } finally {
      setIsSaving(false);
    }
  }, [props.deleteUrl, props.returnHref, router]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [],
  );
  const billsPaid = props.billsPaid ?? [];

  return (
    <div className="w-full space-y-6 pb-10">
      {isLockedByBill && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden />
            <div>
              You cannot change the amount of this check or how it is split among accounts because
              it was used to pay a bill. To change the accounts, you need to change the associated
              bill.{billsPaid.length ? ' See the list of bills below.' : ''}
            </div>
          </div>
        </div>
      )}

      {formError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{formError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="edit-check-date" className="text-xs font-semibold tracking-wide">
            DATE <span className="text-destructive">*</span>
          </Label>
          <Input
            id="edit-check-date"
            type="date"
            value={form.date}
            onChange={(e) => setFormValue('date', e.target.value)}
            aria-invalid={Boolean(fieldErrors.date)}
          />
          {fieldErrors.date && <p className="mt-1 text-xs text-destructive">{fieldErrors.date}</p>}
        </div>

        <div>
          <Label htmlFor="edit-check-bank-account" className="text-xs font-semibold tracking-wide">
            BANK ACCOUNT <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.bankAccountId}
            onValueChange={(value) => setFormValue('bankAccountId', value)}
            disabled={isLockedByBill}
          >
            <SelectTrigger id="edit-check-bank-account" aria-invalid={Boolean(fieldErrors.bankAccountId)}>
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {props.bankAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {a.account_number ? ` - ${a.account_number}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.bankAccountId && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.bankAccountId}</p>
          )}
        </div>

        <div className="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="edit-check-number" className="text-xs font-semibold tracking-wide">
              CHECK NUMBER
            </Label>
            <Input
              id="edit-check-number"
              value={form.checkNumber ?? ''}
              onChange={(e) => setFormValue('checkNumber', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 pb-1 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={Boolean(form.queueForPrinting)}
              onChange={(e) => setFormValue('queueForPrinting', e.target.checked)}
            />
            Queue check(s) for printing
          </label>
        </div>

        <div className={cn('sm:col-span-2 space-y-2', isLockedByBill && 'rounded-md bg-muted/40 p-3')}>
          <Label className="text-xs font-semibold tracking-wide">
            PAY TO <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            value={form.payeeType}
            onValueChange={(value) => {
              if (isLockedByBill) return;
              const next = value === 'RentalOwner' ? 'RentalOwner' : 'Vendor';
              setForm((previous) => ({ ...previous, payeeType: next, payeeId: '' }));
              setFieldErrors((previous) => {
                const nextErrors = { ...previous };
                delete nextErrors.payeeId;
                return nextErrors;
              });
            }}
            className="grid gap-3"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="Vendor" id="edit-check-payee-vendor" disabled={isLockedByBill} />
              <Label htmlFor="edit-check-payee-vendor" className="font-normal">
                Vendor
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="RentalOwner" id="edit-check-payee-owner" disabled={isLockedByBill} />
              <Label htmlFor="edit-check-payee-owner" className="font-normal">
                Rental owner
              </Label>
            </div>
          </RadioGroup>

          <div className="space-y-1">
            <Select
              value={form.payeeId}
              onValueChange={(value) => setFormValue('payeeId', value)}
              disabled={isLockedByBill}
            >
              <SelectTrigger aria-invalid={Boolean(fieldErrors.payeeId)}>
                <SelectValue
                  placeholder={
                    form.payeeType === 'Vendor'
                      ? 'Type or select a vendor...'
                      : 'Type or select a rental owner...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {payeeOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.payeeType === 'Vendor' && (
              <div className="text-xs">
                <Link
                  className={cn('text-primary underline', isLockedByBill && 'pointer-events-none text-muted-foreground')}
                  href="/vendors"
                  target="_blank"
                  aria-disabled={isLockedByBill}
                >
                  [Add Vendor]
                </Link>
              </div>
            )}
            {fieldErrors.payeeId && <p className="mt-1 text-xs text-destructive">{fieldErrors.payeeId}</p>}
          </div>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="edit-check-memo" className="text-xs font-semibold tracking-wide">
            MEMO
          </Label>
          <Textarea
            id="edit-check-memo"
            value={form.memo ?? ''}
            onChange={(e) => setFormValue('memo', e.target.value)}
            className="min-h-20"
            maxLength={2000}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Allocations</div>
          <Button type="button" variant="ghost" className="w-fit px-2" onClick={addLine} disabled={isLockedByBill}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add row
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Property or company
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Unit
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Account
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Description
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Ref No.
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="w-[3rem]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.lines.map((line) => {
                const unitOptions = unitsByProperty.get(line.propertyId || null) ?? [];
                return (
                  <TableRow key={line.id} className="border-b last:border-0">
                    <TableCell className="align-top">
                      <Select
                        value={line.propertyId}
                        onValueChange={(value) => {
                          setLineValue(line.id, 'propertyId', value);
                          setLineValue(line.id, 'unitId', '');
                        }}
                        disabled={isLockedByBill}
                      >
                        <SelectTrigger className="min-w-[16rem]">
                          <SelectValue placeholder="Select a property..." />
                        </SelectTrigger>
                        <SelectContent>
                          {props.properties.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="align-top">
                      <Select
                        value={line.unitId}
                        onValueChange={(value) => setLineValue(line.id, 'unitId', value)}
                        disabled={isLockedByBill}
                      >
                        <SelectTrigger className="min-w-[12rem]">
                          <SelectValue placeholder="Select a unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {unitOptions.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="align-top">
                      <Select
                        value={line.glAccountId}
                        onValueChange={(value) => setLineValue(line.id, 'glAccountId', value)}
                        disabled={isLockedByBill}
                      >
                        <SelectTrigger className="min-w-[18rem]">
                          <SelectValue placeholder="Type or select an account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {props.glAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="align-top">
                      <Input
                        value={line.description}
                        onChange={(e) => setLineValue(line.id, 'description', e.target.value)}
                        className="min-w-[16rem]"
                        disabled={isLockedByBill}
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <Input
                        value={line.referenceNumber}
                        onChange={(e) => setLineValue(line.id, 'referenceNumber', e.target.value)}
                        className="min-w-[10rem]"
                        disabled={isLockedByBill}
                      />
                    </TableCell>

                    <TableCell className="align-top text-right">
                      <Input
                        value={line.amount}
                        onChange={(e) => setLineValue(line.id, 'amount', e.target.value)}
                        inputMode="decimal"
                        placeholder="$0.00"
                        className="min-w-[9rem] text-right"
                        disabled={isLockedByBill}
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        className="h-9 w-9"
                        aria-label="Remove row"
                        disabled={isLockedByBill}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              <TableRow>
                <TableCell colSpan={5} className="text-sm font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">{fmtUsd(totalAmount)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {billsPaid.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">Bills paid</div>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Due date
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Vendor
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Memo
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Reference no.
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billsPaid.map((row, idx) => (
                  <TableRow key={`${row.referenceNumber ?? 'bill'}-${idx}`} className="border-b last:border-0">
                    <TableCell className="text-sm">
                      {row.dueDate ? dateFormatter.format(new Date(`${row.dueDate}T00:00:00Z`)) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{row.vendorName || '—'}</TableCell>
                    <TableCell className="text-sm">{row.memo || '—'}</TableCell>
                    <TableCell className="text-sm">{row.referenceNumber || '—'}</TableCell>
                    <TableCell className="text-right text-sm">{fmtUsd(Number(row.amount || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-sm font-semibold">Attachments</div>
          <div className="text-xs text-muted-foreground">
            Limited to {MAX_ATTACHMENT_COUNT} files. Max file size is {MAX_ATTACHMENT_SIZE_MB}MB.
          </div>
        </div>

        {attachmentError && <p className="text-xs text-destructive">{attachmentError}</p>}

        <div
          className={cn(
            'border-muted-foreground/30 rounded-md border border-dashed p-6 transition-colors',
            isDragActive && 'border-primary/60 bg-primary/5',
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(false);
          }}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onClick={onBrowseFiles}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onBrowseFiles();
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden />
            <div className="text-sm text-muted-foreground">
              Drag &amp; drop files here or{' '}
              <button
                type="button"
                className="text-primary underline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBrowseFiles();
                }}
              >
                browse
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).filter(Boolean);
              appendAttachments(files);
              e.target.value = '';
            }}
          />
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div className="truncate text-sm">{a.file.name}</div>
                  <div className="text-xs text-muted-foreground">{Math.round(a.file.size / 1024)} KB</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(a.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" onClick={() => submit('save')} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => submit('void')}
            disabled={isSaving}
          >
            Void
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              router.push(props.returnHref);
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={handleDelete} disabled={isSaving} className="text-destructive">
          Delete
        </Button>
      </div>
    </div>
  );
}


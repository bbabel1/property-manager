'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  LargeDialogContent,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/components/ui/utils';
import {
  ChevronsUpDown,
  Paperclip,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';

const MAX_ATTACHMENT_BYTES = 1000 * 1024;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Select an account'),
  description: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
});

const journalEntrySchema = z.object({
  date: z.string().min(1, 'Select a date'),
  propertyId: z.string().min(1, 'Select a property or company'),
  unitId: z.string().min(1, 'Select a unit'),
  memo: z.string().max(255, 'Memo must be 255 characters or fewer').optional(),
  lines: z.array(journalLineSchema).min(2, 'Add at least two lines'),
});

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>;

type PropertyOption = { id: string; label: string };
type UnitOption = { id: string; label: string };
export type AccountOption = {
  value: string;
  label: string;
  group?: string | null;
  groupLabel?: string | null;
};

export type GeneralJournalEntryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyOptions: PropertyOption[];
  unitOptions: UnitOption[];
  accountOptions: AccountOption[];
  defaultPropertyId?: string;
  defaultUnitId?: string;
};

const parseCurrencyInput = (value?: string | null) => {
  if (!value) return 0;
  const numeric = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const createEmptyLine = (): JournalEntryFormValues['lines'][number] => ({
  accountId: '',
  description: '',
  debit: '',
  credit: '',
});

const RequiredMark = () => <span className="text-destructive ml-0.5">*</span>;

type AccountPickerProps = {
  value: string;
  onChange: (next: string) => void;
  options: AccountOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

function AccountPicker({ value, onChange, options, placeholder = 'Type or select an account', disabled, id }: AccountPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!triggerRef.current) return;
    const updateWidth = () => {
      setContentWidth(triggerRef.current?.offsetWidth ?? null);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, []);

  const groupedOptions = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; items: AccountOption[] }
    >();
    options.forEach((option) => {
      const key = option.group || 'other';
      const label = option.groupLabel || option.group || 'Other accounts';
      if (!groups.has(key)) {
        groups.set(key, { label, items: [] });
      }
      groups.get(key)!.items.push(option);
    });
    return Array.from(groups.values());
  }, [options]);

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select account"
          disabled={disabled}
          className={cn(
            'justify-between truncate',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="border-none bg-transparent p-0 pt-3 shadow-none overflow-visible"
        style={contentWidth ? { width: contentWidth, minWidth: contentWidth } : undefined}
      >
        <Command className="h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
          <CommandInput
            placeholder="Search accounts…"
            className="border-b border-border px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-0 rounded-t-lg"
          />
          <CommandList
            onWheel={(event) => event.stopPropagation()}
            className="max-h-[220px] overflow-y-auto py-1"
          >
            <CommandEmpty>No accounts match your search.</CommandEmpty>
            {groupedOptions.map((group) => (
              <CommandGroup
                key={group.label}
                heading={group.label}
                className="px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
              >
                {group.items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={`${item.label} ${item.value}`}
                    className="px-3 py-2 text-sm"
                    onSelect={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function GeneralJournalEntryModal({
  open,
  onOpenChange,
  propertyOptions,
  unitOptions,
  accountOptions,
  defaultPropertyId,
  defaultUnitId,
}: GeneralJournalEntryModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formLevelError, setFormLevelError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const buildDefaultValues = useCallback(
    (): JournalEntryFormValues => ({
      date: new Date().toISOString().slice(0, 10),
      propertyId: defaultPropertyId || (propertyOptions[0]?.id ?? ''),
      unitId: defaultUnitId || '',
      memo: '',
      lines: [createEmptyLine(), createEmptyLine()],
    }),
    [defaultPropertyId, defaultUnitId, propertyOptions],
  );

  const form = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    mode: 'onChange',
    defaultValues: buildDefaultValues(),
  });

  const { control, formState, handleSubmit, reset, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaultValues());
      setAttachment(null);
      setAttachmentError(null);
      setFormLevelError(null);
    }
  }, [open, buildDefaultValues, reset]);

  const lines = watch('lines') || [];
  const totals = useMemo(() => {
    return lines.reduce(
      (running, line) => {
        running.debit += parseCurrencyInput(line.debit);
        running.credit += parseCurrencyInput(line.credit);
        return running;
      },
      { debit: 0, credit: 0 },
    );
  }, [lines]);

  const linesHaveAmounts = lines.every(
    (line) => parseCurrencyInput(line.debit) > 0 || parseCurrencyInput(line.credit) > 0,
  );
  const totalsMatch = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.005;
  const helperMessage = !linesHaveAmounts
    ? ''
    : !totalsMatch
      ? 'Debits must equal credits before you can save.'
      : '';

  const canSubmit = formState.isValid && linesHaveAmounts && totalsMatch && !isSaving;

  const handleAttachmentSelection = (incoming: FileList | null) => {
    const file = incoming?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null);
      setAttachmentError('Attachments must be 1,000 kb or smaller.');
      return;
    }
    setAttachment(file);
    setAttachmentError(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleAttachmentSelection(event.dataTransfer?.files ?? null);
  };

  const handleAmountChange =
    (index: number, field: 'debit' | 'credit') => (event: ChangeEvent<HTMLInputElement>) => {
      const cleaned = event.target.value.replace(/[^0-9.]/g, '');
      setValue(`lines.${index}.${field}`, cleaned, { shouldDirty: true, shouldValidate: true });
      if (field === 'debit' && cleaned) {
        setValue(`lines.${index}.credit`, '', { shouldDirty: true, shouldValidate: true });
      }
      if (field === 'credit' && cleaned) {
        setValue(`lines.${index}.debit`, '', { shouldDirty: true, shouldValidate: true });
      }
    };

  const submitForm = async (values: JournalEntryFormValues) => {
    if (!linesHaveAmounts) {
      setFormLevelError('Make sure every line has a debit or credit amount.');
      return;
    }
    if (!totalsMatch) {
      setFormLevelError('Debits have to match credits before saving.');
      return;
    }

    setFormLevelError(null);
    setIsSaving(true);

    try {
      // Placeholder persistence hook. Replace with API call when backend is ready.
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast.success('Journal entry saved.');
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      setFormLevelError('Something went wrong while saving. Please try again.');
      toast.error('Unable to save journal entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = handleSubmit(submitForm);

  const formErrors = formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LargeDialogContent
        ref={contentRef}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => contentRef.current?.focus());
        }}
        className="w-[min(1100px,95vw)] max-h-[95vh] overflow-hidden p-0"
      >
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex max-h-[95vh] flex-col">
            <DialogHeader className="border-border px-6 py-4">
              <DialogTitle>General Journal Entry</DialogTitle>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <FormField
                  control={control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Date
                        <RequiredMark />
                      </FormLabel>
                      <FormControl>
                        <DateInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={control}
                  name="propertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Property or company
                        <RequiredMark />
                      </FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger aria-label="Select property or company">
                            <SelectValue placeholder="Select a property or company" />
                          </SelectTrigger>
                          <SelectContent>
                            {propertyOptions.length === 0 ? (
                              <SelectItem value="" disabled>
                                No properties available
                              </SelectItem>
                            ) : (
                              propertyOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Unit
                        <RequiredMark />
                      </FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger aria-label="Select unit">
                            <SelectValue placeholder="Select a unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {unitOptions.length === 0 ? (
                              <SelectItem value="" disabled>
                                No units available
                              </SelectItem>
                            ) : (
                              unitOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memo</FormLabel>
                    <FormControl>
                      <Input placeholder="Add a memo for this entry" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <section aria-labelledby="journal-grid-title" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 id="journal-grid-title" className="text-sm font-semibold text-foreground">
                    Debits and credits
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => append(createEmptyLine())}
                  >
                    <Plus className="size-4" />
                    Add lines
                  </Button>
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <TableHead className="w-[30%]">Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-32 text-right">Debit</TableHead>
                        <TableHead className="w-32 text-right">Credit</TableHead>
                        <TableHead className="w-16 text-right" aria-label="Actions" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((fieldItem, index) => {
                        const line = lines[index] ?? createEmptyLine();
                        const lineErrors = (formErrors.lines?.[index] || {}) as Record<string, any>;
                        return (
                          <TableRow key={fieldItem.id} className="align-top">
                            <TableCell className="space-y-1 py-3">
                              <Controller
                                control={control}
                                name={`lines.${index}.accountId`}
                                render={({ field: controllerField }) => (
                                  <AccountPicker
                                    id={`lines-${index}-account`}
                                    value={controllerField.value}
                                    onChange={(next) => controllerField.onChange(next)}
                                    options={accountOptions}
                                  />
                                )}
                              />
                              {lineErrors?.accountId ? (
                                <p className="text-destructive text-xs">{lineErrors.accountId.message}</p>
                              ) : null}
                            </TableCell>
                            <TableCell className="space-y-1 py-3">
                              <Input
                                aria-label="Line description"
                                placeholder="Description"
                                value={line.description || ''}
                                onChange={(event) =>
                                  setValue(`lines.${index}.description`, event.target.value, {
                                    shouldDirty: true,
                                  })
                                }
                              />
                              {lineErrors?.description ? (
                                <p className="text-destructive text-xs">{lineErrors.description.message}</p>
                              ) : null}
                            </TableCell>
                            <TableCell className="py-3">
                              <Input
                                inputMode="decimal"
                                aria-label="Debit amount"
                                placeholder="$0.00"
                                value={line.debit || ''}
                                className="text-right"
                                onChange={handleAmountChange(index, 'debit')}
                              />
                            </TableCell>
                            <TableCell className="py-3">
                              <Input
                                inputMode="decimal"
                                aria-label="Credit amount"
                                placeholder="$0.00"
                                value={line.credit || ''}
                                className="text-right"
                                onChange={handleAmountChange(index, 'credit')}
                              />
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Remove line"
                                className="text-destructive"
                                disabled={fields.length <= 2}
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/30 font-semibold text-sm">
                        <TableCell colSpan={3} className="text-right uppercase tracking-wide text-muted-foreground">
                          Total
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(totals.debit)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totals.credit)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </section>


              <section aria-labelledby="attachment-title" className="space-y-3">
                <div>
                  <h3 id="attachment-title" className="text-sm font-semibold text-foreground">
                    Attachment <span className="text-muted-foreground text-xs font-normal">(1 file up to 1000 kb)</span>
                  </h3>
                </div>
                <div
                  className={cn(
                    'rounded-lg border-2 border-dashed border-border/70 px-4 py-6 text-center',
                    attachment ? 'bg-muted/40' : 'bg-background',
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="mx-auto mb-3 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Drag & drop a supporting document, or{' '}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => attachmentInputRef.current?.click()}
                    >
                      browse your computer
                    </button>
                  </p>
                  <p className="text-muted-foreground text-xs">PDF or image formats work best.</p>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="sr-only"
                    onChange={(event) => handleAttachmentSelection(event.target.files)}
                  />
                </div>
                {attachmentError ? <p className="text-destructive text-sm">{attachmentError}</p> : null}
                {attachment ? (
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Paperclip className="size-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{attachment.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {(attachment.size / 1024).toFixed(0)} kb
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAttachment(null);
                        setAttachmentError(null);
                        if (attachmentInputRef.current) {
                          attachmentInputRef.current.value = '';
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {formLevelError ? (
                  <span className="text-destructive">{formLevelError}</span>
                ) : helperMessage ? (
                  helperMessage
                ) : (
                  'Totals must balance before submitting.'
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </LargeDialogContent>
    </Dialog>
  );
}

export default GeneralJournalEntryModal;

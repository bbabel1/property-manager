'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateInput } from '@/components/ui/date-input';
import { cn } from '@/components/ui/utils';

type PresetValue =
  | 'custom'
  | 'last30'
  | 'last60'
  | 'last90'
  | 'lastMonth'
  | 'lastQuarter'
  | 'lastYear'
  | 'currentMonth'
  | 'currentQuarter'
  | 'currentYear';

type DateRangeControlsProps = {
  defaultFrom: Date;
  defaultTo: Date;
  defaultRange?: string | null;
};

const PRESETS: Array<{
  value: PresetValue;
  label: string;
  compute?: (reference: Date) => { from: Date; to: Date };
}> = [
  { value: 'custom', label: 'Custom' },
  {
    value: 'last30',
    label: 'Last 30 days',
    compute: (reference) => ({ to: reference, from: shiftDays(reference, -29) }),
  },
  {
    value: 'last60',
    label: 'Last 60 days',
    compute: (reference) => ({ to: reference, from: shiftDays(reference, -59) }),
  },
  {
    value: 'last90',
    label: 'Last 90 days',
    compute: (reference) => ({ to: reference, from: shiftDays(reference, -89) }),
  },
  {
    value: 'lastMonth',
    label: 'Last Month',
    compute: (reference) => {
      const start = startOfMonth(addMonths(reference, -1));
      const end = endOfMonth(addMonths(reference, -1));
      return { from: start, to: end };
    },
  },
  {
    value: 'lastQuarter',
    label: 'Last Quarter',
    compute: (reference) => {
      const currentQuarterStart = getQuarterStart(reference);
      const previousQuarterEnd = shiftDays(currentQuarterStart, -1);
      const previousQuarterStart = getQuarterStart(addMonths(reference, -3));
      return { from: previousQuarterStart, to: previousQuarterEnd };
    },
  },
  {
    value: 'lastYear',
    label: 'Last Year',
    compute: (reference) => {
      const year = reference.getFullYear() - 1;
      const from = startOfDay(new Date(year, 0, 1));
      const to = endOfYear(year);
      return { from, to };
    },
  },
  {
    value: 'currentMonth',
    label: 'Current Month',
    compute: (reference) => {
      const from = startOfMonth(reference);
      const to = endOfMonth(reference);
      return { from, to };
    },
  },
  {
    value: 'currentQuarter',
    label: 'Current Quarter',
    compute: (reference) => {
      const from = getQuarterStart(reference);
      return { from, to: reference };
    },
  },
  {
    value: 'currentYear',
    label: 'Current Year',
    compute: (reference) => {
      const from = startOfDay(new Date(reference.getFullYear(), 0, 1));
      return { from, to: reference };
    },
  },
];

export default function DateRangeControls({
  defaultFrom,
  defaultTo,
  defaultRange,
}: DateRangeControlsProps) {
  const fromStr = useMemo(() => defaultFrom.toISOString().slice(0, 10), [defaultFrom]);
  const toStr = useMemo(() => defaultTo.toISOString().slice(0, 10), [defaultTo]);

  const initialRange = useMemo(() => {
    if (defaultRange && PRESETS.some((preset) => preset.value === defaultRange)) {
      return defaultRange as PresetValue;
    }
    return 'custom';
  }, [defaultRange]);

  const [range, setRange] = useState<PresetValue>(initialRange);
  const [presetOpen, setPresetOpen] = useState(false);
  const selectedPreset = useMemo(() => PRESETS.find((preset) => preset.value === range), [range]);
  const [fromValue, setFromValue] = useState(fromStr);
  const [toValue, setToValue] = useState(toStr);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setRange(initialRange);
  }, [initialRange]);

  useEffect(() => {
    setFromValue(fromStr);
  }, [fromStr]);

  useEffect(() => {
    setToValue(toStr);
  }, [toStr]);

  const updateSearch = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const base = searchParams ? searchParams.toString() : '';
      const params = new URLSearchParams(base);
      mutator(params);
      params.delete('as_of');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function handleDateChange(param: 'from' | 'to', value: string) {
    setRange('custom');
    if (param === 'from') setFromValue(value);
    if (param === 'to') setToValue(value);
    updateSearch((params) => {
      if (value) params.set(param, value);
      else params.delete(param);
      params.delete('range');
    });
  }

  function handlePresetChange(next: PresetValue) {
    setRange(next);
    if (next === 'custom') {
      updateSearch((params) => {
        params.delete('range');
      });
      return;
    }

    const preset = PRESETS.find((p) => p.value === next);
    if (!preset?.compute) return;

    const baseReference = next.startsWith('current') ? new Date() : (defaultTo ?? new Date());
    const reference = startOfDay(baseReference);
    const { from, to } = preset.compute(reference);

    const formattedFrom = formatDate(from);
    const formattedTo = formatDate(to);
    setFromValue(formattedFrom);
    setToValue(formattedTo);

    updateSearch((params) => {
      params.set('from', formattedFrom);
      params.set('to', formattedTo);
      params.set('range', next);
    });
  }

  function handlePresetSelect(next: PresetValue) {
    handlePresetChange(next);
    setPresetOpen(false);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-[14rem] flex-col gap-1">
        <label
          htmlFor="date-range-select"
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          Date range
        </label>
        <Popover open={presetOpen} onOpenChange={setPresetOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              id="date-range-select"
              className="border-input bg-input-background text-foreground/80 focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-[14rem] items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-[color,box-shadow] outline-none focus-visible:ring-1"
              aria-haspopup="dialog"
              aria-expanded={presetOpen}
            >
              <span className="line-clamp-1">{selectedPreset?.label || 'Custom'}</span>
              <ChevronDownIcon className="size-4 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[16rem] p-1">
            <div className="max-h-60 overflow-auto py-1">
              {PRESETS.map((preset) => {
                const isActive = preset.value === range;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetSelect(preset.value)}
                    className={cn(
                      'text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center justify-between rounded-md px-3 py-2 text-sm',
                      isActive && 'bg-muted text-foreground font-medium',
                    )}
                  >
                    <span>{preset.label}</span>
                    {isActive ? <CheckIcon className="ml-2 size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex min-w-[14rem] flex-col gap-1">
        <label
          htmlFor="from"
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          From
        </label>
        <DateInput
          id="from"
          value={fromValue}
          onChange={(nextValue) => handleDateChange('from', nextValue)}
          containerClassName="w-full"
          className="text-sm"
        />
      </div>
      <div className="flex min-w-[14rem] flex-col gap-1">
        <label
          htmlFor="to"
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          To
        </label>
        <DateInput
          id="to"
          value={toValue}
          onChange={(nextValue) => handleDateChange('to', nextValue)}
          containerClassName="w-full"
          className="text-sm"
        />
      </div>
    </div>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, days: number) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  const result = startOfDay(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(date: Date) {
  const startNext = addMonths(startOfMonth(date), 1);
  return shiftDays(startNext, -1);
}

function getQuarterStart(date: Date) {
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return startOfDay(new Date(date.getFullYear(), quarterStartMonth, 1));
}

function endOfYear(year: number) {
  return startOfDay(new Date(year, 11, 31));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

'use client';

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/components/ui/utils';
import type { MonthlyLogCardRecord, MonthlyLogStatus } from '@/components/monthly-logs/types';
import CreateMonthlyLogDialog from '@/components/monthly-logs/CreateMonthlyLogDialog';
import { Cluster, PageBody, PageHeader, PageShell, Stack } from '@/components/layout/page-shell';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const statusStyles: Record<MonthlyLogStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  complete: {
    label: 'Complete',
    className:
      'bg-[var(--color-action-50)] text-[var(--color-action-700)] border border-[var(--color-action-200)]',
  },
};

const STATUS_TAB_ORDER = ['incomplete', 'complete'] as const;
const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

type TabKey = (typeof STATUS_TAB_ORDER)[number];

type MonthlyLogsPageContentProps = {
  monthLabel: string;
  previousMonthKey: string;
  nextMonthKey: string;
  periodStartIso: string;
  records: MonthlyLogCardRecord[];
  availableProperties: { id: string; name: string }[];
  availableUnits: { id: string; propertyId: string; label: string }[];
};

type PropertyOption = {
  id: string;
  label: string;
  count: number;
};

export default function MonthlyLogsPageContent({
  monthLabel,
  previousMonthKey,
  nextMonthKey,
  periodStartIso,
  records,
  availableProperties,
  availableUnits,
}: MonthlyLogsPageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('incomplete');

  const propertyCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    records.forEach((record) => {
      const existing = counts.get(record.propertyId);
      if (existing) {
        existing.count += 1;
      } else {
        const propertyName =
          availableProperties.find((property) => property.id === record.propertyId)?.name ||
          record.propertyName ||
          'Property';
        counts.set(record.propertyId, { label: propertyName, count: 1 });
      }
    });
    return counts;
  }, [records, availableProperties]);

  const propertyOptions = useMemo<PropertyOption[]>(() => {
    const options: PropertyOption[] = [
      {
        id: 'all',
        label: `All properties (${records.length})`,
        count: records.length,
      },
    ];

    propertyCounts.forEach((value, id) => {
      options.push({ id, label: `${value.label} (${value.count})`, count: value.count });
    });

    return options.sort((a, b) => {
      if (a.id === 'all') return -1;
      if (b.id === 'all') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [propertyCounts, records.length]);

  const today = useMemo(() => new Date(), []);
  const fallbackMonth = useMemo(() => String(today.getUTCMonth() + 1).padStart(2, '0'), [today]);
  const fallbackYear = useMemo(() => String(today.getUTCFullYear()), [today]);
  const parsedPeriod = useMemo(() => {
    if (!periodStartIso) return null;
    const date = new Date(`${periodStartIso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return {
      month: String(date.getUTCMonth() + 1).padStart(2, '0'),
      year: String(date.getUTCFullYear()),
    };
  }, [periodStartIso]);
  const [selectedMonth, setSelectedMonth] = useState(parsedPeriod?.month ?? fallbackMonth);
  const [selectedYear, setSelectedYear] = useState(parsedPeriod?.year ?? fallbackYear);

  useEffect(() => {
    const nextMonth = parsedPeriod?.month ?? fallbackMonth;
    const nextYear = parsedPeriod?.year ?? fallbackYear;
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
  }, [parsedPeriod?.month, parsedPeriod?.year, fallbackMonth, fallbackYear]);

  const yearOptions = useMemo(() => {
    const baseYear = Number(fallbackYear);
    const years = new Set<string>();
    for (let year = baseYear - 5; year <= baseYear + 1; year += 1) {
      years.add(String(year));
    }
    if (parsedPeriod?.year) {
      years.add(parsedPeriod.year);
    }
    return Array.from(years).sort();
  }, [fallbackYear, parsedPeriod?.year]);

  const updatePeriodFilter = useCallback(
    (monthValue: string, yearValue: string) => {
      if (!monthValue || !yearValue) return;
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('month', `${yearValue}-${monthValue}`);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const handleMonthFilterChange = useCallback(
    (value: string) => {
      setSelectedMonth(value);
      updatePeriodFilter(value, selectedYear || fallbackYear);
    },
    [selectedYear, fallbackYear, updatePeriodFilter],
  );

  const handleYearFilterChange = useCallback(
    (value: string) => {
      setSelectedYear(value);
      updatePeriodFilter(selectedMonth || fallbackMonth, value);
    },
    [selectedMonth, fallbackMonth, updatePeriodFilter],
  );

  const handleMonthNavigate = useCallback(
    (targetKey: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('month', targetKey);
      const [yearPart, monthPart] = targetKey.split('-');
      if (yearPart && monthPart) {
        setSelectedYear(yearPart);
        setSelectedMonth(monthPart);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const filteredRecords = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      if (propertyFilter !== 'all' && record.propertyId !== propertyFilter) {
        return false;
      }

      if (!lowerSearch) return true;

      const haystack = [
        record.unitTitle,
        record.unitSubtitle,
        record.propertyName,
        record.tenantName ?? '',
        record.notes ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(lowerSearch);
    });
  }, [records, propertyFilter, searchTerm]);

  const segmentedRecords = useMemo(() => {
    const completeRecords = filteredRecords.filter((record) => record.status === 'complete');
    const incompleteRecords = filteredRecords.filter((record) => record.status !== 'complete');
    return {
      complete: completeRecords,
      incomplete: incompleteRecords,
    };
  }, [filteredRecords]);

  useEffect(() => {
    if (activeTab === 'incomplete' && segmentedRecords.incomplete.length === 0) {
      if (segmentedRecords.complete.length > 0) {
        setActiveTab('complete');
      }
    }
  }, [activeTab, segmentedRecords.complete.length, segmentedRecords.incomplete.length]);

  const countsForTabs: Record<TabKey, number> = useMemo(
    () => ({
      incomplete: segmentedRecords.incomplete.length,
      complete: segmentedRecords.complete.length,
    }),
    [segmentedRecords.complete.length, segmentedRecords.incomplete.length],
  );

  return (
    <PageShell className="h-full">
      <PageHeader
        title="Monthly Logs"
        description={monthLabel}
        actions={
          <CreateMonthlyLogDialog
            properties={availableProperties}
            units={availableUnits}
            defaultPeriodStart={periodStartIso}
          />
        }
      />

      <PageBody>
        <Card className="overflow-hidden border-border/70 border shadow-sm">
          <div className="border-border/80 flex flex-col gap-4 border-b bg-card px-4 py-4 sm:px-6">
            <Stack gap="md" className="lg:flex-row lg:items-center lg:justify-between">
              <Cluster gap="sm" className="w-full flex-1 flex-wrap">
                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger id="property-filter" className="w-48">
                    <SelectValue placeholder="All properties" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Month
                  </span>
                  <Select value={selectedMonth} onValueChange={handleMonthFilterChange}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Year
                  </span>
                  <Select value={selectedYear} onValueChange={handleYearFilterChange}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Cluster>
              <div className="relative w-full max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="monthly-log-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by unit, tenant, or notes"
                  className="w-full pl-9"
                />
              </div>
            </Stack>
          </div>

          <div className="border-border/80 flex flex-col gap-4 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleMonthNavigate(previousMonthKey)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Period starting</span>
                <span className="text-xs text-muted-foreground">{periodStartIso}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleMonthNavigate(nextMonthKey)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <CardContent className="p-0">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as TabKey)}
              className="w-full gap-0"
            >
              <div className="border-border/80 border-b bg-card px-4 py-3 sm:px-6">
                <TabsList className="flex w-full max-w-md gap-3 bg-transparent p-0">
                  <TabsTrigger
                    value="incomplete"
                    className="rounded-full bg-gray-100 px-6 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-foreground"
                  >
                    Incomplete ({countsForTabs.incomplete})
                  </TabsTrigger>
                  <TabsTrigger
                    value="complete"
                    className="rounded-full bg-gray-100 px-6 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-foreground"
                  >
                    Complete ({countsForTabs.complete})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="incomplete" className="px-4 pb-6 pt-0 sm:px-6">
                <MonthlyLogTable
                  records={segmentedRecords.incomplete}
                  emptyState={{
                    title: 'No incomplete logs',
                    description: 'All monthly logs for this period are complete.',
                  }}
                />
              </TabsContent>

              <TabsContent value="complete" className="px-4 pb-6 pt-0 sm:px-6">
                <MonthlyLogTable
                  records={segmentedRecords.complete}
                  emptyState={{
                    title: 'No completed logs',
                    description: 'Wrap up a monthly log to see it listed here.',
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </PageBody>
    </PageShell>
  );
}

type MonthlyLogTableProps = {
  records: MonthlyLogCardRecord[];
  emptyState: {
    title: string;
    description: string;
  };
};

function MonthlyLogTable({ records, emptyState }: MonthlyLogTableProps) {
  const router = useRouter();

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-card py-16 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground" aria-hidden />
        <div>
          <h3 className="text-base font-semibold text-foreground">{emptyState.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{emptyState.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-6 py-3 font-semibold">Unit</th>
            <th className="px-6 py-3 font-semibold">Tenant</th>
            <th className="px-6 py-3 font-semibold text-right">Charges</th>
            <th className="px-6 py-3 font-semibold text-right">Payments</th>
            <th className="px-6 py-3 font-semibold text-right">Bills</th>
            <th className="px-6 py-3 font-semibold text-right">Escrow</th>
            <th className="px-6 py-3 font-semibold text-right">Mgmt Fees</th>
            <th className="px-6 py-3 font-semibold text-right">Owner Draw</th>
            <th className="px-6 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {records.map((record) => {
            const status = statusStyles[record.status];
            const ownerDraw =
              record.ownerDistributionAmount ??
              record.paymentsAmount - record.billsAmount - record.escrowAmount;
            const navigateToLog = () => router.push(`/monthly-logs/${record.id}`);
            const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
              if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                navigateToLog();
              }
            };

            return (
              <tr
                key={record.id}
                role="link"
                tabIndex={0}
                onClick={navigateToLog}
                onKeyDown={handleRowKeyDown}
                className="border-b border-border/80 last:border-0 cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]"
              >
                <td className="px-6 py-5 align-top">
                  <Stack gap="xs" className="min-w-0">
                    <span className="text-sm font-semibold text-primary">
                      {record.unitTitle || 'Unit'}
                    </span>
                    <span className="text-xs text-muted-foreground">{record.propertyName}</span>
                    {record.notes ? (
                      <span className="text-xs text-muted-foreground">{record.notes}</span>
                    ) : null}
                  </Stack>
                </td>
                <td className="px-6 py-5 align-top text-sm text-muted-foreground">
                  {record.tenantName ?? '—'}
                </td>
                <td className="px-6 py-5 align-top text-right font-semibold text-foreground">
                  {currencyFormatter.format(record.chargesAmount)}
                </td>
                <td className="px-6 py-5 align-top text-right font-semibold text-foreground">
                  {currencyFormatter.format(record.paymentsAmount)}
                </td>
                <td className="px-6 py-5 align-top text-right font-semibold text-foreground">
                  {currencyFormatter.format(record.billsAmount)}
                </td>
                <td className="px-6 py-5 align-top text-right font-semibold text-foreground">
                  {currencyFormatter.format(record.escrowAmount)}
                </td>
                <td className="px-6 py-5 align-top text-right font-semibold text-foreground">
                  {currencyFormatter.format(record.managementFeesAmount)}
                </td>
                <td className="px-6 py-5 align-top text-right font-semibold text-foreground">
                  {currencyFormatter.format(ownerDraw)}
                </td>
                <td className="px-6 py-5 align-top">
                  <Badge
                    className={cn('rounded-full px-3 py-1 text-xs font-medium', status.className)}
                  >
                    {status.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

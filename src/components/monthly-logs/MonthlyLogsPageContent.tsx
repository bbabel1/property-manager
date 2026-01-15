'use client';

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, CalendarClock, ChevronLeft, ChevronRight, Search } from 'lucide-react';

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
import type { MonthlyLogCardRecord, MonthlyLogStatus } from '@/components/monthly-logs/types';
import { Body, Heading } from '@/ui/typography';
import CreateMonthlyLogDialog from '@/components/monthly-logs/CreateMonthlyLogDialog';
import { Cluster, PageBody, PageHeader, PageShell, Stack } from '@/components/layout/page-shell';
import RecurringTaskManagerDialog from '@/components/monthly-logs/RecurringTaskManagerDialog';
import { Label } from '@/ui/typography';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const statusStyles: Record<MonthlyLogStatus, { label: string; variant: 'warning' | 'info' | 'success' }> = {
  pending: {
    label: 'Pending',
    variant: 'warning',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'info',
  },
  complete: {
    label: 'Complete',
    variant: 'success',
  },
};

type TabKey = 'incomplete' | 'complete';
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
  const [recurringManagerOpen, setRecurringManagerOpen] = useState(false);

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setRecurringManagerOpen(true)}
            >
              <CalendarClock className="h-4 w-4" />
              Recurring tasks
            </Button>
            <CreateMonthlyLogDialog
              properties={availableProperties}
              units={availableUnits}
              defaultPeriodStart={periodStartIso}
            />
          </div>
        }
      />

      <PageBody>
        <Card className="border-border/70 overflow-hidden border shadow-sm">
          <div className="border-border/80 bg-card flex flex-col gap-4 border-b px-4 py-4 sm:px-6">
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
                  <Label
                    as="span"
                    size="xs"
                    tone="muted"
                    className="tracking-wide uppercase"
                  >
                    Month
                  </Label>
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
                  <Label
                    as="span"
                    size="xs"
                    tone="muted"
                    className="tracking-wide uppercase"
                  >
                    Year
                  </Label>
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
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
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

          <div className="border-border/80 bg-card flex flex-col gap-4 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-6">
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
                <Label as="span" size="sm">
                  Period starting
                </Label>
                <Body as="span" size="xs" tone="muted">
                  {periodStartIso}
                </Body>
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
          <div className="border-border/80 bg-card border-b px-4 py-3 sm:px-6">
            <TabsList className="flex w-full max-w-md gap-3 bg-transparent p-0">
              <TabsTrigger
                value="incomplete"
                className="data-[state=active]:text-foreground rounded-full bg-white px-6 py-2 transition-colors text-foreground/80 hover:bg-slate-100 data-[state=active]:bg-slate-200 data-[state=active]:shadow-sm"
              >
                Incomplete ({countsForTabs.incomplete})
              </TabsTrigger>
              <TabsTrigger
                value="complete"
                className="data-[state=active]:text-foreground rounded-full bg-white px-6 py-2 transition-colors text-foreground/80 hover:bg-slate-100 data-[state=active]:bg-slate-200 data-[state=active]:shadow-sm"
              >
                Complete ({countsForTabs.complete})
              </TabsTrigger>
            </TabsList>
          </div>

              <TabsContent value="incomplete" className="px-4 pt-0 pb-6 sm:px-6">
                <MonthlyLogTable
                  records={segmentedRecords.incomplete}
                  emptyState={{
                    title: 'No incomplete logs',
                    description: 'All monthly logs for this period are complete.',
                  }}
                />
              </TabsContent>

              <TabsContent value="complete" className="px-4 pt-0 pb-6 sm:px-6">
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

      <RecurringTaskManagerDialog
        open={recurringManagerOpen}
        onOpenChange={setRecurringManagerOpen}
        properties={availableProperties}
        units={availableUnits}
      />
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
      <div className="border-border/70 bg-card flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <Building2 className="text-muted-foreground h-12 w-12" aria-hidden />
        <div>
          <Heading as="h3" size="h6" className="text-foreground">
            {emptyState.title}
          </Heading>
          <Body as="p" size="sm" tone="muted" className="mt-1">
            {emptyState.description}
          </Body>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="px-6 py-3">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Unit
              </Label>
            </th>
            <th className="px-6 py-3">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Tenant
              </Label>
            </th>
            <th className="px-6 py-3 text-right">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Charges
              </Label>
            </th>
            <th className="px-6 py-3 text-right">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Payments
              </Label>
            </th>
            <th className="px-6 py-3 text-right">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Bills
              </Label>
            </th>
            <th className="px-6 py-3 text-right">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Escrow
              </Label>
            </th>
            <th className="px-6 py-3 text-right">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Mgmt Fees
              </Label>
            </th>
            <th className="px-6 py-3 text-right">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Owner Draw
              </Label>
            </th>
            <th className="px-6 py-3">
              <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                Status
              </Label>
            </th>
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
                className="border-border/80 hover:bg-muted/40 cursor-pointer border-b transition-colors last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]"
              >
                <td className="px-6 py-5 align-top">
                  <Stack gap="xs" className="min-w-0">
                    <Heading as="span" size="h6" className="text-primary">
                      {record.unitTitle || 'Unit'}
                    </Heading>
                    <Body as="span" size="xs" tone="muted">
                      {record.propertyName}
                    </Body>
                    {record.notes ? (
                      <Body as="span" size="xs" tone="muted">
                        {record.notes}
                      </Body>
                    ) : null}
                  </Stack>
                </td>
                <td className="px-6 py-5 align-top">
                  <Body as="span" size="sm" tone="muted">
                    {record.tenantName ?? '—'}
                  </Body>
                </td>
                <td className="px-6 py-5 text-right align-top">
                  <Heading as="span" size="h6">
                    {currencyFormatter.format(record.chargesAmount)}
                  </Heading>
                </td>
                <td className="px-6 py-5 text-right align-top">
                  <Heading as="span" size="h6">
                    {currencyFormatter.format(record.paymentsAmount)}
                  </Heading>
                </td>
                <td className="px-6 py-5 text-right align-top">
                  <Heading as="span" size="h6">
                    {currencyFormatter.format(record.billsAmount)}
                  </Heading>
                </td>
                <td className="px-6 py-5 text-right align-top">
                  <Heading as="span" size="h6">
                    {currencyFormatter.format(record.escrowAmount)}
                  </Heading>
                </td>
                <td className="px-6 py-5 text-right align-top">
                  <Heading as="span" size="h6">
                    {currencyFormatter.format(record.managementFeesAmount)}
                  </Heading>
                </td>
                <td className="px-6 py-5 text-right align-top">
                  <Heading as="span" size="h6">
                    {currencyFormatter.format(ownerDraw)}
                  </Heading>
                </td>
                <td className="px-6 py-5 align-top">
                  <Badge
                    variant={status.variant}
                    className="rounded-full px-3 py-1 text-xs font-medium"
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

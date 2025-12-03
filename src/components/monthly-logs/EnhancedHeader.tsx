'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Building2,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/ui/utils';
import type { MonthlyLogStatus } from './types';

interface RelatedLogOption {
  id: string;
  label: string;
  status: MonthlyLogStatus | string;
}

type ManagementDetail = {
  label: string;
  value: string;
};

interface EnhancedHeaderProps {
  unitDisplayName: string;
  periodDisplay: string;
  tenantName: string | null;
  managementSummary: string;
  managementDetails: ManagementDetail[];
  leaseSummary: string;
  status: MonthlyLogStatus;
  periodStartDisplay?: string;
  periodEndDisplay?: string;
  onBackToOverview: () => void;
  actions?: React.ReactNode;
  relatedLogs?: RelatedLogOption[];
  currentLogId?: string;
  relatedLogsLoading?: boolean;
  onRelatedLogSelect?: (logId: string) => void;
}

const formatStatusLabel = (value: MonthlyLogStatus | string) =>
  String(value)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const STATUS_BADGE_STYLES: Record<MonthlyLogStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  in_progress: 'bg-blue-100 text-blue-800 border border-blue-200',
  complete:
    'bg-[var(--color-action-50)] text-[var(--color-action-700)] border border-[var(--color-action-200)]',
};

export default function EnhancedHeader({
  unitDisplayName,
  periodDisplay,
  tenantName,
  managementSummary,
  managementDetails,
  leaseSummary,
  status,
  periodStartDisplay,
  periodEndDisplay,
  onBackToOverview,
  actions,
  relatedLogs,
  currentLogId,
  relatedLogsLoading,
  onRelatedLogSelect,
}: EnhancedHeaderProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const statusLabel = formatStatusLabel(status);
  const statusBadgeClass = STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.pending;
  const hasRelatedLogs =
    Array.isArray(relatedLogs) && relatedLogs.length > 0 && currentLogId != null;
  const managementItems = useMemo(
    () => managementDetails.filter((entry) => Boolean(entry?.value?.trim())),
    [managementDetails],
  );
  const hasManagementItems = managementItems.length > 0;
  const detailButtonClass =
    'mt-1 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900';

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToOverview}
                className="gap-2 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to overview
              </Button>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 shadow-sm">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">{unitDisplayName}</h1>
                <div className="mt-1 text-slate-600">
                  <p>
                    Monthly log for {periodDisplay}
                    {tenantName && (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm">
                        <User className="h-3 w-3" />
                        {tenantName}
                      </span>
                    )}
                  </p>
                  {periodStartDisplay && periodEndDisplay ? (
                    <p className="text-xs text-slate-500">
                      Period: {periodStartDisplay} – {periodEndDisplay}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className={detailButtonClass}>
                    {isDetailsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    View lease details
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    {hasManagementItems && (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 shadow-sm">
                            <DollarSign className="h-4 w-4 text-slate-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-slate-900">
                              Management services
                            </h3>
                            <ul className="mt-1 space-y-1 text-sm text-slate-600">
                              {managementItems.map((item) => (
                                <li key={`${item.label}-${item.value}`}>
                                  <span className="font-medium text-slate-700">{item.label}:</span>{' '}
                                  {item.value}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {leaseSummary && (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 shadow-sm">
                            <Calendar className="h-4 w-4 text-slate-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-slate-900">
                              Lease information
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">{leaseSummary}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {currentLogId ? (
              <div className="max-w-sm">
                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Other logs for this unit
                </div>
                <div className="mt-2">
                  {relatedLogsLoading ? (
                    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                      Loading related logs…
                    </div>
                  ) : hasRelatedLogs ? (
                    <Select
                      value={currentLogId}
                      onValueChange={(value) => onRelatedLogSelect?.(value)}
                    >
                      <SelectTrigger className="h-10 rounded-xl bg-white text-sm">
                        <SelectValue placeholder="Select monthly log" />
                      </SelectTrigger>
                      <SelectContent>
                        {relatedLogs?.map((log) => (
                          <SelectItem
                            key={log.id}
                            value={log.id}
                            disabled={log.id === currentLogId}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{log.label}</span>
                              <Badge
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                  STATUS_BADGE_STYLES[log.status as MonthlyLogStatus] ??
                                    'border border-slate-200 bg-slate-50 text-slate-700',
                                )}
                              >
                                {formatStatusLabel(log.status)}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                      No other monthly logs exist for this unit yet.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

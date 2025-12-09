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
    'bg-[var(--color-success-50)] text-[var(--color-success-700)] border border-[var(--color-success-500)]',
};

export default function EnhancedHeader({
  unitDisplayName,
  periodDisplay,
  tenantName,
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
  const hasRelatedLogs =
    Array.isArray(relatedLogs) && relatedLogs.length > 0 && currentLogId != null;
  const managementItems = useMemo(
    () => managementDetails.filter((entry) => Boolean(entry?.value?.trim())),
    [managementDetails],
  );
  const hasManagementItems = managementItems.length > 0;
  const detailButtonClass =
    'mt-1 inline-flex items-center gap-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900';

  return (
    <div className="border-b border-slate-300 bg-white">
      <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToOverview}
                className="gap-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-slate-700">
                  <span>Monthly log for {periodDisplay}</span>
                  <Badge
                    className={cn(
                      'status-pill px-2.5 py-0.5',
                      STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.pending,
                    )}
                  >
                    {formatStatusLabel(status)}
                  </Badge>
                  {tenantName && (
                    <span className="inline-flex items-center gap-1 text-sm">
                      <User className="h-3 w-3" />
                      {tenantName}
                    </span>
                  )}
                </div>
                {periodStartDisplay && periodEndDisplay ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Period: {periodStartDisplay} – {periodEndDisplay}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Compact Info Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {hasManagementItems && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-slate-400 bg-slate-200 px-2.5 py-1"
                >
                  <DollarSign className="h-3 w-3 text-slate-700" />
                  <span className="text-xs font-medium text-slate-800">
                    {managementItems.length} service{managementItems.length !== 1 ? 's' : ''}
                  </span>
                </Badge>
              )}
              {leaseSummary && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-slate-400 bg-slate-200 px-2.5 py-1"
                >
                  <Calendar className="h-3 w-3 text-slate-700" />
                  <span className="text-xs font-medium text-slate-800">Lease active</span>
                </Badge>
              )}
            </div>

            {/* Related Logs Selector - More Prominent */}
            {currentLogId ? (
              <div className="flex flex-wrap items-center gap-3">
                {relatedLogsLoading ? (
                  <div className="text-sm text-slate-600">Loading related logs…</div>
                ) : hasRelatedLogs ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">Switch to:</span>
                    <Select
                      value={currentLogId}
                      onValueChange={(value) => onRelatedLogSelect?.(value)}
                    >
                      <SelectTrigger className="h-9 w-[200px] rounded-lg bg-white text-sm">
                        <SelectValue placeholder="Select monthly log" />
                      </SelectTrigger>
                      <SelectContent>
                        {relatedLogs?.map((log) => (
                          <SelectItem
                            key={log.id}
                            value={log.id}
                            disabled={log.id === currentLogId}
                          >
                            <span className="truncate">{log.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Collapsible Details */}
            {(hasManagementItems || leaseSummary) && (
              <div className="flex flex-wrap items-center gap-3">
                <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className={detailButtonClass}>
                      {isDetailsOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      View details
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      {hasManagementItems && (
                        <Card className="border-slate-300 shadow-sm">
                          <CardContent className="flex items-start gap-3 p-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-200 shadow-sm">
                              <DollarSign className="h-4 w-4 text-slate-700" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-slate-900">
                                Management services
                              </h3>
                              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                                {managementItems.map((item) => (
                                  <li key={`${item.label}-${item.value}`}>
                                    <span className="font-medium text-slate-800">
                                      {item.label}:
                                    </span>{' '}
                                    {item.value}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {leaseSummary && (
                        <Card className="border-slate-300 shadow-sm">
                          <CardContent className="flex items-start gap-3 p-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-200 shadow-sm">
                              <Calendar className="h-4 w-4 text-slate-700" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-slate-900">
                                Lease information
                              </h3>
                              <p className="mt-1 text-sm text-slate-700">{leaseSummary}</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>

          {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

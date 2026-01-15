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
import { Body, Heading, Label } from '@/ui/typography';
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
  pending: 'status-pill-warning',
  in_progress: 'status-pill-info',
  complete: 'status-pill-success',
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
    'mt-1 inline-flex items-center gap-2 text-foreground hover:bg-slate-100';

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
                <Heading as="h1" size="h2" className="font-bold">
                  {unitDisplayName}
                </Heading>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Body as="span" size="sm">
                    Monthly log for {periodDisplay}
                  </Body>
                  <Badge
                    className={cn(
                      'status-pill px-2.5 py-0.5',
                      STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.pending,
                    )}
                  >
                    {formatStatusLabel(status)}
                  </Badge>
                  {tenantName && (
                    <Body as="span" size="sm" className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {tenantName}
                    </Body>
                  )}
                </div>
                {periodStartDisplay && periodEndDisplay ? (
                  <Body as="p" size="xs" tone="muted" className="mt-1">
                    Period: {periodStartDisplay} – {periodEndDisplay}
                  </Body>
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
                  <Label as="span" size="xs">
                    {managementItems.length} service{managementItems.length !== 1 ? 's' : ''}
                  </Label>
                </Badge>
              )}
              {leaseSummary && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-slate-400 bg-slate-200 px-2.5 py-1"
                >
                  <Calendar className="h-3 w-3 text-slate-700" />
                  <Label as="span" size="xs">
                    Lease active
                  </Label>
                </Badge>
              )}
            </div>

            {/* Related Logs Selector - More Prominent */}
            {currentLogId ? (
              <div className="flex flex-wrap items-center gap-3">
                {relatedLogsLoading ? (
                  <Body as="div" size="sm" tone="muted">
                    Loading related logs…
                  </Body>
                ) : hasRelatedLogs ? (
                  <div className="flex items-center gap-2">
                    <Label as="span">Switch to:</Label>
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
                            <Body as="span" size="sm" className="truncate">
                              {log.label}
                            </Body>
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
                              <Heading as="h3" size="h6">
                                Management services
                              </Heading>
                              <ul className="mt-1 space-y-1">
                                {managementItems.map((item) => (
                                  <Body as="li" size="sm" key={item.label}>
                                    <Label as="span">
                                      {item.label}:
                                    </Label>{' '}
                                    <Body as="span" size="sm">
                                      {item.value}
                                    </Body>
                                  </Body>
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
                            <Heading as="h3" size="h6">
                              Lease information
                            </Heading>
                            <Body as="p" size="sm" className="mt-1">
                              {leaseSummary}
                            </Body>
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

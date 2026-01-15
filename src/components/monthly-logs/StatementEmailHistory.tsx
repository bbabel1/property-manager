/**
 * Statement Email History Component
 *
 * Displays audit log of all statement emails sent for a monthly log.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  History,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import { Body, Label } from '@/ui/typography';

interface EmailHistoryRecord {
  id: string;
  sentAt: string;
  sentBy: string | null;
  recipients: Array<{
    email: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
  pdfUrl: string | null;
  status: string;
  errorMessage: string | null;
}

interface StatementEmailHistoryProps {
  monthlyLogId: string;
  refreshToken?: number | string;
}

export default function StatementEmailHistory({
  monthlyLogId,
  refreshToken,
}: StatementEmailHistoryProps) {
  const [history, setHistory] = useState<EmailHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/statement-history`);

      if (!response.ok) {
        throw new Error('Failed to fetch email history');
      }

      const text = await response.text();
      let data: { history?: EmailHistoryRecord[] } = {};
      try {
        data = text ? (JSON.parse(text) as { history?: EmailHistoryRecord[] }) : {};
      } catch {
        throw new Error('Invalid response while fetching email history');
      }
      setHistory(data.history || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load email history';
      console.warn('Error fetching email history:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [monthlyLogId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory, refreshToken]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <Label as="span">Delivery history</Label>
          <Body
            as="span"
            size="xs"
            className="status-pill border-border bg-muted text-muted-foreground px-2 py-0.5"
          >
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </Body>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Label as="span" size="xs">
            {expanded ? 'Hide' : 'Show'}
          </Label>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              expanded ? 'rotate-180' : '',
            )}
          />
        </button>
      </div>

      {error ? (
        <Body
          as="div"
          size="xs"
          className="flex items-center gap-2 rounded-md border px-3 py-2 bg-[var(--color-danger-50)] text-[var(--color-danger-700)] border-[var(--color-danger-600)]"
        >
          <AlertCircle className="h-4 w-4 text-[var(--color-danger-600)]" />
          <span>{error}</span>
        </Body>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, idx) => (
            <div key={idx} className="h-10 rounded-md bg-muted animate-pulse"></div>
          ))}
        </div>
      ) : (
        expanded && (
          <div>
            {history.length === 0 ? (
              <Body as="div" size="xs" tone="muted">
                No delivery yet.
              </Body>
            ) : (
              <div className="divide-y divide-border">
                {history.map((record) => {
                  const sentCount = record.recipients.filter((r) => r.status === 'sent').length;
                  const failedCount = record.recipients.filter((r) => r.status === 'failed').length;

                  return (
                    <div key={record.id} className="px-2 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                          {record.status === 'sent' ? (
                            <CheckCircle className="h-4 w-4 text-success-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-danger-600" />
                          )}
                          <Label as="span">
                            {formatDateTime(record.sentAt)}
                          </Label>
                        </div>
                        <Body
                          as="div"
                          size="xs"
                          tone="muted"
                          className="flex items-center gap-2 font-medium"
                        >
                          {sentCount > 0 ? (
                            <span className="status-pill status-pill-success">
                              {sentCount} sent
                            </span>
                          ) : null}
                          {failedCount > 0 ? (
                            <span className="status-pill status-pill-danger">
                              {failedCount} failed
                            </span>
                          ) : null}
                        </Body>
                      </div>
                      <Body
                        as="div"
                        size="xs"
                        tone="muted"
                        className="mt-2 flex flex-wrap items-center gap-2"
                      >
                        {record.pdfUrl ? (
                          <a
                            href={record.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-foreground shadow-sm transition hover:bg-muted"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <Label as="span" size="xs">
                              View Statement
                            </Label>
                          </a>
                        ) : (
                          <span className="rounded-md border border-border bg-muted px-2 py-1">
                            Statement file unavailable
                          </span>
                        )}
                      </Body>
                      <Body
                        as="div"
                        size="xs"
                        tone="muted"
                        className="mt-2 flex flex-wrap gap-2"
                      >
                        {record.recipients.map((recipient, idx) => (
                          <span
                            key={`${recipient.email}-${idx}`}
                            className={cn(
                              'status-pill px-2 py-1',
                              recipient.status === 'sent'
                                ? 'status-pill-success'
                                : 'status-pill-danger',
                            )}
                          >
                            {recipient.status === 'sent' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            <Label as="span" size="xs">
                              {recipient.email}
                            </Label>
                            {recipient.error ? (
                              <Body as="span" size="xs" className="text-[var(--color-danger-700)]">
                                {recipient.error}
                              </Body>
                            ) : null}
                          </span>
                        ))}
                      </Body>
                      {record.errorMessage ? (
                        <Body as="div" size="xs" className="mt-2 text-danger-700">
                          {record.errorMessage}
                        </Body>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

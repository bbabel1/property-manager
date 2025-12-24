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
          <History className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-900">Delivery history</span>
          <span className="status-pill border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-medium px-2 py-0.5">
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {expanded ? 'Hide' : 'Show'}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-slate-500 transition-transform',
              expanded ? 'rotate-180' : '',
            )}
          />
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, idx) => (
            <div key={idx} className="h-10 rounded-md bg-slate-100 animate-pulse"></div>
          ))}
        </div>
      ) : (
        expanded && (
          <div>
            {history.length === 0 ? (
              <div className="text-xs text-slate-600">No delivery yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((record) => {
                  const sentCount = record.recipients.filter((r) => r.status === 'sent').length;
                  const failedCount = record.recipients.filter((r) => r.status === 'failed').length;

                  return (
                    <div key={record.id} className="px-2 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {record.status === 'sent' ? (
                            <CheckCircle className="h-4 w-4 text-[var(--color-success-600)]" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-600" />
                          )}
                          <span className="text-sm font-medium text-slate-900">
                            {formatDateTime(record.sentAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                          {sentCount > 0 ? (
                            <span className="status-pill border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]">
                              {sentCount} sent
                            </span>
                          ) : null}
                          {failedCount > 0 ? (
                            <span className="status-pill border-rose-200 bg-rose-50 text-rose-700">
                              {failedCount} failed
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        {record.pdfUrl ? (
                          <a
                            href={record.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Statement
                          </a>
                        ) : (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                            Statement file unavailable
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                        {record.recipients.map((recipient, idx) => (
                          <span
                            key={`${recipient.email}-${idx}`}
                            className={cn(
                              'status-pill px-2 py-1',
                              recipient.status === 'sent'
                                ? 'border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
                                : 'border-rose-200 bg-rose-50 text-rose-700',
                            )}
                          >
                            {recipient.status === 'sent' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            <span className="font-medium">{recipient.email}</span>
                            {recipient.error && (
                              <span className="text-[11px] text-rose-700">{recipient.error}</span>
                            )}
                          </span>
                        ))}
                      </div>
                      {record.errorMessage ? (
                        <div className="mt-2 text-xs text-rose-700">{record.errorMessage}</div>
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

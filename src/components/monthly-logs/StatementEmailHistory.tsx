/**
 * Statement Email History Component
 *
 * Displays audit log of all statement emails sent for a monthly log.
 */

'use client';

import { useState, useEffect } from 'react';
import { History, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  status: string;
  errorMessage: string | null;
}

interface StatementEmailHistoryProps {
  monthlyLogId: string;
}

export default function StatementEmailHistory({ monthlyLogId }: StatementEmailHistoryProps) {
  const [history, setHistory] = useState<EmailHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyLogId]);

  const fetchHistory = async () => {
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
  };

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 rounded bg-slate-200"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Email History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Mail className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-slate-900">No emails sent yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Email history will appear here after you send the statement.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Email History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((record) => {
            const sentCount = record.recipients.filter((r) => r.status === 'sent').length;
            const failedCount = record.recipients.filter((r) => r.status === 'failed').length;

            return (
              <div
                key={record.id}
                className={cn(
                  'rounded-lg border p-3',
                  record.status === 'sent'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {record.status === 'sent' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium text-slate-900">
                        {formatDateTime(record.sentAt)}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {record.recipients.map((recipient, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                          {recipient.status === 'sent' ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                          <span>{recipient.email}</span>
                          {recipient.error && (
                            <span className="text-red-600">({recipient.error})</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {record.errorMessage && (
                      <div className="mt-2 text-xs text-red-600">{record.errorMessage}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">
                      {sentCount > 0 && <div className="text-green-600">{sentCount} sent</div>}
                      {failedCount > 0 && <div className="text-red-600">{failedCount} failed</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

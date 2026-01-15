'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, Eye, FileText, Loader2, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Body, Heading, Label } from '@/ui/typography';
import StatementRecipientsManager from './StatementRecipientsManager';
import StatementEmailHistory from './StatementEmailHistory';
import StatementPreviewDialog from './StatementPreviewDialog';
import { safeParseJson } from '@/types/monthly-log';

interface StatementsStageProps {
  monthlyLogId: string;
  propertyId?: string | null;
}

export default function StatementsStage({ monthlyLogId, propertyId }: StatementsStageProps) {
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string; loading: boolean }>({ connected: false, loading: true });
  const hasProperty = Boolean(propertyId);
  const readyToSend = Boolean(pdfUrl && hasProperty && recipientCount && recipientCount > 0 && gmailStatus.connected);

  // Fetch existing PDF URL on mount
  useEffect(() => {
    const fetchPdfUrl = async () => {
      try {
        const response = await fetch(`/api/monthly-logs/${monthlyLogId}`);
        if (response.ok) {
          const text = await response.text();
          let data: { pdf_url?: string | null } = {};
          try {
            data = text ? (JSON.parse(text) as { pdf_url?: string | null }) : {};
          } catch {
            data = {};
          }
          if (data.pdf_url) {
            setPdfUrl(`${data.pdf_url}?t=${Date.now()}`);
          }
        }
      } catch (error) {
        console.error('Error fetching PDF URL:', error);
      }
    };

    fetchPdfUrl();
  }, [monthlyLogId]);

  // Fetch Gmail connection status
  useEffect(() => {
    const fetchGmailStatus = async () => {
      try {
        const response = await fetch('/api/gmail/status');
        if (response.ok) {
          const data = await response.json();
          setGmailStatus({
            connected: data.connected || false,
            email: data.email || undefined,
            loading: false,
          });
        } else {
          setGmailStatus({ connected: false, loading: false });
        }
      } catch (error) {
        console.error('Error fetching Gmail status:', error);
        setGmailStatus({ connected: false, loading: false });
      }
    };

    fetchGmailStatus();
  }, []);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setPreviewLoading(true);

      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/generate-pdf`, {
        method: 'POST',
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          toast.error('Insufficient permissions to generate the statement PDF.');
          if (pdfUrl) {
            setPreviewOpen(true);
          }
          return;
        }
        const errorText = await response.text();
        const errorData = safeParseJson<{ error?: { message?: string } }>(errorText) ?? {};
        throw new Error(errorData.error?.message || 'Failed to generate PDF');
      }

      const text = await response.text();
      const data = safeParseJson<{ pdfUrl?: string | null }>(text) ?? {};
      const refreshedUrl = data.pdfUrl ? `${data.pdfUrl}?t=${Date.now()}` : null;
      if (refreshedUrl) {
        setPdfUrl(refreshedUrl);
      }
      setPreviewOpen(true);
      toast.success('Statement PDF generated. Opening preview...');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
      console.error('Error generating PDF for preview:', error);
      toast.error(errorMessage);

      // If generation failed but we have a cached PDF, still allow viewing it
      if (pdfUrl) {
        setPreviewOpen(true);
      }
    } finally {
      setGenerating(false);
      setPreviewLoading(false);
    }
  };

  const handleView = () => {
    if (!pdfUrl) {
      toast.error('Generate the statement PDF before viewing.');
      return;
    }
    setPreviewOpen(true);
  };

  const handleSendStatement = async () => {
    try {
      setSending(true);

      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/send-statement`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = safeParseJson<{ error?: { message?: string } }>(errorText) ?? {};
        throw new Error(errorData.error?.message || 'Failed to send statement');
      }

      const text = await response.text();
      const data = safeParseJson<{ failedCount?: number; sentCount?: number }>(text) ?? {};
      const failedCount = data.failedCount ?? 0;
      const sentCount = data.sentCount ?? 0;

      if (failedCount > 0) {
        toast.warning(`Sent to ${sentCount} recipient(s), ${failedCount} failed`, {
          description: 'Some emails could not be delivered. Check the email history for details.',
        });
      } else {
        toast.success(`Statement sent to ${sentCount} recipient(s)`);
      }

      setHistoryRefreshToken(Date.now());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send statement';
      console.error('Error sending statement:', error);
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const renderStatusPill = (icon: ReactNode, label: string, className: string) => (
    <span
      className={`status-pill ${className}`}
    >
      {icon}
      {label}
    </span>
  );

  const statusPill = (() => {
    if (!hasProperty) {
      return renderStatusPill(
        <AlertCircle className="h-3.5 w-3.5 text-warning-600" />,
        'Link a property to add recipients',
        'status-pill-info',
      );
    }
    if (generating || previewLoading) {
      return renderStatusPill(
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />,
        'Generating PDF…',
        'status-pill-info',
      );
    }
    if (!pdfUrl) {
      return renderStatusPill(
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />,
        'Generate PDF to send',
        'status-pill-info',
      );
    }
    if (recipientsLoading) {
      return renderStatusPill(
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />,
        'Loading recipients…',
        'status-pill-info',
      );
    }
    if (!gmailStatus.loading && !gmailStatus.connected) {
      return renderStatusPill(
        <AlertCircle className="h-3.5 w-3.5 text-warning-600" />,
        'Gmail not connected',
        'status-pill-warning',
      );
    }
    if (recipientCount && recipientCount > 0 && gmailStatus.connected) {
      return renderStatusPill(
        <CheckCircle className="h-3.5 w-3.5 text-success-600" />,
        'Ready to send',
        'status-pill-success',
      );
    }
    return null;
  })();

  const sendDisabled =
    sending || !readyToSend || recipientsLoading || !gmailStatus.connected;

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <Heading as="p" size="h6">
              Statement Delivery
            </Heading>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!gmailStatus.loading && !gmailStatus.connected && (
            <div className="rounded-lg border p-3 bg-[var(--color-warning-50)] text-[var(--color-warning-700)] border-[var(--color-warning-600)]">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--color-warning-600)]" />
                <div className="flex-1">
                  <Heading as="p" size="h6" className="text-[var(--color-warning-700)]">
                    Gmail Integration Required
                  </Heading>
                  <Body as="p" size="xs" tone="muted" className="mt-1">
                    Connect your Gmail account to send Monthly Log Statements.{' '}
                    <Link
                      href="/settings/integrations"
                      className="font-medium underline hover:text-amber-900"
                    >
                      Connect Gmail
                    </Link>
                  </Body>
                </div>
              </div>
            </div>
          )}
          {gmailStatus.connected && gmailStatus.email && (
            <Body as="div" size="xs" tone="muted" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Sending from: {gmailStatus.email}</span>
            </Body>
          )}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
            <Body as="div" size="xs" tone="muted" className="flex items-center gap-2">
              {statusPill}
            </Body>
            <div className="flex items-center gap-2">
              {!pdfUrl ? (
                <Button
                  onClick={handleGenerate}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={previewLoading || generating}
                >
                  <FileText className="h-4 w-4" />
                  {generating ? 'Generating…' : 'Generate PDF'}
                </Button>
              ) : (
                <Button
                  onClick={handleView}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={previewLoading}
                >
                  <Eye className="h-4 w-4" />
                  View PDF
                </Button>
              )}
              <Button
                onClick={handleSendStatement}
                disabled={sendDisabled}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                {sending ? 'Sending...' : 'Send email'}
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Heading as="h3" size="h6">
                Recipients
              </Heading>
              <Body as="span" size="xs" tone="muted">
                {recipientsLoading ? 'Loading...' : `${recipientCount ?? 0} total`}
              </Body>
            </div>
            {hasProperty ? (
              <StatementRecipientsManager
                propertyId={propertyId!}
                onRecipientsChange={(list) => setRecipientCount(list.length)}
                onLoadingChange={setRecipientsLoading}
              />
            ) : (
              <Body as="div" size="sm" tone="muted">
                Link a property to manage recipients.
              </Body>
            )}
          </section>

          <section className="space-y-3">
            <StatementEmailHistory
              monthlyLogId={monthlyLogId}
              refreshToken={historyRefreshToken}
            />
          </section>
        </CardContent>
      </Card>

      <StatementPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        monthlyLogId={monthlyLogId}
        pdfUrl={pdfUrl}
        onPdfGenerated={setPdfUrl}
      />
    </div>
  );
}

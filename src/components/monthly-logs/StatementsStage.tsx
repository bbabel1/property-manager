'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, Eye, FileText, Loader2, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import StatementRecipientsManager from './StatementRecipientsManager';
import StatementEmailHistory from './StatementEmailHistory';
import StatementPreviewDialog from './StatementPreviewDialog';

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
  const hasProperty = Boolean(propertyId);
  const readyToSend = Boolean(pdfUrl && hasProperty && recipientCount && recipientCount > 0);

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
            setPdfUrl(data.pdf_url);
          }
        }
      } catch (error) {
        console.error('Error fetching PDF URL:', error);
      }
    };

    fetchPdfUrl();
  }, [monthlyLogId]);

  const handlePreview = () => {
    if (pdfUrl) {
      setPreviewOpen(true);
      return;
    }

    // If no PDF yet, generate then open
    const generateAndPreview = async () => {
      try {
        setGenerating(true);
        setPreviewLoading(true);

        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/generate-pdf`, {
          method: 'POST',
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            toast.error('Insufficient permissions to generate the statement PDF.');
            return;
          }
          const errorText = await response.text();
          let errorData: any = {};
          try {
            errorData = errorText ? JSON.parse(errorText) : {};
          } catch {
            errorData = {};
          }
          throw new Error(errorData.error?.message || 'Failed to generate PDF');
        }

        const text = await response.text();
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
        setPdfUrl(data.pdfUrl);
        setPreviewOpen(true);
        toast.success('Statement PDF generated. Opening preview...');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
        console.error('Error generating PDF for preview:', error);
        toast.error(errorMessage);
      } finally {
        setGenerating(false);
        setPreviewLoading(false);
      }
    };

    void generateAndPreview();
  };

  const handleSendStatement = async () => {
    try {
      setSending(true);

      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/send-statement`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        try {
          errorData = errorText ? JSON.parse(errorText) : {};
        } catch {
          errorData = {};
        }
        throw new Error(errorData.error?.message || 'Failed to send statement');
      }

      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (data.failedCount > 0) {
        toast.warning(`Sent to ${data.sentCount} recipient(s), ${data.failedCount} failed`, {
          description: 'Some emails could not be delivered. Check the email history for details.',
        });
      } else {
        toast.success(`Statement sent to ${data.sentCount} recipient(s)`);
      }
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
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );

  const statusPill = (() => {
    if (!hasProperty) {
      return renderStatusPill(
        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />,
        'Link a property to add recipients',
        'border-slate-200 bg-white text-slate-700',
      );
    }
    if (generating || previewLoading) {
      return renderStatusPill(
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />,
        'Generating PDF…',
        'border-slate-200 bg-white text-slate-700',
      );
    }
    if (!pdfUrl) {
      return renderStatusPill(
        <FileText className="h-3.5 w-3.5 text-slate-500" />,
        'Generate PDF to send',
        'border-slate-200 bg-white text-slate-700',
      );
    }
    if (recipientsLoading) {
      return renderStatusPill(
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />,
        'Loading recipients…',
        'border-slate-200 bg-white text-slate-700',
      );
    }
    if (recipientCount && recipientCount > 0) {
      return renderStatusPill(
        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />,
        'Ready to send',
        'border-emerald-100 bg-emerald-50 text-emerald-700',
      );
    }
    return null;
  })();

  const sendDisabled =
    sending || !readyToSend || recipientsLoading;

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-indigo-600" />
            Statement Delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-slate-700">{statusPill}</div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePreview}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={previewLoading || generating}
              >
                <Eye className="h-4 w-4" />
                {previewLoading ? 'Loading…' : 'View PDF'}
              </Button>
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
              <h3 className="text-sm font-semibold text-slate-900">Recipients</h3>
              <span className="text-xs text-slate-500">
                {recipientsLoading ? 'Loading...' : `${recipientCount ?? 0} total`}
              </span>
            </div>
            {hasProperty ? (
              <StatementRecipientsManager
                propertyId={propertyId!}
                onRecipientsChange={(list) => setRecipientCount(list.length)}
                onLoadingChange={setRecipientsLoading}
              />
            ) : (
              <div className="text-sm text-slate-600">Link a property to manage recipients.</div>
            )}
          </section>

          <section className="space-y-3">
            <StatementEmailHistory monthlyLogId={monthlyLogId} />
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

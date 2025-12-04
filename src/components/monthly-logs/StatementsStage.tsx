'use client';

import { useState, useEffect } from 'react';
import { Eye, Mail, AlertCircle, CheckCircle, FileText } from 'lucide-react';
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
  const hasProperty = Boolean(propertyId);

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

  return (
    <div className="space-y-6">
      {/* Statement Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Monthly Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Generate a professional PDF statement for this monthly log period. The statement
              includes all charges, payments, bills, escrow movements, and financial summaries.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handlePreview}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={previewLoading || generating}
              >
                <Eye className="h-4 w-4" />
                {previewLoading ? 'Loading…' : 'View'}
              </Button>
              {pdfUrl && (
                <Button
                  onClick={handleSendStatement}
                  disabled={sending}
                  variant="default"
                  size="sm"
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Mail className="h-4 w-4" />
                  {sending ? 'Sending...' : 'Send via Email'}
                </Button>
              )}
            </div>

            {/* PDF Status */}
            {pdfUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <div className="flex-1">
                  <p className="font-medium">PDF Generated Successfully</p>
                  <p className="text-sm">Statement is ready for download and distribution</p>
                </div>
              </div>
            )}

            {generating && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-blue-700">
                <AlertCircle className="h-5 w-5 animate-pulse" />
                <div className="flex-1">
                  <p className="font-medium">Generating Statement...</p>
                  <p className="text-sm">This may take a few moments</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <StatementPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        monthlyLogId={monthlyLogId}
        pdfUrl={pdfUrl}
        onPdfGenerated={setPdfUrl}
      />

      {/* Statement Recipients Management */}
      {hasProperty ? (
        <StatementRecipientsManager propertyId={propertyId!} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Connect this monthly log to a property to manage statement email recipients.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email History */}
      <StatementEmailHistory monthlyLogId={monthlyLogId} />
    </div>
  );
}

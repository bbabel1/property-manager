'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { safeParseJson } from '@/types/monthly-log';

type StatementPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthlyLogId: string;
  pdfUrl: string | null;
  onPdfGenerated?: (url: string) => void;
};

const normalizePdfUrl = (url: string | null): string | undefined => {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  return trimmed.length ? trimmed : undefined;
};

export default function StatementPreviewDialog({
  open,
  onOpenChange,
  monthlyLogId,
  pdfUrl,
  onPdfGenerated,
}: StatementPreviewDialogProps) {
  const [ready, setReady] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const normalizedPdfUrl = normalizePdfUrl(pdfUrl);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    if (normalizedPdfUrl) {
      setReady(true);
    }
  }, [open, normalizedPdfUrl]);

  const canShow = Boolean(normalizedPdfUrl);

  const regenerate = async () => {
    if (!monthlyLogId) return;
    try {
      setRegenerating(true);
      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/generate-pdf`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorText = await response.text();
        const errorData = safeParseJson<{ error?: { message?: string } }>(errorText) ?? {};
        throw new Error(errorData.error?.message || 'Failed to generate statement');
      }
      const text = await response.text();
      const data = safeParseJson<{ pdfUrl?: string | null }>(text) ?? {};
      const parsedPdfUrl = normalizePdfUrl(data.pdfUrl ?? null);
      if (parsedPdfUrl) {
        // Bust cache by appending a timestamp so the iframe refreshes immediately
        const bust = `${parsedPdfUrl}?t=${Date.now()}`;
        onPdfGenerated?.(bust);
        setReady(true);
      }
      toast.success('Statement generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate statement');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-full max-w-[800px] p-0">
        <DialogHeader className="px-6 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogTitle>Monthly Statement</DialogTitle>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span>Template:</span>
              <span className="text-foreground font-medium">Modern</span>
            </div>
          </div>
        </DialogHeader>

        {!canShow ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 px-6 pb-10 text-sm">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Generate the statement PDF before previewing.
          </div>
        ) : null}

        {canShow && !ready ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 px-6 pb-10 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading statement preview…
          </div>
        ) : null}

        {canShow && ready ? (
          <div className="flex h-full flex-col gap-4 px-6 pb-6">
            <div className="flex-1 rounded-md border shadow-sm">
              <iframe
                key={normalizedPdfUrl ?? 'statement-preview'}
                src={normalizedPdfUrl}
                title="Monthly Statement"
                className="h-full min-h-[70vh] w-full rounded-md"
                loading="lazy"
                allowFullScreen
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              {regenerating ? (
                <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Regenerating…
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">Template: Modern</span>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void regenerate()}
                  disabled={regenerating}
                  className="gap-2"
                >
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {regenerating ? 'Refreshing…' : 'Refresh PDF'}
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={normalizedPdfUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in new tab
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

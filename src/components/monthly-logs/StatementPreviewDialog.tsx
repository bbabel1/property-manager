'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type StatementPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthlyLogId: string;
  pdfUrl: string | null;
  onPdfGenerated?: (url: string) => void;
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

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    if (pdfUrl) {
      setReady(true);
    }
  }, [open, pdfUrl]);

  const canShow = Boolean(pdfUrl);

  const regenerate = async () => {
    if (!monthlyLogId) return;
    try {
      setRegenerating(true);
      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/generate-pdf`, {
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
        throw new Error(errorData.error?.message || 'Failed to generate statement');
      }
      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (data.pdfUrl) {
        // Bust cache by appending a timestamp so the iframe refreshes immediately
        const bust = `${data.pdfUrl}?t=${Date.now()}`;
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
      <DialogContent className="max-w-none sm:max-w-none w-[min(calc(100vw-3rem),1200px)] max-h-[96vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogTitle>Monthly Statement</DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                key={pdfUrl}
                src={pdfUrl ?? undefined}
                title="Monthly Statement"
                className="h-full min-h-[70vh] w-full rounded-md"
                loading="lazy"
                allowFullScreen
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              {regenerating ? (
                <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Regenerating…
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Template: Modern</span>
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
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
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

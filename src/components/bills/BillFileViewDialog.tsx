'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, RotateCcw } from 'lucide-react';
import type { BillFileRecord } from './types';

type BillFileViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: BillFileRecord | null;
  billId: string;
};

export default function BillFileViewDialog({
  open,
  onOpenChange,
  file,
  billId,
}: BillFileViewDialogProps) {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPresignedUrl = useCallback(async () => {
    if (!file) return;
    setStatus('loading');
    setErrorMessage(null);
    setPresignedUrl(null);
    try {
      const res = await fetch(`/api/bills/${billId}/files/${file.id}/presign`, {
        method: 'GET',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.getUrl) {
        throw new Error(json?.error || 'Unable to load file');
      }
      setPresignedUrl(json.getUrl as string);
      setStatus('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load file';
      setErrorMessage(message);
      setStatus('error');
    }
  }, [billId, file]);

  useEffect(() => {
    if (!open) {
      setPresignedUrl(null);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }
    fetchPresignedUrl();
  }, [open, fetchPresignedUrl]);

  const title = file?.title || 'File';
  const uploadedLabel = (() => {
    if (!file) return null;
    const date = new Date(file.uploadedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none sm:max-w-none w-[min(calc(100vw-3rem),1200px)] max-h-[96vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          {file ? (
            <DialogDescription>
              {uploadedLabel ? `Uploaded ${uploadedLabel}` : 'Uploaded'} by{' '}
              {file.uploadedBy || 'Team member'}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {status === 'loading' ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading file…
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="text-center text-sm">
            <div className="text-destructive mb-3">
              {errorMessage || 'We could not load this file.'}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchPresignedUrl}
              className="inline-flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        ) : null}

        {status === 'success' && presignedUrl ? (
          <div className="flex h-full flex-col gap-4 px-6 pb-6">
            <div className="flex-1 rounded-md border shadow-sm">
              <iframe
                key={presignedUrl}
                src={presignedUrl}
                title={title}
                className="h-full min-h-[70vh] w-full rounded-md"
                loading="lazy"
                allowFullScreen
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={presignedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in new tab
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

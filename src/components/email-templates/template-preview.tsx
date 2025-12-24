'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { TemplateRenderResult } from '@/types/email-templates';

interface TemplatePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: TemplateRenderResult | null;
  loading?: boolean;
}

export function TemplatePreview({ open, onOpenChange, preview, loading }: TemplatePreviewProps) {
  const [activeTab, setActiveTab] = useState<'html' | 'text'>('html');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template Preview</DialogTitle>
          <DialogDescription>Preview how the rendered template will appear</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground p-8 text-center">Loading preview...</div>
        ) : preview ? (
          <div className="space-y-4">
            {preview.warnings && preview.warnings.length > 0 && (
              <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                <AlertDescription>
                  <div className="mb-2 font-semibold text-yellow-900 dark:text-yellow-100">
                    Warnings:
                  </div>
                  <ul className="list-inside list-disc space-y-1 text-yellow-800 dark:text-yellow-200">
                    {preview.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">Subject:</label>
              <div className="bg-muted rounded-md border p-3">{preview.subject}</div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'html' | 'text')}>
              <TabsList>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="text">Plain Text</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="mt-4">
                <div className="rounded-md border bg-white p-4">
                  <div
                    dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
              </TabsContent>
              <TabsContent value="text" className="mt-4">
                <div className="bg-muted rounded-md border p-4 font-mono text-sm whitespace-pre-wrap">
                  {preview.bodyText || 'No plain text version available'}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-muted-foreground p-8 text-center">No preview available</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

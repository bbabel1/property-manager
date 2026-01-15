"use client";

import { useState } from 'react';
import AddLink from '@/components/ui/AddLink';
import TenantFileUploadDialog from '@/components/tenants/TenantFileUploadDialog';
import type { TenantFileRow, TenantFileUploadDialogProps } from './tenant-file-types';
import { Body, Heading } from '@/ui/typography';

export default function TenantRecentFilesSummary({
  tenantId,
  uploaderName,
}: {
  tenantId: string | null;
  uploaderName?: string | null;
}) {
  const [open, setOpen] = useState(false);

  const handleSaved = (_row?: TenantFileRow) => {
    setOpen(false);
  };

  return (
    <div className="rounded-lg border border-border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Heading as="h2" size="h3">
          Recent files
        </Heading>
        <AddLink onClick={() => setOpen(true)} aria-label="Add file" />
      </div>
      <Body tone="muted" size="sm" className="px-4 py-6">
        You don't have any files for this tenant right now.{' '}
        <button className="text-primary hover:underline px-1 py-0 h-auto" onClick={() => setOpen(true)}>
          Upload your first file.
        </button>
      </Body>

      <TenantFileUploadDialog
        {...({
          open,
          onOpenChange: setOpen,
          tenantId,
          uploaderName: uploaderName || undefined,
          onSaved: handleSaved,
        } satisfies TenantFileUploadDialogProps)}
      />
    </div>
  );
}

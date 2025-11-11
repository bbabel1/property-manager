'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import AddLink from '@/components/ui/AddLink';
import PropertyFileUploadDialog, {
  PropertyFileRow,
} from '@/components/property/PropertyFileUploadDialog';

interface PropertyRecentFilesSectionProps {
  propertyId: string;
  buildiumPropertyId: number | null;
}

export default function PropertyRecentFilesSection({
  propertyId,
  buildiumPropertyId,
}: PropertyRecentFilesSectionProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PropertyFileRow[]>([]);

  const handleSaved = (row: PropertyFileRow) => {
    setFiles((prev) => [row, ...prev].slice(0, 5));
  };

  return (
    <div className="space-y-4">
      <div className="section-title-row">
        <h2 className="section-title-text">Recent files</h2>
        {buildiumPropertyId ? (
          <AddLink onClick={() => setOpen(true)} aria-label="Add property file" className="px-2" />
        ) : null}
      </div>
      <div className="surface-card">
        {!buildiumPropertyId ? (
          <div className="text-muted-foreground px-4 py-6 text-sm">
            File uploads will be available once this property is linked to Buildium.
          </div>
        ) : files.length === 0 ? (
          <div className="text-muted-foreground px-4 py-6 text-sm">
            You don't have any files for this property right now.{' '}
            <Button
              variant="link"
              className="px-1"
              onClick={() => buildiumPropertyId && setOpen(true)}
              disabled={!buildiumPropertyId}
            >
              Upload your first file.
            </Button>
          </div>
        ) : (
          <div className="divide-card divide-y">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <div className="text-foreground text-sm font-semibold">{file.title}</div>
                  <div className="text-muted-foreground text-sm">
                    {file.category} · Uploaded {file.uploadedAt.toLocaleDateString()} by{' '}
                    {file.uploadedBy}
                  </div>
                  {file.description ? (
                    <div className="text-muted-foreground text-sm">{file.description}</div>
                  ) : null}
                </div>
                <Button variant="outline" className="min-h-[2.75rem] px-4">
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {buildiumPropertyId ? (
        <PropertyFileUploadDialog
          open={open}
          onOpenChange={setOpen}
          uploaderName={null}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}

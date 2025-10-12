"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import AddLink from '@/components/ui/AddLink'
import PropertyFileUploadDialog, { PropertyFileRow } from '@/components/property/PropertyFileUploadDialog'

interface PropertyRecentFilesSectionProps {
  propertyId: string
  buildiumPropertyId: number | null
}

export default function PropertyRecentFilesSection({ propertyId, buildiumPropertyId }: PropertyRecentFilesSectionProps) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<PropertyFileRow[]>([])

  const handleSaved = (row: PropertyFileRow) => {
    setFiles((prev) => [row, ...prev].slice(0, 5))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Recent files</h2>
        {buildiumPropertyId ? (
          <AddLink onClick={() => setOpen(true)} aria-label="Add property file" />
        ) : null}
      </div>
      <div className="rounded-lg border border-border bg-background shadow-sm">
        {!buildiumPropertyId ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            File uploads will be available once this property is linked to Buildium.
          </div>
        ) : files.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            You don't have any files for this property right now.{' '}
            <button
              className="text-sm text-primary hover:underline px-1 py-0 disabled:text-muted-foreground"
              onClick={() => buildiumPropertyId && setOpen(true)}
              disabled={!buildiumPropertyId}
            >
              Upload your first file.
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{file.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {file.category} · Uploaded {file.uploadedAt.toLocaleDateString()} by {file.uploadedBy}
                  </div>
                  {file.description ? (
                    <div className="text-xs text-muted-foreground">{file.description}</div>
                  ) : null}
                </div>
                <Button variant="outline" size="sm">Download</Button>
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
  )
}

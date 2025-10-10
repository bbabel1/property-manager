"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import AddLink from '@/components/ui/AddLink'
import TenantFileUploadDialog, { TenantFileRow } from '@/components/tenants/TenantFileUploadDialog'

export default function TenantRecentFilesSummary({ uploaderName }: { uploaderName?: string | null }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)

  const handleSaved = (_row: TenantFileRow) => {
    setCount((c) => c + 1)
  }

  return (
    <div className="rounded-lg border border-border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">Recent files</h2>
        <AddLink onClick={() => setOpen(true)} aria-label="Add file" />
      </div>
      <div className="px-4 py-6 text-sm text-muted-foreground">
        You don't have any files for this tenant right now.{' '}
        <button className="text-primary hover:underline px-1 py-0 h-auto" onClick={() => setOpen(true)}>
          Upload your first file.
        </button>
      </div>

      <TenantFileUploadDialog
        open={open}
        onOpenChange={setOpen}
        uploaderName={uploaderName || undefined}
        onSaved={handleSaved}
      />
    </div>
  )
}


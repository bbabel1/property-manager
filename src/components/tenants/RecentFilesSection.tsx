"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import TenantFileUploadDialog from '@/components/tenants/TenantFileUploadDialog'

interface RecentFilesSectionProps {
  tenantId: string
}

const DEFAULT_CATEGORY = 'Uncategorized'

export default function RecentFilesSection({ tenantId }: RecentFilesSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const openModal = () => setIsOpen(true)

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Recent files</h2>
          <Button 
            variant="link" 
            className="px-2 py-0 h-auto"
            onClick={openModal}
          >
            Add
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background shadow-sm">
          <div className="px-4 py-6 text-sm text-muted-foreground">
            You don't have any files for this tenant right now.{' '}
            <Button 
              variant="link" 
              className="px-1 py-0 h-auto"
              onClick={openModal}
            >
              Upload your first file.
            </Button>
          </div>
        </div>
      </div>

      <TenantFileUploadDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}

"use client"

import { useState } from 'react'
import EditTenantContactModal from '@/components/tenants/EditTenantContactModal'
import EditLink from '@/components/ui/EditLink'

export default function EditContactButton({ contactId, initial }: { contactId: number; initial: any }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <EditLink onClick={() => setOpen(true)} />
      <EditTenantContactModal
        open={open}
        onOpenChange={setOpen}
        contactId={contactId}
        initial={initial}
        onSaved={() => window.location.reload()}
      />
    </>
  )
}

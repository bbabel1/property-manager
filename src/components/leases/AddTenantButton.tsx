"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import AddTenantModal from '@/components/leases/AddTenantModal'

export default function AddTenantButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add tenant
      </Button>
      <AddTenantModal open={open} onOpenChange={setOpen} />
    </>
  )
}


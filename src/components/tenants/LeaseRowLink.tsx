"use client"

import { useRouter } from 'next/navigation'
import { TableRow } from '@/components/ui/table'
import React from 'react'

export default function LeaseRowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <TableRow
      className="hover:bg-muted cursor-pointer"
      onClick={() => router.push(href)}
      role="link"
      aria-label={`Open ${href}`}
    >
      {children}
    </TableRow>
  )
}


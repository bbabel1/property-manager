"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, type ButtonProps } from '@/components/ui/button'
import { toast } from 'sonner'
import DestructiveActionModal from '@/components/common/DestructiveActionModal'

type RemoveLeaseContactButtonProps = {
  contactId: string
  children: React.ReactNode
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  confirmationMessage?: string
}

export default function RemoveLeaseContactButton({
  contactId,
  children,
  variant = 'ghost',
  size = 'sm',
  className,
  confirmationMessage = 'Remove this person from the lease?',
}: RemoveLeaseContactButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleRemove = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/lease-contacts/${contactId}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Failed to remove tenant from lease')
        }
        toast.success('Person removed from lease')
        router.refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove tenant from lease'
        toast.error(message)
      } finally {
        setConfirmOpen(false)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        aria-disabled={pending}
      >
        {children}
      </Button>
      <DestructiveActionModal
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open)
        }}
        title="Remove person from lease?"
        description={confirmationMessage}
        confirmLabel={pending ? 'Removing…' : 'Remove'}
        isProcessing={pending}
        onConfirm={handleRemove}
      />
    </>
  )
}

"use client"

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, type ButtonProps } from '@/components/ui/button'

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

  const handleRemove = () => {
    if (!window.confirm(confirmationMessage)) return
    startTransition(async () => {
      try {
        const res = await fetch(`/api/lease-contacts/${contactId}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Failed to remove tenant from lease')
        }
        router.refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove tenant from lease'
        alert(message)
      }
    })
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleRemove}
      disabled={pending}
      aria-disabled={pending}
    >
      {children}
    </Button>
  )
}

'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PayBillForm from './PayBillForm'

type BankAccountOption = Parameters<typeof PayBillForm>[0]['bankAccounts'][number]
type PayBillFormBill = Parameters<typeof PayBillForm>[0]['bill']

type PayBillModalProps = {
  bill: PayBillFormBill
  bankAccounts: BankAccountOption[]
  defaultBankAccountId: string | null
}

export default function PayBillModal({ bill, bankAccounts, defaultBankAccountId }: PayBillModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  const handleClose = useCallback(() => {
    setOpen(false)
    router.push(`/bills/${bill.id}`)
    router.refresh()
  }, [bill.id, router])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose() }}>
      <DialogContent className="bg-card sm:rounded-2xl rounded-none border border-border/80 shadow-2xl w-[92vw] sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="space-y-1 border-b border-border px-6 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold text-foreground">Pay bill</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6">
          <PayBillForm bill={bill} bankAccounts={bankAccounts} defaultBankAccountId={defaultBankAccountId} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

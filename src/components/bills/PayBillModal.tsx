'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PayBillForm from './PayBillForm';

type BankAccountOption = Parameters<typeof PayBillForm>[0]['bankAccounts'][number];
type PayBillFormBill = Parameters<typeof PayBillForm>[0]['bill'];

type PayBillModalProps = {
  bill: PayBillFormBill;
  bankAccounts: BankAccountOption[];
  defaultBankAccountId: string | null;
};

export default function PayBillModal({
  bill,
  bankAccounts,
  defaultBankAccountId,
}: PayBillModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const handleClose = useCallback(() => {
    setOpen(false);
    router.push(`/bills/${bill.id}`);
    router.refresh();
  }, [bill.id, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="border-border space-y-1 border-b px-6 pt-5 pb-4 text-left">
          <DialogTitle headingSize="h4">Pay bill</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6">
          <PayBillForm
            bill={bill}
            bankAccounts={bankAccounts}
            defaultBankAccountId={defaultBankAccountId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

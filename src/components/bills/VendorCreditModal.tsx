'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VendorCreditForm } from '@/components/bills/VendorCreditForm';

type Option = { id: string; label: string; meta?: string | null };

type Props = {
  vendorId: string;
  vendorOptions: Option[];
  creditAccounts: Option[];
  billOptions: Option[];
  defaultBillId?: string | null;
};

export function VendorCreditModal({ vendorId, vendorOptions, creditAccounts, billOptions, defaultBillId }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Add a credit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record vendor credit</DialogTitle>
        </DialogHeader>
        <VendorCreditForm
          vendorId={vendorId}
          vendorOptions={vendorOptions}
          creditAccounts={creditAccounts}
          billOptions={billOptions}
          defaultBillId={defaultBillId}
        />
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Dialog, DialogHeader, DialogTitle, LargeDialogContent } from '@/components/ui/dialog';
import GeneralJournalEntryForm, {
  type AccountOption,
  type PropertyOption,
  type UnitOption,
} from '@/components/financials/GeneralJournalEntryForm';

export type GeneralJournalEntryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyOptions: PropertyOption[];
  unitOptions: UnitOption[];
  unitsByProperty?: Record<string, UnitOption[]>;
  accountOptions: AccountOption[];
  defaultPropertyId?: string;
  defaultUnitId?: string;
  autoSelectDefaultProperty?: boolean;
  onSuccess?: () => void;
};

export type { AccountOption } from '@/components/financials/GeneralJournalEntryForm';

export function GeneralJournalEntryModal({
  open,
  onOpenChange,
  propertyOptions,
  unitOptions,
  unitsByProperty,
  accountOptions,
  defaultPropertyId,
  defaultUnitId,
  autoSelectDefaultProperty,
  onSuccess,
}: GeneralJournalEntryModalProps) {
  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LargeDialogContent className="max-h-screen w-[680px] max-w-[680px] overflow-hidden rounded-none border-none p-0 sm:max-h-[95vh] sm:rounded-2xl sm:border">
        <DialogHeader className="border-border px-4 py-4 pr-12 sm:px-6">
          <DialogTitle>General Journal Entry</DialogTitle>
        </DialogHeader>
        <GeneralJournalEntryForm
          mode="create"
          layout="modal"
          propertyOptions={propertyOptions}
          unitOptions={unitOptions}
          unitsByProperty={unitsByProperty}
          accountOptions={accountOptions}
          defaultPropertyId={defaultPropertyId}
          defaultUnitId={defaultUnitId}
          autoSelectDefaultProperty={autoSelectDefaultProperty}
          onCancel={handleClose}
          onSuccess={() => {
            onSuccess?.();
            handleClose();
          }}
        />
      </LargeDialogContent>
    </Dialog>
  );
}

export default GeneralJournalEntryModal;

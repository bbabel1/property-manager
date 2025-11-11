'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import GeneralJournalEntryModal, { type GeneralJournalEntryModalProps } from './GeneralJournalEntryModal';

type ModalProps = Omit<GeneralJournalEntryModalProps, 'open' | 'onOpenChange'>;

type RecordGeneralJournalEntryButtonProps = ModalProps & {
  className?: string;
};

export default function RecordGeneralJournalEntryButton({
  className,
  ...modalProps
}: RecordGeneralJournalEntryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button type="button" className={className} onClick={() => setIsOpen(true)}>
        Record general journal entry
      </Button>
      <GeneralJournalEntryModal open={isOpen} onOpenChange={setIsOpen} {...modalProps} />
    </>
  );
}

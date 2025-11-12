'use client';

import { useRouter } from 'next/navigation';
import GeneralJournalEntryForm, {
  type AccountOption,
  type JournalEntryFormValues,
  type PropertyOption,
  type UnitOption,
} from '@/components/financials/GeneralJournalEntryForm';
import JournalEntryDeleteButton from '@/components/financials/JournalEntryDeleteButton';

type JournalEntryEditFormProps = {
  transactionId: string;
  propertyId: string;
  buildiumLocked: boolean;
  propertyOptions: PropertyOption[];
  unitOptions: UnitOption[];
  accountOptions: AccountOption[];
  initialValues: JournalEntryFormValues;
};

export default function JournalEntryEditForm({
  transactionId,
  propertyId,
  buildiumLocked,
  propertyOptions,
  unitOptions,
  accountOptions,
  initialValues,
}: JournalEntryEditFormProps) {
  const router = useRouter();

  return (
    <GeneralJournalEntryForm
      mode="edit"
      layout="page"
      propertyOptions={propertyOptions}
      unitOptions={unitOptions}
      accountOptions={accountOptions}
      initialValues={initialValues}
      transactionId={transactionId}
      buildiumLocked={buildiumLocked}
      onCancel={() => router.push(`/properties/${propertyId}/financials`)}
      onClose={() => router.push(`/properties/${propertyId}/financials`)}
      onSuccess={() => router.refresh()}
      additionalActions={
        <JournalEntryDeleteButton
          transactionId={transactionId}
          propertyId={propertyId}
          disabled={buildiumLocked}
          className="sm:min-w-[140px]"
          fullWidth={false}
        />
      }
    />
  );
}


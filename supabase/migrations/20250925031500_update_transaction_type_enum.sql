DO $$
BEGIN
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'Check';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'Refund';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'ApplyDeposit';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'ElectronicFundsTransfer';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'Other';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'Deposit';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'GeneralJournalEntry';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'OwnerContribution';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'ReversePayment';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'ReverseElectronicFundsTransfer';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'VendorCredit';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'RentalApplicationFeePayment';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'ReverseRentalApplicationFeePayment';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'ReverseOwnerContribution';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'VendorRefund';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'UnreversedPayment';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'UnreversedElectronicFundsTransfer';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'UnreversedOwnerContribution';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'UnreversedRentalApplicationFeePayment';
  ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'ReversedEftRefund';
END $$;

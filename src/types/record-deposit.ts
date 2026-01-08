export type BankAccountOption = {
  id: string;
  label: string;
  balance?: number | null;
};

export type PropertyOption = { id: string; label: string; buildiumPropertyId: number | null };

export type UnitOption = {
  id: string;
  label: string;
  propertyId: string | null;
  buildiumUnitId: number | null;
};

export type GlAccountOption = {
  id: string;
  label: string;
  buildiumGlAccountId: number | null;
  type: string | null;
};

export type UndepositedPaymentRow = {
  id: string;
  date: string;
  propertyLabel: string;
  unitLabel: string;
  nameLabel: string;
  memoLabel: string;
  checkNumberLabel: string;
  amount: number;
};

export type RecordDepositPrefill = {
  bankAccountId: string;
  bankAccountName: string | null;
  bankAccounts: BankAccountOption[];
  defaultBankAccountId: string;
  undepositedPaymentsTitle: string;
  undepositedPayments: UndepositedPaymentRow[];
  properties: PropertyOption[];
  units: UnitOption[];
  glAccounts: GlAccountOption[];
  depositStatuses?: import('./deposits').DepositStatus[];
  defaultDepositStatus?: import('./deposits').DepositStatus;
};

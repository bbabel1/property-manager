export const CHARGE_TYPES = ['rent', 'late_fee', 'utility', 'other'] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];
export type ChargeStatus = 'open' | 'partial' | 'paid' | 'cancelled';

export const CHARGE_STATUSES: ChargeStatus[] = ['open', 'partial', 'paid', 'cancelled'];

export interface Charge {
  id: string;
  orgId: string;
  leaseId: number;
  transactionId: string | null;
  chargeScheduleId?: string | null;
  parentChargeId: string | null;
  chargeType: ChargeType;
  amount: number;
  amountOpen: number;
  paidAmount: number;
  dueDate: string;
  description: string | null;
  isProrated: boolean;
  prorationDays: number | null;
  baseAmount: number | null;
  status: ChargeStatus;
  buildiumChargeId: number | null;
  externalId: string | null;
  source: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReceivableType = 'rent' | 'fee' | 'utility' | 'other';
export type ReceivableStatus = 'open' | 'partial' | 'paid' | 'cancelled';

export const RECEIVABLE_TYPES: ReceivableType[] = ['rent', 'fee', 'utility', 'other'];
export const RECEIVABLE_STATUSES: ReceivableStatus[] = ['open', 'partial', 'paid', 'cancelled'];

export interface Receivable {
  id: string;
  orgId: string;
  leaseId: number;
  receivableType: ReceivableType;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  description: string | null;
  status: ReceivableStatus;
  externalId: string | null;
  source: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  id: string;
  orgId: string;
  paymentTransactionId: string;
  chargeId: string;
  allocatedAmount: number;
  allocationOrder: number;
  externalId: string | null;
  source: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

import type { TaskPriorityKey, TaskStatusKey } from '@/lib/tasks/utils';

export const MONTHLY_LOG_STAGES = [
  'charges',
  'payments',
  'bills',
  'escrow',
  'management_fees',
  'owner_statements',
  'owner_distributions',
] as const;

export const MONTHLY_LOG_STATUSES = ['pending', 'in_progress', 'complete'] as const;

export type MonthlyLogStage = (typeof MONTHLY_LOG_STAGES)[number];
export type MonthlyLogStatus = (typeof MONTHLY_LOG_STATUSES)[number];

export type MonthlyLogCardRecord = {
  id: string;
  periodStart: string;
  stage: MonthlyLogStage;
  status: MonthlyLogStatus;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitTitle: string;
  unitSubtitle: string;
  tenantName: string | null;
  chargesAmount: number;
  paymentsAmount: number;
  billsAmount: number;
  escrowAmount: number;
  managementFeesAmount: number;
  ownerStatementAmount: number;
  ownerDistributionAmount: number;
  sortIndex: number;
  notes: string | null;
};

export type SummaryCounts = {
  total: number;
  complete: number;
  pending: number;
  inProgress: number;
};

export type MonthlyLogTaskSummary = {
  id: string;
  subject: string;
  statusKey: TaskStatusKey;
  statusLabel: string;
  dueDateLabel: string;
  priorityKey: TaskPriorityKey;
  priorityLabel: string;
  categoryLabel: string | null;
  assignedToLabel: string | null;
  assignedToInitials: string | null;
  updatedRelativeLabel: string;
};

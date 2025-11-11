/**
 * Generic Stage Transaction Handler
 *
 * Provides shared logic for assigning/unassigning transactions to monthly log stages.
 * Reduces API duplication by handling all stages with a single interface.
 */

import { supabaseAdmin } from '@/lib/db';

export type MonthlyLogStage =
  | 'charges'
  | 'payments'
  | 'bills'
  | 'escrow'
  | 'management_fees'
  | 'owner_statements'
  | 'owner_distributions';

export type StageTransactionAction = 'assign' | 'unassign';

export interface StageTransaction {
  id: string;
  total_amount: number;
  date: string;
  transaction_type: string;
  memo: string;
  monthly_log_id: string | null;
  lease_id: number | null;
  reference_number: string | null;
  [key: string]: unknown;
}

/**
 * Assign transactions to a monthly log
 *
 * @param monthlyLogId - UUID of the monthly log
 * @param transactionIds - Array of transaction IDs to assign
 * @returns Success status
 */
export async function assignTransactions(
  monthlyLogId: string,
  transactionIds: string[],
): Promise<{ success: boolean; error?: string }> {
  if (transactionIds.length === 0) {
    return { success: false, error: 'No transactions provided' };
  }

  // Update transactions to link them to this monthly log
  const { error } = await supabaseAdmin
    .from('transactions')
    .update({ monthly_log_id: monthlyLogId })
    .in('id', transactionIds)
    .is('monthly_log_id', null); // Only assign unassigned transactions

  if (error) {
    console.error('Error assigning transactions:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Unassign transactions from a monthly log
 *
 * @param monthlyLogId - UUID of the monthly log
 * @param transactionIds - Array of transaction IDs to unassign
 * @returns Success status
 */
export async function unassignTransactions(
  monthlyLogId: string,
  transactionIds: string[],
): Promise<{ success: boolean; error?: string }> {
  if (transactionIds.length === 0) {
    return { success: false, error: 'No transactions provided' };
  }

  // Update transactions to remove monthly log link
  const { error } = await supabaseAdmin
    .from('transactions')
    .update({ monthly_log_id: null })
    .in('id', transactionIds)
    .eq('monthly_log_id', monthlyLogId); // Only unassign from this specific log

  if (error) {
    console.error('Error unassigning transactions:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Handle stage transaction action (assign or unassign)
 *
 * Generic handler that routes to appropriate function based on action.
 *
 * @param params - Action parameters
 * @returns Success status
 */
export async function handleStageTransactionAction(params: {
  monthlyLogId: string;
  stage: MonthlyLogStage;
  transactionIds: string[];
  action: StageTransactionAction;
}): Promise<{ success: boolean; error?: string }> {
  const { monthlyLogId, transactionIds, action } = params;

  // Validate monthly log exists
  const { data: monthlyLog } = await supabaseAdmin
    .from('monthly_logs')
    .select('id')
    .eq('id', monthlyLogId)
    .single();

  if (!monthlyLog) {
    return { success: false, error: 'Monthly log not found' };
  }

  // Route to appropriate handler
  if (action === 'assign') {
    return assignTransactions(monthlyLogId, transactionIds);
  } else {
    return unassignTransactions(monthlyLogId, transactionIds);
  }
}

/**
 * Get transactions for a specific stage
 *
 * Filters transactions by type based on the stage.
 *
 * @param monthlyLogId - UUID of the monthly log
 * @param stage - Stage to filter by
 * @returns Array of transactions for this stage
 */
export async function getStageTransactions(
  monthlyLogId: string,
  stage: MonthlyLogStage,
): Promise<StageTransaction[]> {
  // Map stages to transaction types
  const stageTransactionTypes: Record<MonthlyLogStage, string[]> = {
    charges: ['Charge', 'Credit'],
    payments: ['Payment'],
    bills: ['Bill'],
    escrow: [], // Escrow uses transaction_lines, not transactions
    management_fees: ['Charge'], // Management fees are also charges, filtered by memo
    owner_statements: [],
    owner_distributions: [],
  };

  const transactionTypes = stageTransactionTypes[stage];

  if (transactionTypes.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('monthly_log_id', monthlyLogId)
    .in('transaction_type', transactionTypes)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching stage transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get unassigned transactions for a specific stage
 *
 * Returns transactions that are not yet assigned to any monthly log,
 * filtered by type based on the stage.
 *
 * @param stage - Stage to filter by
 * @param unitId - Optional: filter by unit
 * @returns Array of unassigned transactions for this stage
 */
export async function getUnassignedStageTransactions(
  stage: MonthlyLogStage,
  unitId?: string,
): Promise<StageTransaction[]> {
  // Map stages to transaction types
  const stageTransactionTypes: Record<MonthlyLogStage, string[]> = {
    charges: ['Charge', 'Credit'],
    payments: ['Payment'],
    bills: ['Bill'],
    escrow: [],
    management_fees: ['Charge'],
    owner_statements: [],
    owner_distributions: [],
  };

  const transactionTypes = stageTransactionTypes[stage];

  if (transactionTypes.length === 0) {
    return [];
  }

  let query = supabaseAdmin
    .from('transactions')
    .select('*')
    .is('monthly_log_id', null)
    .in('transaction_type', transactionTypes)
    .order('date', { ascending: false });

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching unassigned stage transactions:', error);
    return [];
  }

  return data || [];
}

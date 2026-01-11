import type { SupabaseClient } from '@supabase/supabase-js';
import { PostingEngine } from '@/lib/accounting/posting-engine';
import { supabaseAdmin, SupabaseServiceRoleMissingError } from '@/lib/db';
import { getOrgGlSettingsOrThrow } from '@/lib/gl-settings';
import type { PostingLine } from '@/lib/accounting/posting-events';
import type { Charge, ChargeType, PaymentAllocation, Receivable } from '@/types/ar';

type ChargeAllocationInput = {
  accountId: string;
  amount: number;
  memo?: string | null;
};

export type CreateChargeWithReceivableParams = {
  leaseId: number;
  chargeType: ChargeType;
  amount: number;
  dueDate: string;
  description?: string | null;
  memo?: string | null;
  chargeScheduleId?: string | null;
  allocations?: ChargeAllocationInput[];
  source?: string | null;
  externalId?: string | null;
  createdBy?: string | null;
  isProrated?: boolean;
  prorationDays?: number | null;
  baseAmount?: number | null;
  parentChargeId?: string | null;
  transactionDate?: string | null;
};

type LeaseContext = {
  id: number;
  org_id: string;
  property_id: string | null;
  unit_id: string | null;
  buildium_property_id: number | null;
  buildium_unit_id: number | null;
  buildium_lease_id: number | null;
};

type TransactionSummary = {
  id: string;
  transaction_type: string;
  total_amount: number;
  date: string;
  memo: string | null;
  lease_id: number | null;
};

const approxEqual = (a: number, b: number, epsilon = 0.01) => Math.abs(a - b) <= epsilon;

const toCharge = (row: Record<string, any>): Charge => ({
  id: row.id,
  orgId: row.org_id,
  leaseId: Number(row.lease_id),
  transactionId: row.transaction_id ?? null,
  chargeScheduleId: row.charge_schedule_id ?? null,
  parentChargeId: row.parent_charge_id ?? null,
  chargeType: row.charge_type,
  amount: Number(row.amount),
  amountOpen: Number(row.amount_open),
  paidAmount: Number(row.amount) - Number(row.amount_open ?? 0),
  dueDate: row.due_date,
  description: row.description ?? null,
  isProrated: Boolean(row.is_prorated),
  prorationDays: row.proration_days ?? null,
  baseAmount: row.base_amount ?? null,
  status: row.status,
  buildiumChargeId: row.buildium_charge_id ?? null,
  externalId: row.external_id ?? null,
  source: row.source ?? null,
  createdBy: row.created_by ?? null,
  updatedBy: row.updated_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toReceivable = (row: Record<string, any>): Receivable => ({
  id: row.id,
  orgId: row.org_id,
  leaseId: Number(row.lease_id),
  receivableType: row.receivable_type,
  totalAmount: Number(row.total_amount),
  paidAmount: Number(row.paid_amount ?? 0),
  outstandingAmount: Number(row.outstanding_amount ?? 0),
  dueDate: row.due_date,
  description: row.description ?? null,
  status: row.status,
  externalId: row.external_id ?? null,
  source: row.source ?? null,
  createdBy: row.created_by ?? null,
  updatedBy: row.updated_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ArService {
  private readonly db: SupabaseClient;
  private readonly postingEngine: PostingEngine;

  constructor(client: SupabaseClient | null = supabaseAdmin) {
    if (!client) {
      throw new SupabaseServiceRoleMissingError('ArService requires a service role client');
    }
    this.db = client;
    this.postingEngine = new PostingEngine(client);
  }

  get client(): SupabaseClient {
    return this.db;
  }

  async createChargeWithReceivable(params: CreateChargeWithReceivableParams): Promise<{
    charge: Charge;
    receivable: Receivable | null;
    transaction: TransactionSummary | null;
    allocations: ChargeAllocationInput[];
  }> {
    const lease = await this.fetchLease(params.leaseId);
    const orgId = lease.org_id;
    const externalId = params.externalId ?? null;
    const idempotencyKey = externalId ? `charge:${orgId}:${externalId}` : null;
    const normalizedAllocations =
      Array.isArray(params.allocations) && params.allocations.length
        ? params.allocations.map((line) => ({
            accountId: line.accountId,
            amount: Number(line.amount),
            memo: line.memo ?? null,
          }))
        : [];

    if (externalId) {
      const existing = await this.findChargeByExternalId(orgId, externalId);
      if (existing) {
        const tx = existing.transaction_id
          ? await this.fetchTransactionSummary(existing.transaction_id)
          : null;
        const receivable = await this.findReceivableByExternalId(orgId, externalId);
        return {
          charge: toCharge(existing),
          receivable: receivable ? toReceivable(receivable) : null,
          transaction: tx,
          allocations: normalizedAllocations,
        };
      }
    }

    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Charge amount must be greater than zero');
    }

    if (normalizedAllocations.length) {
      for (const alloc of normalizedAllocations) {
        if (!alloc.accountId || !Number.isFinite(alloc.amount)) {
          throw new Error('Allocations must include an accountId and amount');
        }
      }
      const totalAlloc = normalizedAllocations.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
      if (!approxEqual(totalAlloc, amount)) {
        throw new Error('Allocated amounts must equal the charge amount');
      }
    }

    const glSettings = await getOrgGlSettingsOrThrow(orgId);
    const defaultCreditAccount =
      params.chargeType === 'late_fee'
        ? glSettings.late_fee_income || glSettings.rent_income
        : glSettings.rent_income;
    const usedAllocations: ChargeAllocationInput[] =
      normalizedAllocations.length > 0
        ? normalizedAllocations
        : [
            {
              accountId: defaultCreditAccount,
              amount,
              memo: params.memo ?? params.description ?? null,
            },
          ];
    const postingDate = params.transactionDate || params.dueDate;
    const memo = params.memo ?? params.description ?? null;
    const nowIso = new Date().toISOString();

    const { charge: initialCharge, receivable } = await this.insertChargeAndReceivable({
      lease,
      params,
      amount,
      transactionId: null,
      memo,
      nowIso,
    });

    let chargeRow = initialCharge;
    let transactionId: string | null = null;

    try {
      transactionId =
        usedAllocations.length > 1
          ? await this.postMultiAllocationCharge({
              lease,
              params,
              glSettings,
              amount,
              memo,
              postingDate,
              nowIso,
              idempotencyKey,
              allocations: usedAllocations,
              chargeId: chargeRow.id,
            })
          : await this.postSingleAllocationCharge({
              lease,
              params,
              glSettings,
              amount,
              memo,
              postingDate,
              nowIso,
              idempotencyKey,
              allocations: usedAllocations,
              chargeId: chargeRow.id,
            });
    } catch (error) {
      await this.cleanupChargeAndReceivable(chargeRow.id, receivable?.id);
      throw error;
    }

    if (transactionId) {
      const { data: updatedCharge, error: updateErr } = await this.db
        .from('charges')
        .update({ transaction_id: transactionId, updated_at: nowIso })
        .eq('id', chargeRow.id)
        .select('*')
        .maybeSingle();
      if (updateErr) throw updateErr;
      if (updatedCharge) {
        chargeRow = updatedCharge;
      }
    }

    const transaction = transactionId
      ? await this.fetchTransactionSummary(transactionId)
      : null;

    return {
      charge: toCharge(chargeRow),
      receivable: receivable ? toReceivable(receivable) : null,
      transaction,
      allocations: usedAllocations,
    };
  }

  private async insertChargeAndReceivable({
    lease,
    params,
    amount,
    transactionId,
    memo,
    nowIso,
  }: {
    lease: LeaseContext;
    params: CreateChargeWithReceivableParams;
    amount: number;
    transactionId: string | null;
    memo: string | null;
    nowIso: string;
  }) {
    const description = params.description ?? memo ?? null;
    const receivableType =
      params.chargeType === 'late_fee'
        ? 'fee'
        : params.chargeType === 'rent'
          ? 'rent'
          : params.chargeType === 'utility'
            ? 'utility'
            : 'other';

    const { data: charge, error: chargeErr } = await this.db
      .from('charges')
      .insert({
        org_id: lease.org_id,
        lease_id: lease.id,
        transaction_id: transactionId,
        charge_schedule_id: params.chargeScheduleId ?? null,
        parent_charge_id: params.parentChargeId ?? null,
        charge_type: params.chargeType,
        amount,
        amount_open: amount,
        due_date: params.dueDate,
        description,
        is_prorated: Boolean(params.isProrated),
        proration_days: params.prorationDays ?? null,
        base_amount: params.baseAmount ?? null,
        status: 'open',
        external_id: params.externalId ?? null,
        source: params.source ?? null,
        created_by: params.createdBy ?? null,
        updated_by: params.createdBy ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();
    if (chargeErr) throw chargeErr;

    const { data: receivable, error: recvErr } = await this.db
      .from('receivables')
      .insert({
        org_id: lease.org_id,
        lease_id: lease.id,
        receivable_type: receivableType,
        total_amount: amount,
        paid_amount: 0,
        due_date: params.dueDate,
        description,
        status: 'open',
        external_id: params.externalId ?? null,
        source: params.source ?? null,
        created_by: params.createdBy ?? null,
        updated_by: params.createdBy ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .maybeSingle();
    if (recvErr) throw recvErr;

    return { charge, receivable };
  }

  private async cleanupChargeAndReceivable(chargeId: string, receivableId?: string | null) {
    await this.db.from('charges').delete().eq('id', chargeId);
    if (receivableId) {
      await this.db.from('receivables').delete().eq('id', receivableId);
    }
  }

  private async postSingleAllocationCharge({
    lease,
    params,
    glSettings,
    amount,
    memo,
    postingDate,
    nowIso,
    idempotencyKey,
    allocations,
    chargeId,
  }: {
    lease: LeaseContext;
    params: CreateChargeWithReceivableParams;
    glSettings: Awaited<ReturnType<typeof getOrgGlSettingsOrThrow>>;
    amount: number;
    memo: string | null;
    postingDate: string;
    nowIso: string;
    idempotencyKey: string | null;
    allocations: ChargeAllocationInput[];
    chargeId: string;
  }): Promise<string> {
    const creditAccount =
      allocations?.[0]?.accountId ??
      (params.chargeType === 'late_fee'
        ? glSettings.late_fee_income || glSettings.rent_income
        : glSettings.rent_income);
    const eventType = params.chargeType === 'late_fee' ? 'late_fee' : 'rent_charge';

    const { transactionId } = await this.postingEngine.postEvent({
      eventType,
      orgId: lease.org_id,
      propertyId: lease.property_id ?? undefined,
      unitId: lease.unit_id ?? undefined,
      accountEntityType: 'Rental',
      accountEntityId: lease.buildium_property_id ?? undefined,
      postingDate,
      createdAt: nowIso,
      externalId: params.externalId ?? undefined,
      idempotencyKey: idempotencyKey ?? undefined,
      businessAmount: amount,
      eventData: {
        amount,
        memo: memo ?? undefined,
        leaseId: lease.id,
        propertyId: lease.property_id ?? undefined,
        unitId: lease.unit_id ?? undefined,
        buildiumLeaseId: lease.buildium_lease_id ?? undefined,
        debitGlAccountId: glSettings.ar_lease,
        creditGlAccountId: creditAccount,
      },
      metadata: {
        chargeId,
        allocations,
      },
    });

    return transactionId;
  }

  private async postMultiAllocationCharge({
    lease,
    params,
    glSettings,
    amount,
    memo,
    postingDate,
    nowIso,
    idempotencyKey,
    chargeId,
    allocations: allocationLines,
  }: {
    lease: LeaseContext;
    params: CreateChargeWithReceivableParams;
    glSettings: Awaited<ReturnType<typeof getOrgGlSettingsOrThrow>>;
    amount: number;
    memo: string | null;
    postingDate: string;
    nowIso: string;
    idempotencyKey: string | null;
    chargeId: string;
    allocations: ChargeAllocationInput[];
  }): Promise<string> {
    const lines: PostingLine[] =
      allocationLines?.map((line) => ({
        gl_account_id: line.accountId,
        amount: Number(line.amount),
        posting_type: 'Credit',
        memo: line.memo ?? memo ?? undefined,
        property_id: lease.property_id ?? undefined,
        unit_id: lease.unit_id ?? undefined,
        lease_id: lease.id,
      })) ?? [];

    lines.unshift({
      gl_account_id: glSettings.ar_lease,
      amount,
      posting_type: 'Debit',
      memo: memo ?? undefined,
      property_id: lease.property_id ?? undefined,
      unit_id: lease.unit_id ?? undefined,
      lease_id: lease.id,
    });

    console.log('[postMultiAllocationCharge] Lease context:', {
      lease_id: lease.id,
      property_id: lease.property_id,
      unit_id: lease.unit_id,
      org_id: lease.org_id,
    });
    console.log('[postMultiAllocationCharge] Lines property/unit IDs:', lines.map((l) => ({
      gl_account_id: l.gl_account_id,
      property_id: l.property_id,
      unit_id: l.unit_id,
      lease_id: l.lease_id,
    })));

    const { transactionId } = await this.postingEngine.postEvent({
      eventType: 'other_transaction',
      orgId: lease.org_id,
      propertyId: lease.property_id ?? undefined,
      unitId: lease.unit_id ?? undefined,
      accountEntityType: 'Rental',
      accountEntityId: lease.buildium_property_id ?? undefined,
      postingDate,
      createdAt: nowIso,
      externalId: params.externalId ?? undefined,
      idempotencyKey: idempotencyKey ?? undefined,
      businessAmount: amount,
      eventData: {
        memo: memo ?? undefined,
        transactionType: 'Charge',
        lines,
      },
      metadata: {
        chargeId,
        allocations: allocationLines,
      },
    });

    return transactionId;
  }

  private async fetchLease(leaseId: number): Promise<LeaseContext> {
    const { data, error } = await this.db
      .from('lease')
      .select(
        'id, org_id, property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id'
      )
      .eq('id', leaseId)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.org_id) {
      throw new Error(`Lease ${leaseId} not found or missing org`);
    }
    return data as LeaseContext;
  }

  private async findChargeByExternalId(orgId: string, externalId: string) {
    const { data } = await this.db
      .from('charges')
      .select('*')
      .eq('org_id', orgId)
      .eq('external_id', externalId)
      .maybeSingle();
    return data ?? null;
  }

  private async findReceivableByExternalId(orgId: string, externalId: string) {
    const { data } = await this.db
      .from('receivables')
      .select('*')
      .eq('org_id', orgId)
      .eq('external_id', externalId)
      .maybeSingle();
    return data ?? null;
  }

  private async fetchTransactionSummary(id: string): Promise<TransactionSummary | null> {
    const { data } = await this.db
      .from('transactions')
      .select('id, transaction_type, total_amount, date, memo, lease_id')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      transaction_type: data.transaction_type,
      total_amount: Number(data.total_amount ?? 0),
      date: data.date as string,
      memo: (data as Record<string, any>).memo ?? null,
      lease_id: (data as Record<string, any>).lease_id ?? null,
    };
  }

  async placeholderAllocatePayment(
    _paymentTransactionId: string,
    _allocations: PaymentAllocation[],
  ): Promise<Receivable[]> {
    throw new Error('Not implemented: allocation handling will be added in Phase 3');
  }
}

export const arService = new ArService();

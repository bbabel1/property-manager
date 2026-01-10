import { Pool, type PoolClient } from 'pg';
import type { Charge, ChargeType, PaymentAllocation } from '@/types/ar';

export type AllocationOrder = ChargeType[];

export type ManualAllocation = {
  chargeId: string;
  amount: number;
};

export type AllocationResult = {
  allocations: PaymentAllocation[];
  charges: Charge[];
};

const DEFAULT_ORDER: AllocationOrder = ['rent', 'late_fee', 'utility', 'other'];
const EPSILON = 0.01;

let sharedPool: Pool | null = null;

const getServiceRolePool = (): Pool => {
  if (sharedPool) return sharedPool;

  const directUrl = process.env.SUPABASE_DB_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const projectRef = process.env.SUPABASE_PROJECT_REF_PRODUCTION;
  const connectionString =
    directUrl ||
    (password && projectRef
      ? `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`
      : null);

  if (!connectionString) {
    throw new Error(
      'AllocationEngine requires SUPABASE_DB_URL or SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF_PRODUCTION',
    );
  }

  sharedPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: 'pm-allocation-engine',
  });
  return sharedPool;
};

const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await getServiceRolePool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures to avoid masking original error
    }
    throw error;
  } finally {
    client.release();
  }
};

const mapCharge = (row: Record<string, any>): Charge => ({
  id: row.id,
  orgId: row.org_id,
  leaseId: Number(row.lease_id),
  transactionId: row.transaction_id ?? null,
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

const mapAllocation = (row: Record<string, any>): PaymentAllocation => ({
  id: row.id,
  orgId: row.org_id,
  paymentTransactionId: row.payment_transaction_id,
  chargeId: row.charge_id,
  allocatedAmount: Number(row.allocated_amount),
  allocationOrder: Number(row.allocation_order),
  externalId: row.external_id ?? null,
  source: row.source ?? null,
  createdBy: row.created_by ?? null,
  updatedBy: row.updated_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toOrderCaseExpr = (order: AllocationOrder): string => {
  const whenClauses = order
    .map((type, idx) => `WHEN charge_type = '${type}' THEN ${idx + 1}`)
    .join(' ');
  return `(CASE ${whenClauses} ELSE ${order.length + 1} END)`;
};

const sumAllocations = (allocations: { amount: number }[]) =>
  allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0);

export class AllocationEngine {
  async getOutstandingCharges(leaseId: number, order: AllocationOrder = DEFAULT_ORDER) {
    const client = await getServiceRolePool().connect();
    try {
      const orderExpr = toOrderCaseExpr(order);
      const { rows } = await client.query(
        `
        SELECT *
        FROM public.charges
        WHERE lease_id = $1
          AND status IN ('open','partial')
          AND amount_open > 0
        ORDER BY ${orderExpr}, due_date, created_at, id
        `,
        [leaseId],
      );
      return rows.map(mapCharge);
    } finally {
      client.release();
    }
  }

  async allocatePayment(
    paymentAmount: number,
    leaseId: number,
    paymentTransactionId: string,
    allocationOrder: AllocationOrder = DEFAULT_ORDER,
    manualAllocations?: ManualAllocation[],
    externalId?: string,
  ): Promise<AllocationResult> {
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    return withTransaction<AllocationResult>(async (client) => {
      const payment = await this.getPaymentForUpdate(client, paymentTransactionId);
      if (!payment) {
        throw new Error(`Payment transaction ${paymentTransactionId} not found`);
      }
      if (payment.lease_id != null && Number(payment.lease_id) !== Number(leaseId)) {
        throw new Error('Payment lease mismatch');
      }

      const leaseOrgId = await this.getOrgIdForLease(client, leaseId);
      if (leaseOrgId !== payment.org_id) {
        throw new Error('Payment org does not match lease org');
      }

      const existing = await this.getExistingAllocations(client, paymentTransactionId);
      if (existing.allocations.length) {
        return existing;
      }

      if (externalId) {
        const externalExisting = await this.getAllocationsByExternalId(
          client,
          payment.org_id,
          externalId,
        );
        if (externalExisting.allocations.length) {
          return externalExisting;
        }
      }

      const charges = await this.loadChargesForUpdate(
        client,
        leaseId,
        leaseOrgId,
        allocationOrder,
        manualAllocations,
      );

      if (!charges.length) {
        throw new Error('No outstanding charges to allocate against');
      }

      const allocations = this.buildAllocations(
        paymentAmount,
        charges,
        manualAllocations,
      );

      const now = new Date().toISOString();
      const insertedAllocations: PaymentAllocation[] = [];
      const updatedCharges: Charge[] = [];

      for (let i = 0; i < allocations.length; i += 1) {
        const entry = allocations[i];
        const charge = charges.find((c) => c.id === entry.chargeId);
        if (!charge) {
          throw new Error('Charge not found during allocation');
        }

        const newOpen = Math.max(0, Number(charge.amountOpen) - Number(entry.amount));
        const status =
          newOpen <= EPSILON
            ? 'paid'
            : newOpen < Number(charge.amount)
              ? 'partial'
              : 'open';

        const { rows: chargeRows } = await client.query(
          `
          UPDATE public.charges
          SET amount_open = $1, status = $2, updated_at = $3
          WHERE id = $4
          RETURNING *
          `,
          [Number(newOpen.toFixed(2)), status, now, entry.chargeId],
        );
        updatedCharges.push(mapCharge(chargeRows[0]));

        const externalForRow = externalId && i === 0 ? externalId : null;
        const { rows: allocRows } = await client.query(
          `
          INSERT INTO public.payment_allocations (
            org_id,
            payment_transaction_id,
            charge_id,
            allocated_amount,
            allocation_order,
            external_id,
            created_at,
            updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
          RETURNING *
          `,
          [
            payment.org_id,
            paymentTransactionId,
            entry.chargeId,
            Number(entry.amount.toFixed(2)),
            i,
            externalForRow,
            now,
          ],
        );
        insertedAllocations.push(mapAllocation(allocRows[0]));
      }

      return { allocations: insertedAllocations, charges: updatedCharges };
    });
  }

  private async loadChargesForUpdate(
    client: PoolClient,
    leaseId: number,
    orgId: string,
    order: AllocationOrder,
    manual: ManualAllocation[] | undefined,
  ): Promise<Charge[]> {
    if (manual && manual.length) {
      const ids = manual.map((m) => m.chargeId);
      const { rows } = await client.query(
        `
        SELECT *
        FROM public.charges
        WHERE lease_id = $1
          AND org_id = $2
          AND id = ANY($3)
          AND status IN ('open','partial')
          AND amount_open > 0
        FOR UPDATE
        `,
        [leaseId, orgId, ids],
      );
      return rows.map(mapCharge);
    }

    const orderExpr = toOrderCaseExpr(order);
    const { rows } = await client.query(
      `
      SELECT *
      FROM public.charges
      WHERE lease_id = $1
        AND org_id = $2
        AND status IN ('open','partial')
        AND amount_open > 0
      ORDER BY ${orderExpr}, due_date, created_at, id
      FOR UPDATE
      `,
      [leaseId, orgId],
    );
    return rows.map(mapCharge);
  }

  private buildAllocations(
    paymentAmount: number,
    charges: Charge[],
    manual?: ManualAllocation[],
  ) {
    const remainingCharges = [...charges];

    if (manual && manual.length) {
      const totalManual = sumAllocations(manual);
      if (Math.abs(totalManual - paymentAmount) > EPSILON) {
        throw new Error('Manual allocations must equal the payment amount');
      }

      return manual.map((entry) => {
        const charge = remainingCharges.find((c) => c.id === entry.chargeId);
        if (!charge) {
          throw new Error(`Manual allocation references missing charge ${entry.chargeId}`);
        }
        if (entry.amount - charge.amountOpen > EPSILON) {
          throw new Error(`Manual allocation exceeds charge balance for ${entry.chargeId}`);
        }
        return { chargeId: entry.chargeId, amount: Number(entry.amount) };
      });
    }

    let remaining = paymentAmount;
    const allocations: { chargeId: string; amount: number }[] = [];

    for (const charge of remainingCharges) {
      if (remaining <= EPSILON) break;
      const allocAmount = Math.min(remaining, charge.amountOpen);
      if (allocAmount <= 0) continue;
      allocations.push({ chargeId: charge.id, amount: Number(allocAmount) });
      remaining -= allocAmount;
    }

    if (remaining > EPSILON) {
      throw new Error('Not enough open charges to allocate full payment amount');
    }

    return allocations;
  }

  private async getPaymentForUpdate(client: PoolClient, transactionId: string) {
    const { rows } = await client.query(
      `SELECT id, org_id, lease_id FROM public.transactions WHERE id = $1 FOR UPDATE`,
      [transactionId],
    );
    return rows[0] ?? null;
  }

  private async getExistingAllocations(client: PoolClient, paymentTransactionId: string) {
    const { rows } = await client.query(
      `SELECT * FROM public.payment_allocations WHERE payment_transaction_id = $1 ORDER BY allocation_order`,
      [paymentTransactionId],
    );
    const allocations = rows.map(mapAllocation);
    if (!allocations.length) {
      return { allocations: [], charges: [] };
    }
    const chargeIds = allocations.map((a) => a.chargeId);
    const { rows: chargeRows } = await client.query(
      `SELECT * FROM public.charges WHERE id = ANY($1)`,
      [chargeIds],
    );
    return { allocations, charges: chargeRows.map(mapCharge) };
  }

  private async getAllocationsByExternalId(client: PoolClient, orgId: string, externalId: string) {
    const { rows } = await client.query(
      `SELECT * FROM public.payment_allocations WHERE org_id = $1 AND external_id = $2 LIMIT 1`,
      [orgId, externalId],
    );
    if (!rows.length) return { allocations: [], charges: [] };
    const paymentId = rows[0].payment_transaction_id;
    return this.getExistingAllocations(client, paymentId);
  }

  private async getOrgIdForLease(client: PoolClient, leaseId: number) {
    const { rows } = await client.query(`SELECT org_id FROM public.lease WHERE id = $1`, [
      leaseId,
    ]);
    const orgId = rows[0]?.org_id;
    if (!orgId) {
      throw new Error(`Lease ${leaseId} missing org_id`);
    }
    return orgId;
  }
}

export const allocationEngine = new AllocationEngine();

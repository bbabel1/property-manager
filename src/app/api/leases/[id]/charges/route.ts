import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { hasSupabaseAdmin } from '@/lib/supabase-client'
import { arService } from '@/lib/ar-service'
import { CHARGE_TYPES, type ChargeType } from '@/types/ar'
import {
  amountsRoughlyEqual,
  fetchLeaseContextById,
  fetchBuildiumGlAccountMap,
  buildLinesFromAllocations,
  castLeaseTransactionLinesForPersistence,
} from '@/lib/lease-transaction-helpers'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium'
import { supabaseAdmin } from '@/lib/db'

const EnterChargeSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().nullable().optional(),
  allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative() })),
  charge_type: z.enum(CHARGE_TYPES).default('rent'),
  source: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  is_prorated: z.boolean().optional(),
  proration_days: z.number().int().nullable().optional(),
  base_amount: z.number().nullable().optional(),
  parent_charge_id: z.string().nullable().optional(),
  transaction_date: z.string().nullable().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const leaseId = Number(id)
  if (Number.isNaN(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  const json = await request.json().catch(() => undefined)
  const parsed = EnterChargeSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    if (!hasSupabaseAdmin()) {
      await requireAuth()
    }

    const totalAmount = parsed.data.allocations.reduce((sum, line) => sum + (line?.amount ?? 0), 0)
    if (!amountsRoughlyEqual(parsed.data.amount, totalAmount)) {
      return NextResponse.json({ error: 'Allocated amounts must equal the charge amount' }, { status: 400 })
    }

    const chargeType = (parsed.data.charge_type ?? 'rent') as ChargeType
    
    // Create charge locally first
    const result = await arService.createChargeWithReceivable({
      leaseId,
      chargeType,
      amount: parsed.data.amount,
      dueDate: parsed.data.date,
      description: parsed.data.memo ?? null,
      memo: parsed.data.memo ?? null,
      allocations: parsed.data.allocations.map((line) => ({
        accountId: line.account_id,
        amount: line.amount,
      })),
      source: parsed.data.source ?? 'manual',
      externalId: parsed.data.external_id ?? undefined,
      createdBy: parsed.data.created_by ?? null,
      isProrated: parsed.data.is_prorated ?? false,
      prorationDays: parsed.data.proration_days ?? null,
      baseAmount: parsed.data.base_amount ?? null,
      parentChargeId: parsed.data.parent_charge_id ?? null,
      transactionDate: parsed.data.transaction_date ?? parsed.data.date,
    })

    // Sync to Buildium if we have a transaction ID
    let buildiumTransactionId: number | null = null
    if (result.transaction?.id) {
      try {
        const leaseContext = await fetchLeaseContextById(leaseId)
        const glAccountMap = await fetchBuildiumGlAccountMap(
          parsed.data.allocations.map((line) => line.account_id)
        )
        const buildiumLines = buildLinesFromAllocations(parsed.data.allocations, glAccountMap)
        const lines = castLeaseTransactionLinesForPersistence(buildiumLines)

        const buildiumPayload: BuildiumLeaseTransactionCreate = {
          TransactionType: 'Charge',
          TransactionDate: parsed.data.date,
          Amount: parsed.data.amount,
          Memo: parsed.data.memo ?? undefined,
          Lines: lines,
        }

        console.log('[charge-creation] Syncing to Buildium:', {
          leaseId,
          buildiumLeaseId: leaseContext.buildiumLeaseId,
          transactionId: result.transaction.id,
        })

        // Create in Buildium - this will also create a local transaction via upsertLeaseTransactionWithLines
        const buildiumSyncResult = await LeaseTransactionService.createInBuildiumAndDB(
          leaseContext.buildiumLeaseId,
          buildiumPayload,
          leaseContext.orgId ?? undefined,
        )

        if (buildiumSyncResult?.buildium?.Id) {
          buildiumTransactionId = buildiumSyncResult.buildium.Id
          
          console.log('[charge-creation] Buildium sync result:', {
            buildiumId: buildiumSyncResult.buildium.Id,
            localId: buildiumSyncResult.localId,
            originalTransactionId: result.transaction.id,
            isDuplicate: buildiumSyncResult.localId && buildiumSyncResult.localId !== result.transaction.id,
          })
          
          // If createInBuildiumAndDB created a different local transaction, update our original one
          // and delete the duplicate (if any)
          if (buildiumSyncResult.localId && buildiumSyncResult.localId !== result.transaction.id) {
            console.log('[charge-creation] Buildium sync created duplicate transaction, cleaning up:', {
              originalId: result.transaction.id,
              buildiumCreatedId: buildiumSyncResult.localId,
              buildiumTransactionId: buildiumTransactionId,
            })
            
            // Delete the duplicate transaction FIRST (before updating original)
            // This frees up the buildium_transaction_id for the original transaction
            console.log('[charge-creation] Deleting duplicate transaction first to free up Buildium ID')
            
            // Delete related records first (same pattern as other delete endpoints)
            const { error: depositDeleteErr } = await supabaseAdmin
              .from('deposit_items')
              .delete()
              .eq('payment_transaction_id', buildiumSyncResult.localId)
            if (depositDeleteErr) {
              console.error('[charge-creation] Failed to delete deposit_items:', depositDeleteErr)
            } else {
              console.log('[charge-creation] Deleted deposit_items for duplicate transaction')
            }

            const { error: paymentDeleteErr } = await supabaseAdmin
              .from('payment')
              .delete()
              .eq('transaction_id', buildiumSyncResult.localId)
            if (paymentDeleteErr) {
              console.error('[charge-creation] Failed to delete payment records:', paymentDeleteErr)
            } else {
              console.log('[charge-creation] Deleted payment records for duplicate transaction')
            }

            // Delete the duplicate transaction using the safe delete function
            // This temporarily disables balance validation trigger
            console.log('[charge-creation] Calling delete_transaction_safe for:', buildiumSyncResult.localId)
            const { error: deleteError, data: deleteData } = await supabaseAdmin.rpc('delete_transaction_safe', {
              p_transaction_id: buildiumSyncResult.localId,
            })

            if (deleteError) {
              console.error('[charge-creation] Failed to delete duplicate transaction:', {
                error: deleteError,
                transactionId: buildiumSyncResult.localId,
                errorCode: (deleteError as any).code,
                errorMessage: (deleteError as any).message,
                errorDetails: (deleteError as any).details,
              })
            } else {
              console.log('[charge-creation] Successfully deleted duplicate transaction, now updating original:', {
                deletedId: buildiumSyncResult.localId,
                deleteData,
              })
              
              // Now update our original transaction with Buildium ID (after duplicate is deleted)
              const { error: updateError } = await supabaseAdmin
                .from('transactions')
                .update({
                  buildium_transaction_id: buildiumTransactionId,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', result.transaction.id)

              if (updateError) {
                console.error('[charge-creation] Failed to update transaction with Buildium ID:', updateError)
              } else {
                console.log('[charge-creation] Successfully updated original transaction with Buildium ID:', buildiumTransactionId)
              }
            }
          } else {
            // Update our transaction with Buildium ID if it's the same one
            console.log('[charge-creation] Buildium sync used same transaction, updating with Buildium ID')
            const { error: updateError } = await supabaseAdmin
              .from('transactions')
              .update({
                buildium_transaction_id: buildiumTransactionId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', result.transaction.id)

            if (updateError) {
              console.error('[charge-creation] Failed to update transaction with Buildium ID:', updateError)
            } else {
              console.log('[charge-creation] Updated transaction with Buildium ID:', buildiumTransactionId)
            }
          }
        }
      } catch (buildiumError) {
        console.error('[charge-creation] Buildium sync failed (non-fatal):', buildiumError)
        // Non-fatal - charge was created locally, just log the error
      }
    }

    const transactionPayload = result.transaction ?? {
      id: result.charge.transactionId ?? null,
      transaction_type: 'Charge',
      total_amount: parsed.data.amount,
      date: parsed.data.date,
      memo: parsed.data.memo ?? null,
      lease_id: leaseId,
      buildium_transaction_id: buildiumTransactionId,
    }

    return NextResponse.json(
      {
        data: {
          transaction: transactionPayload,
          charge: result.charge,
          receivable: result.receivable,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating lease charge:', error)
    if (error instanceof Error) {
      // Log additional context for property_id validation errors
      if (error.message.includes('property_id') || error.message.includes('unit_id')) {
        console.error('[charge-creation] Property/unit validation error context:', {
          leaseId,
          errorMessage: error.message,
          errorCode: (error as any).code,
          errorDetails: (error as any).details,
          errorHint: (error as any).hint,
        })
      }
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (
        error.message === 'Lease not found' ||
        error.message === 'Lease is missing Buildium identifier' ||
        error.message.includes('Buildium mapping')
      ) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to record charge' }, { status: 500 })
  }
}

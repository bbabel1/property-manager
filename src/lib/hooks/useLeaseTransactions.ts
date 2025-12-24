"use client"
import { useCallback, useMemo, useState } from 'react'
import { BuildiumEdgeClient } from '@/lib/buildium-edge-client'
import type { 
  BuildiumLeaseTransaction, 
  BuildiumLeaseTransactionCreate, 
  BuildiumLeaseTransactionUpdate,
  BuildiumRecurringTransactionCreate,
  BuildiumRecurringTransactionUpdate
} from '@/types/buildium'

export interface UseLeaseTransactionsOptions {
  leaseId: number
  limit?: number
  offset?: number
  orderby?: string
  dateFrom?: string
  dateTo?: string
}

export function useLeaseTransactions(options: UseLeaseTransactionsOptions) {
  const { leaseId, limit, offset, orderby, dateFrom, dateTo } = options
  const client = useMemo(() => new BuildiumEdgeClient(), [])

  const [items, setItems] = useState<BuildiumLeaseTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { success, data, error } = await client.listLeaseTransactions(leaseId, { limit, offset, orderby, dateFrom, dateTo })
      if (!success) throw new Error(error || 'Failed to list lease transactions')
      setItems(data || [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [client, leaseId, limit, offset, orderby, dateFrom, dateTo])

  const getOne = useCallback(async (transactionId: number, persist = false) => {
    const { success, data, error } = await client.getLeaseTransaction(leaseId, transactionId, persist)
    if (!success) throw new Error(error || 'Failed to fetch lease transaction')
    return data || null
  }, [client, leaseId])

  const createOne = useCallback(async (payload: BuildiumLeaseTransactionCreate, persist = true) => {
    const { success, data, error } = await client.createLeaseTransaction(leaseId, payload, persist)
    if (!success) throw new Error(error || 'Failed to create lease transaction')
    // optimistic refresh
    await list()
    return data || null
  }, [client, leaseId, list])

  const updateOne = useCallback(async (transactionId: number, payload: BuildiumLeaseTransactionUpdate, persist = true) => {
    const { success, data, error } = await client.updateLeaseTransaction(leaseId, transactionId, payload, persist)
    if (!success) throw new Error(error || 'Failed to update lease transaction')
    await list()
    return data || null
  }, [client, leaseId, list])

  // Recurring helpers
  const listRecurring = useCallback(async () => {
    const { success, data, error } = await client.listRecurringLeaseTransactions(leaseId)
    if (!success) throw new Error(error || 'Failed to list recurring transactions')
    return data || []
  }, [client, leaseId])

  const createRecurring = useCallback(async (payload: BuildiumRecurringTransactionCreate) => {
    const { success, data, error } = await client.createRecurringLeaseTransaction(leaseId, payload)
    if (!success) throw new Error(error || 'Failed to create recurring transaction')
    return data || null
  }, [client, leaseId])

  const updateRecurring = useCallback(async (recurringId: number, payload: BuildiumRecurringTransactionUpdate) => {
    const { success, data, error } = await client.updateRecurringLeaseTransaction(leaseId, recurringId, payload)
    if (!success) throw new Error(error || 'Failed to update recurring transaction')
    return data || null
  }, [client, leaseId])

  const deleteRecurring = useCallback(async (recurringId: number) => {
    const { success, error } = await client.deleteRecurringLeaseTransaction(leaseId, recurringId)
    if (!success) throw new Error(error || 'Failed to delete recurring transaction')
  }, [client, leaseId])

  return {
    items,
    loading,
    error,
    list,
    getOne,
    createOne,
    updateOne,
    listRecurring,
    createRecurring,
    updateRecurring,
    deleteRecurring,
  }
}

export default useLeaseTransactions

"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BuildiumEdgeClient, getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import type { 
  BuildiumLeaseTransaction, 
  BuildiumLeaseTransactionCreate, 
  BuildiumLeaseTransactionUpdate,
  BuildiumRecurringTransactionCreate,
  BuildiumRecurringTransactionUpdate
} from '@/types/buildium'

export interface UseLeaseTransactionsOptions {
  leaseId: number
  orgId?: string
  limit?: number
  offset?: number
  orderby?: string
  dateFrom?: string
  dateTo?: string
}

export function useLeaseTransactions(options: UseLeaseTransactionsOptions) {
  const { leaseId, orgId, limit, offset, orderby, dateFrom, dateTo } = options
  const [client, setClient] = useState<BuildiumEdgeClient | null>(null)
  const [clientLoading, setClientLoading] = useState(true)
  
  // Create client with org-scoped credentials if orgId is provided
  useEffect(() => {
    let mounted = true
    setClientLoading(true)
    
    if (orgId) {
      getOrgScopedBuildiumEdgeClient(orgId)
        .then((orgClient) => {
          if (mounted) {
            setClient(orgClient)
            setClientLoading(false)
          }
        })
        .catch((error) => {
          console.error('Failed to create org-scoped Buildium client:', error)
          if (mounted) {
            // Fall back to default client
            setClient(new BuildiumEdgeClient())
            setClientLoading(false)
          }
        })
    } else {
      // Fall back to default client (env vars)
      if (mounted) {
        setClient(new BuildiumEdgeClient())
        setClientLoading(false)
      }
    }
    
    return () => {
      mounted = false
    }
  }, [orgId])
  
  const defaultClient = useMemo(() => new BuildiumEdgeClient(), [])
  const activeClient = client || defaultClient

  const [items, setItems] = useState<BuildiumLeaseTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = useCallback(async () => {
    if (!activeClient) return
    setLoading(true)
    setError(null)
    try {
      const { success, data, error } = await activeClient.listLeaseTransactions(leaseId, { limit, offset, orderby, dateFrom, dateTo })
      if (!success) throw new Error(error || 'Failed to list lease transactions')
      setItems(data || [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [activeClient, leaseId, limit, offset, orderby, dateFrom, dateTo])

  const getOne = useCallback(async (transactionId: number, persist = false) => {
    if (!activeClient) throw new Error('Client not initialized')
    const { success, data, error } = await activeClient.getLeaseTransaction(leaseId, transactionId, persist)
    if (!success) throw new Error(error || 'Failed to fetch lease transaction')
    return data || null
  }, [activeClient, leaseId])

  const createOne = useCallback(async (payload: BuildiumLeaseTransactionCreate, persist = true) => {
    if (!activeClient) throw new Error('Client not initialized')
    const { success, data, error } = await activeClient.createLeaseTransaction(leaseId, payload, persist)
    if (!success) throw new Error(error || 'Failed to create lease transaction')
    // optimistic refresh
    await list()
    return data || null
  }, [activeClient, leaseId, list])

  const updateOne = useCallback(async (transactionId: number, payload: BuildiumLeaseTransactionUpdate, persist = true) => {
    if (!activeClient) throw new Error('Client not initialized')
    const { success, data, error } = await activeClient.updateLeaseTransaction(leaseId, transactionId, payload, persist)
    if (!success) throw new Error(error || 'Failed to update lease transaction')
    await list()
    return data || null
  }, [activeClient, leaseId, list])

  // Recurring helpers
  const listRecurring = useCallback(async () => {
    if (!activeClient) throw new Error('Client not initialized')
    const { success, data, error } = await activeClient.listRecurringLeaseTransactions(leaseId)
    if (!success) throw new Error(error || 'Failed to list recurring transactions')
    return data || []
  }, [activeClient, leaseId])

  const createRecurring = useCallback(async (payload: BuildiumRecurringTransactionCreate) => {
    if (!activeClient) throw new Error('Client not initialized')
    const { success, data, error } = await activeClient.createRecurringLeaseTransaction(leaseId, payload)
    if (!success) throw new Error(error || 'Failed to create recurring transaction')
    return data || null
  }, [activeClient, leaseId])

  const updateRecurring = useCallback(async (recurringId: number, payload: BuildiumRecurringTransactionUpdate) => {
    if (!activeClient) throw new Error('Client not initialized')
    const { success, data, error } = await activeClient.updateRecurringLeaseTransaction(leaseId, recurringId, payload)
    if (!success) throw new Error(error || 'Failed to update recurring transaction')
    return data || null
  }, [activeClient, leaseId])

  const deleteRecurring = useCallback(async (recurringId: number) => {
    if (!activeClient) throw new Error('Client not initialized')
    const { success, error } = await activeClient.deleteRecurringLeaseTransaction(leaseId, recurringId)
    if (!success) throw new Error(error || 'Failed to delete recurring transaction')
  }, [activeClient, leaseId])

  return {
    items,
    loading: loading || clientLoading,
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

# Buildium Lease Transactions — Usage Guide

This guide shows how to work with Buildium Lease Transactions using the new Supabase Edge Function and the client helpers added in this repo.

## Overview

- Edge Function: `buildium-lease-transactions-api`
  - Actions: `list`, `get`, `create`, `update`, `listRecurring`, `getRecurring`, `createRecurring`, `updateRecurring`, `deleteRecurring`
  - Optional `persist: true` on `get`/`create`/`update` writes to `transactions` + `transaction_lines`.
  - Does not persist on `list`.

- React Hook: `useLeaseTransactions`
  - File: `src/lib/hooks/useLeaseTransactions.ts`
  - Wraps the Edge function for list/get/create/update and recurring ops.

## Deploy

Do this later when ready to deploy:

```
npm run secrets:set:buildium
npm run deploy:edge:lease-transactions
```

Ensure `BUILDIUM_BASE_URL`, `BUILDIUM_CLIENT_ID`, `BUILDIUM_CLIENT_SECRET` are exported in your shell before `secrets:set:buildium`.

## Client Usage (React)

Example: list transactions for a lease and create a new Charge.

```
"use client"
import { useEffect } from 'react'
import { useLeaseTransactions } from '@/lib/hooks/useLeaseTransactions'

export default function LeaseTransactionsPanel({ leaseId }: { leaseId: number }) {
  const { items, loading, error, list, createOne } = useLeaseTransactions({ leaseId, limit: 50, orderby: 'Date desc' })

  useEffect(() => { list() }, [list])

  async function addCharge() {
    await createOne({
      TransactionType: 'Charge',
      TransactionDate: new Date().toISOString().slice(0,10),
      Amount: 100.00,
      Memo: 'Manual Rent Charge',
      Lines: [ { GLAccountId: 4000, Amount: 100.00, Memo: 'Rent' } ]
    }, true)
  }

  if (loading) return <div>Loading…</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <button onClick={addCharge}>Add Charge</button>
      <ul>
        {items.map((t: any) => (
          <li key={t.Id}>#{t.Id} • {t.TransactionType} • {t.TotalAmount ?? t.Amount}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Direct Edge Function Calls

If you prefer not to use the hook, call the Edge function directly:

```
import { supabase } from '@/lib/db'

// List
await supabase.functions.invoke('buildium-lease-transactions-api', {
  body: { action: 'list', leaseId: 12345, orderby: 'Date desc', limit: 50 }
})

// Get + persist into DB
await supabase.functions.invoke('buildium-lease-transactions-api', {
  body: { action: 'get', leaseId: 12345, transactionId: 999, persist: true }
})

// Create + persist
await supabase.functions.invoke('buildium-lease-transactions-api', {
  body: { action: 'create', leaseId: 12345, persist: true, payload: {
    TransactionType: 'Charge',
    TransactionDate: '2025-09-02',
    Amount: 100,
    Memo: 'Manual Charge',
    Lines: [{ GLAccountId: 4000, Amount: 100 }]
  }}
})
```

## Data Model

- Header: `public.transactions`
  - buildium_transaction_id, buildium_lease_id, transaction_type, date, total_amount, memo, etc.
- Lines: `public.transaction_lines`
  - transaction_id → references `transactions.id`
  - gl_account_id (local), buildium_property_id/unit_id/lease_id stored for traceability

## Notes

- List calls do not persist. Use `get`/`create`/`update` with `persist: true` to write rows.
- Payment method mapping is not applied in the webhook per your direction.
- GL Account resolution occurs when persisting lines; unknown GL accounts are fetched from Buildium and inserted minimally.


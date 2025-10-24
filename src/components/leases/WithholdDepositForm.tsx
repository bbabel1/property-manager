"use client"

import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dropdown } from '@/components/ui/Dropdown'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { LeaseAccountOption } from '@/components/leases/types'

const WithholdDepositSchema = z.object({
  date: z.string().min(1, 'Date required'),
  deposit_account_id: z.string().min(1, 'Deposit account required'),
  memo: z.string().optional(),
  allocations: z.array(
    z.object({
      account_id: z.string().min(1, 'Account required'),
      amount: z.number().nonnegative(),
    })
  ).min(1, 'Add at least one allocation'),
})

type AllocationRow = {
  id: string
  account_id: string
  amount: string
}

type FormState = {
  date: string | null
  deposit_account_id: string
  memo: string
  allocations: AllocationRow[]
}

export interface WithholdDepositFormProps {
  leaseId: number | string
  leaseSummary: {
    propertyUnit?: string | null
    tenants?: string | null
  }
  accounts: LeaseAccountOption[]
  onCancel?: () => void
  onSuccess?: () => void
}

export default function WithholdDepositForm({ leaseId, leaseSummary, accounts, onCancel, onSuccess }: WithholdDepositFormProps) {
  const createId = () => (
    typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  )

  const [form, setForm] = useState<FormState>({
    date: null,
    deposit_account_id: accounts?.[0]?.id ?? '',
    memo: 'Deposit applied to balances',
    allocations: [{ id: createId(), account_id: accounts?.[0]?.id ?? '', amount: '' }],
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>> & { allocations?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const updateAllocation = useCallback((id: string, changes: Partial<AllocationRow>) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    }))
    setErrors((prev) => ({ ...prev, allocations: undefined }))
  }, [])

  const addRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { id: createId(), account_id: '', amount: '' }],
    }))
  }, [])

  const removeRow = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.length > 1 ? prev.allocations.filter((row) => row.id !== id) : prev.allocations,
    }))
  }, [])

  const allocationsTotal = useMemo(
    () => form.allocations.reduce((sum, row) => sum + Number(row.amount || '0'), 0),
    [form.allocations]
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitting(true)
      setFormError(null)

      const allocationsParsed = form.allocations
        .filter((row) => row.account_id)
        .map((row) => ({ account_id: row.account_id, amount: Number(row.amount || '0') }))

      const totalAmount = allocationsTotal
      const payload = {
        date: form.date ?? '',
        deposit_account_id: form.deposit_account_id,
        memo: form.memo,
        allocations: allocationsParsed,
      }

      const parsed = WithholdDepositSchema.safeParse(payload)
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
          const key = issue.path?.[0]
          if (key === 'allocations') fieldErrors.allocations = issue.message
          else if (typeof key === 'string') fieldErrors[key] = issue.message
        }
        setErrors(fieldErrors as any)
        setSubmitting(false)
        return
      }

      const amountValue = totalAmount

      try {
        const res = await fetch(`/api/leases/${leaseId}/withheld-deposits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: parsed.data.date,
            deposit_account_id: parsed.data.deposit_account_id,
            amount: amountValue,
            memo: parsed.data.memo || null,
            allocations: allocationsParsed,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to withhold deposit')
        }

        setForm({
          date: null,
          deposit_account_id: accounts?.[0]?.id ?? '',
          memo: 'Deposit applied to balances',
          allocations: [{ id: createId(), account_id: '', amount: '' }],
        })
        setErrors({})
        onSuccess?.()
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Unexpected error while withholding deposit')
        setSubmitting(false)
        return
      }

      setSubmitting(false)
    },
    [form, leaseId, onSuccess, allocationsTotal]
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Withhold deposit{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
          {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
        </h1>
      </div>

      <Card className="border border-border/70 shadow-sm">
        <CardContent className="p-8 space-y-10">
          <form className="space-y-10" onSubmit={handleSubmit}>
            <section className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date *</span>
                <DatePicker value={form.date} onChange={(value) => updateField('date', value)} placeholder="YYYY-MM-DD" />
                {errors.date ? <p className="text-xs text-destructive">{errors.date}</p> : null}
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deposit *</span>
                <Dropdown
                  value={form.deposit_account_id}
                  onChange={(value) => updateField('deposit_account_id', value)}
                  options={(accounts ?? []).map((account) => ({ value: String(account.id), label: account.name }))}
                  placeholder="Select account"
                />
                {errors.deposit_account_id ? <p className="text-xs text-destructive">{errors.deposit_account_id}</p> : null}
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memo</span>
                <Textarea
                  rows={3}
                  value={form.memo}
                  onChange={(event) => updateField('memo', event.target.value)}
                  maxLength={200}
                />
                <div className="text-right text-xs text-muted-foreground">{form.memo.length}/200</div>
              </label>
            </section>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachment</span>
                <div className="mt-2 rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                  Drag & drop file here or <button type="button" className="text-primary underline">browse</button>
                </div>
              </div>
            </div>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Apply deposit to balances</h2>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table className="min-w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="w-32 text-right">Balance</TableHead>
                      <TableHead className="w-32 text-right">Amount</TableHead>
                      <TableHead className="w-12 text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.allocations.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                        <Dropdown
                          value={row.account_id}
                          onChange={(value) => updateAllocation(row.id, { account_id: value })}
                          options={(accounts ?? []).map((account) => ({ value: String(account.id), label: account.name }))}
                          placeholder="Select account"
                        />
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">$0.00</TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="w-28"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => updateAllocation(row.id, { amount: event.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} aria-label="Remove allocation">
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">$0.00</TableCell>
                      <TableCell className="text-right text-sm">${allocationsTotal.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <Button variant="link" className="px-0" type="button" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add row
              </Button>
              {errors.allocations ? <p className="text-xs text-destructive">{errors.allocations}</p> : null}
            </section>

            {formError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Withhold deposit'}
              </Button>
              <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                Withhold another deposit
              </Button>
              <Button type="button" variant="cancel" className="text-muted-foreground" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

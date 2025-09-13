"use client"

import { useEffect, useMemo, useState } from 'react'
import InlineEditCard from '@/components/form/InlineEditCard'
import { Dropdown } from '@/components/ui/Dropdown'
import CreateBankAccountModal from '@/components/CreateBankAccountModal'
import Link from 'next/link'

type BankAccount = { id: string; name: string; account_number?: string | null }

export default function BankingDetailsCard({ property, fin }: { property: any; fin?: { cash_balance?: number; security_deposits?: number; reserve?: number; available_balance?: number; as_of?: string } }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reserve, setReserve] = useState<number>(property.reserve || 0)
  const [operatingId, setOperatingId] = useState<string>(property.operating_bank_account_id || '')
  const [trustId, setTrustId] = useState<string>(property.deposit_trust_account_id || '')

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [showCreateBank, setShowCreateBank] = useState(false)
  const [createTarget, setCreateTarget] = useState<'operating' | 'trust' | null>(null)

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingAccounts(true)
        const res = await fetch('/api/bank-accounts')
        if (!res.ok) throw new Error('Failed to load bank accounts')
        const data = await res.json()
        if (!cancelled) setBankAccounts(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load bank accounts')
      } finally {
        if (!cancelled) setLoadingAccounts(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editing])

  async function onSave() {
    try {
      setSaving(true)
      setError(null)
      const res = await fetch(`/api/properties/${property.id}/banking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserve,
          operating_bank_account_id: operatingId || null,
          deposit_trust_account_id: trustId || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any))
        throw new Error(j?.error || 'Failed to update banking details')
      }
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update banking details')
    } finally {
      setSaving(false)
    }
  }

  const operatingAccount = useMemo(() => property.operating_account, [property])
  const trustAccount = useMemo(() => property.deposit_trust_account, [property])

  const view = (
    <div className="space-y-4">
      {/* Cash balance */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-2">Cash balance</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground">Cash balance:</span>
          <span className="text-lg font-bold text-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin?.cash_balance ?? 0)}</span>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>- Security deposits and early payments:</span>
            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin?.security_deposits ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>- Property reserve:</span>
            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin?.reserve ?? (property.reserve || 0))}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-sm text-foreground">Available balance</span>
          <span className="text-sm font-bold text-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin?.available_balance ?? 0)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">as of {new Date(fin?.as_of || new Date()).toLocaleDateString()}</p>
      </div>

      <hr className="border-border" />

      {/* Banking details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-foreground">Banking details</h4>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Operating Account:</span>
          <span className="text-sm text-muted-foreground">
            {operatingAccount ? (
              <Link className="text-primary hover:underline" href={`/bank-accounts/${operatingAccount.id}`}>
                {`${operatingAccount.name}${operatingAccount.last4 ? ' ****' + operatingAccount.last4 : ''}`}
              </Link>
            ) : (
              'Setup'
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Deposit Trust Account:</span>
          <span className="text-sm text-muted-foreground">
            {trustAccount ? (
              <Link className="text-primary hover:underline" href={`/bank-accounts/${trustAccount.id}`}>
                {`${trustAccount.name}${trustAccount.last4 ? ' ****' + trustAccount.last4 : ''}`}
              </Link>
            ) : (
              'Setup'
            )}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">PROPERTY RESERVE</p>
          <span className="font-semibold text-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(reserve ?? 0)}</span>
        </div>
      </div>
    </div>
  )

  const edit = (
    <div className="space-y-6">
      {error ? <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">{error}</div> : null}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Property Reserve ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              type="number"
              value={reserve}
              onChange={(e) => setReserve(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              className="w-full h-9 pl-8 pr-3 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 text-sm"
              placeholder="e.g., 50000.00"
              step={0.01}
              min={0}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Operating Bank Account</label>
          <Dropdown
            value={operatingId}
            onChange={(value) => {
              if (value === 'create-new-account') { setCreateTarget('operating'); setShowCreateBank(true); return }
              setOperatingId(value)
            }}
            options={[
              ...(bankAccounts || []).map((a) => ({ value: a.id, label: `${a.name} - ${a.account_number ? `****${String(a.account_number).slice(-4)}` : 'No account number'}` })),
              { value: 'create-new-account', label: '✓ Create New Bank Account' },
            ]}
            placeholder={loadingAccounts ? 'Loading...' : 'Select a bank account...'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Deposit Trust Account</label>
          <Dropdown
            value={trustId}
            onChange={(value) => {
              if (value === 'create-new-account') { setCreateTarget('trust'); setShowCreateBank(true); return }
              setTrustId(value)
            }}
            options={[
              ...(bankAccounts || []).map((a) => ({ value: a.id, label: `${a.name} - ${a.account_number ? `****${String(a.account_number).slice(-4)}` : 'No account number'}` })),
              { value: 'create-new-account', label: '✓ Create New Bank Account' },
            ]}
            placeholder={loadingAccounts ? 'Loading...' : 'Select a bank account...'}
          />
        </div>
      </div>

      <CreateBankAccountModal
        isOpen={showCreateBank}
        onClose={() => { setShowCreateBank(false); setCreateTarget(null) }}
        onSuccess={(newAccount: any) => {
          const id = String(newAccount?.id ?? newAccount?.bankAccount?.id ?? '')
          const name = newAccount?.name ?? newAccount?.bankAccount?.name ?? 'New Bank Account'
          const account_number = newAccount?.account_number ?? newAccount?.bankAccount?.account_number ?? null
          setBankAccounts(prev => [{ id, name, account_number }, ...prev.filter(a => a.id !== id)])
          if (createTarget === 'operating') setOperatingId(id)
          if (createTarget === 'trust') setTrustId(id)
          setCreateTarget(null)
        }}
      />
    </div>
  )

  return (
    <InlineEditCard
      title="Banking details"
      editing={editing}
      onEdit={() => setEditing(true)}
      onCancel={() => { setEditing(false); setError(null) }}
      onSave={onSave}
      isSaving={saving}
      canSave={true}
      className="bg-[#e6e6e6] border-[#dedede]"
      view={view}
      edit={edit}
    />
  )
}

"use client"

import { useEffect, useMemo, useState } from 'react'
import { Dropdown } from '@/components/ui/Dropdown'
import { SelectWithDescription } from '@/components/ui/SelectWithDescription'
import CreateBankAccountModal from '@/components/CreateBankAccountModal'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type BankAccount = { id: string; name: string; account_number?: string | null }

// Management Services Types
type MgmtScope = 'Building' | 'Unit'
type AssignmentLevel = 'Property Level' | 'Unit Level'
type ServicePlan = 'Full' | 'Basic' | 'A-la-carte'
type ServiceName =
  | 'Rent Collection'
  | 'Maintenance'
  | 'Turnovers'
  | 'Compliance'
  | 'Bill Pay'
  | 'Condition Reports'
  | 'Renewals'
type FeeAssignment = 'Building' | 'Unit'
type FeeType = 'Percentage' | 'Flat Rate'
type BillingFrequency = 'Annual' | 'Monthly'

const ALL_SERVICES: ServiceName[] = [
  'Rent Collection',
  'Maintenance',
  'Turnovers',
  'Compliance',
  'Bill Pay',
  'Condition Reports',
  'Renewals',
]

const fieldSurfaceClass = 'border border-blue-200/70 shadow-sm bg-[#f3f7ff]/80 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors'
const inputFieldClass = `w-full h-9 px-3 rounded-md text-sm text-foreground focus-visible:outline-none ${fieldSurfaceClass}`
const inputFieldWithSuffixClass = `${inputFieldClass} pr-10`

export default function PropertyBankingAndServicesCard({ 
  property, 
  fin 
}: { 
  property: any; 
  fin?: { cash_balance?: number; security_deposits?: number; reserve?: number; available_balance?: number; as_of?: string } 
}) {
  const [editingBanking, setEditingBanking] = useState(false)
  const [editingServices, setEditingServices] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  // Banking state
  const [reserve, setReserve] = useState<number>(property.reserve || 0)
  const [operatingId, setOperatingId] = useState<string>(property.operating_bank_account_id || '')
  const [trustId, setTrustId] = useState<string>(property.deposit_trust_account_id || '')

  // Banking accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [showCreateBank, setShowCreateBank] = useState(false)
  const [createTarget, setCreateTarget] = useState<'operating' | 'trust' | null>(null)

  // Management services state
  const [management_scope, setManagementScope] = useState<MgmtScope | ''>((property as any)?.management_scope || '')
  const [service_assignment, setServiceAssignment] = useState<AssignmentLevel | ''>((property as any)?.service_assignment || '')
  const [service_plan, setServicePlan] = useState<ServicePlan | ''>((property as any)?.service_plan || '')
  const [active_services, setActiveServices] = useState<ServiceName[]>(Array.isArray((property as any)?.active_services) ? (property as any).active_services : [])
  const [fee_assignment, setFeeAssignment] = useState<FeeAssignment | ''>((property as any)?.fee_assignment || '')
  const [fee_type, setFeeType] = useState<FeeType | ''>((property as any)?.fee_type || '')
  const [fee_percentage, setFeePercentage] = useState<number | ''>(() => {
    const pct = (property as any)?.fee_percentage
    const fee = (property as any)?.management_fee
    return (property as any)?.fee_type === 'Percentage' ? (Number(pct ?? fee) || '') : (typeof pct === 'number' ? pct : '')
  })
  const [management_fee, setManagementFee] = useState<number | ''>(() => {
    const fee = (property as any)?.management_fee
    return (property as any)?.fee_type === 'Flat Rate' ? (Number(fee) || '') : (typeof fee === 'number' ? fee : '')
  })
  const [billing_frequency, setBillingFrequency] = useState<BillingFrequency | ''>((property as any)?.billing_frequency || '')


  useEffect(() => {
    if (!editingBanking) return
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
  }, [editingBanking])

  // Fetch CSRF when entering edit mode
  useEffect(() => {
    if (!editingBanking && !editingServices) return
    let cancelled = false
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' })
        const j = await res.json().catch(() => ({} as any))
        if (!cancelled) setCsrfToken(j?.token || null)
      } catch {
        if (!cancelled) setCsrfToken(null)
      }
    }
    fetchToken()
    return () => { cancelled = true }
  }, [editingBanking, editingServices])

  // Auto-select all active services when selecting Full plan
  useEffect(() => {
    if (service_plan === 'Full') {
      setActiveServices([...ALL_SERVICES])
    }
  }, [service_plan])

  const operatingAccount = useMemo(() => property.operating_account, [property])
  const trustAccount = useMemo(() => property.deposit_trust_account, [property])
  const requiresFees = useMemo(() => fee_assignment === 'Building', [fee_assignment])

  function validateServices(): string | null {
    if (!service_assignment) return 'Service assignment is required'
    if (!service_plan) return 'Service plan is required'
    if (requiresFees) {
      if (!fee_type) return 'Fee type is required'
      if (fee_type === 'Percentage' && (fee_percentage === '' || fee_percentage == null)) return 'Fee percentage is required'
      if (fee_type === 'Flat Rate' && (management_fee === '' || management_fee == null)) return 'Management fee is required'
      if (!billing_frequency) return 'Billing frequency is required'
    }
    return null
  }

  async function onSaveBanking() {
    if (!csrfToken) { setError('CSRF token not found'); return }
    
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
      setEditingBanking(false)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update banking details')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveServices() {
    const msg = validateServices()
    if (msg) { setError(msg); return }
    if (!csrfToken) { setError('CSRF token not found'); return }
    
    try {
      setSaving(true)
      setError(null)
      const body: any = {
        // Required by API
        name: property.name,
        address_line1: property.address_line1,
        city: property.city,
        state: property.state,
        postal_code: property.postal_code,
        country: property.country || 'United States',
        status: property.status || 'Active',
        property_type: (property as any).property_type ?? null,
        // Management/services/fees
        management_scope: management_scope || null,
        service_assignment: service_assignment || null,
        service_plan: service_plan || null,
        active_services: Array.isArray(active_services) && active_services.length ? active_services : null,
        fee_assignment: fee_assignment || null,
        fee_type: fee_type || null,
        fee_percentage: fee_type === 'Percentage' && typeof fee_percentage === 'number' ? fee_percentage : null,
        management_fee:
          fee_type === 'Flat Rate' && typeof management_fee === 'number'
            ? management_fee
            : fee_type === 'Percentage' && typeof fee_percentage === 'number'
            ? fee_percentage
            : null,
        billing_frequency: billing_frequency || null,
      }
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any))
        throw new Error(j?.error || 'Failed to save management services')
      }
      setEditingServices(false)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save management services')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  const view = (
    <div className="space-y-4">
      {/* Banking Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-foreground">Banking & Financials</h4>
          <button 
            onClick={() => setEditingBanking(true)}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        
        {/* Cash balance */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground">Cash balance:</span>
            <span className="text-sm font-bold text-foreground">{formatCurrency(fin?.cash_balance ?? 0)}</span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>- Security deposits and early payments:</span>
              <span>{formatCurrency(fin?.security_deposits ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>- Property reserve:</span>
              <span>{formatCurrency(fin?.reserve ?? (property.reserve || 0))}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-sm text-foreground">Available balance</span>
            <span className="text-sm font-bold text-foreground">{formatCurrency(fin?.available_balance ?? 0)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">as of {new Date(fin?.as_of || new Date()).toLocaleDateString()}</p>
        </div>

        {/* Banking details */}
        <div className="space-y-2">
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
        </div>
      </div>

      <div className="border-t border-border pt-4">
        {/* Management Services Section */}
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-foreground">Management Services</h4>
          <button 
            onClick={() => setEditingServices(true)}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ASSIGNMENT LEVEL</p>
            <p className="text-sm text-foreground mt-1">{(service_assignment as string) || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SERVICE PLAN</p>
            <p className="text-sm text-foreground mt-1">{(service_plan as string) || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ACTIVE SERVICES</p>
            <p className="text-sm text-foreground mt-1">{active_services.length ? active_services.join(', ') : '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">MANAGEMENT FEE</p>
            <p className="text-sm text-foreground mt-1">{(() => {
              const type = fee_type as FeeType | ''
              if (type === 'Percentage' && typeof fee_percentage === 'number') return `${fee_percentage}%`
              if (type === 'Flat Rate' && typeof management_fee === 'number') return formatCurrency(management_fee)
              return '—'
            })()}</p>
          </div>
        </div>
      </div>
    </div>
  )


  const editBanking = (
    <div className="relative space-y-4">
      {error ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">{error}</div>
      ) : null}
      
      {/* Banking Edit Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-medium text-gray-900">Banking & Financials</h4>
          <div className="flex items-center gap-3 ml-auto">
            <Button 
              variant="ghost" 
              onClick={() => { setEditingBanking(false); setError(null) }}
            >
              Cancel
            </Button>
            <Button 
              onClick={onSaveBanking}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Property Reserve ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={reserve}
                onChange={(e) => setReserve(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary text-sm"
                placeholder="e.g., 50000.00"
                step={0.01}
                min={0}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Operating Bank Account
            </label>
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
              className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Deposit Trust Account
            </label>
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
              className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )

  const editServices = (
    <div className="relative space-y-4">
      {error ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">{error}</div>
      ) : null}
      
      {/* Management Services Edit Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-medium text-gray-900">Management Services</h4>
          <div className="flex items-center gap-3 ml-auto">
            <Button 
              variant="ghost" 
              onClick={() => { setEditingServices(false); setError(null) }}
            >
              Cancel
            </Button>
            <Button 
              onClick={onSaveServices}
              disabled={saving || !!validateServices()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Management Scope</label>
            <SelectWithDescription
              value={management_scope || ''}
              onChange={(v) => setManagementScope((v || '') as MgmtScope | '')}
              options={[
                { value: 'Building', label: 'Building', description: 'Manage entire property' },
                { value: 'Unit', label: 'Unit', description: 'Manage specific units' },
              ]}
              placeholder="Select scope..."
              triggerClassName={fieldSurfaceClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Service Assignment *</label>
            <SelectWithDescription
              value={service_assignment || ''}
              onChange={(v) => setServiceAssignment((v || '') as AssignmentLevel | '')}
              options={[
                { value: 'Property Level', label: 'Property Level' },
                { value: 'Unit Level', label: 'Unit Level' },
              ]}
              placeholder="Select level..."
              triggerClassName={fieldSurfaceClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Service Plan *</label>
            <SelectWithDescription
              value={service_plan || ''}
              onChange={(v) => setServicePlan((v || '') as ServicePlan | '')}
              options={[
                { value: 'Full', label: 'Full' },
                { value: 'Basic', label: 'Basic' },
                { value: 'A-la-carte', label: 'A-la-carte' },
              ]}
              placeholder="Select plan..."
              triggerClassName={fieldSurfaceClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">Active Services</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-[#e4edff]/80 border border-blue-200/70 shadow-inner">
              {ALL_SERVICES.map((svc) => {
                const checked = (active_services || []).includes(svc)
                return (
                  <label key={svc} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      className="h-4 w-4 accent-primary rounded border-blue-300/70"
                      onChange={(e) => {
                        const curr = new Set(active_services || [])
                        if (e.target.checked) curr.add(svc)
                        else curr.delete(svc)
                        setActiveServices(Array.from(curr) as ServiceName[])
                      }}
                    />
                    <span>{svc}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
        <div className="border-t border-blue-200/70 pt-6">
          <h4 className="text-sm font-semibold text-blue-900/90 mb-3 tracking-wide">Management Fees</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fee Assignment *</label>
              <SelectWithDescription
                value={fee_assignment || ''}
                onChange={(v) => setFeeAssignment((v || '') as FeeAssignment | '')}
                options={[
                  { value: 'Building', label: 'Building' },
                  { value: 'Unit', label: 'Unit' },
                ]}
                placeholder="Select assignment..."
                triggerClassName={fieldSurfaceClass}
              />
            </div>
            {fee_assignment === 'Building' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Fee Type *</label>
                  <SelectWithDescription
                    value={fee_type || ''}
                    onChange={(v) => setFeeType((v || '') as FeeType | '')}
                    options={[
                      { value: 'Percentage', label: 'Percentage of rent' },
                      { value: 'Flat Rate', label: 'Flat Rate' },
                    ]}
                    placeholder="Select type..."
                    triggerClassName={fieldSurfaceClass}
                  />
                </div>
                {fee_type === 'Percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Fee Percentage *</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={fee_percentage}
                        onChange={(e) => setFeePercentage(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`${inputFieldWithSuffixClass} placeholder:text-muted-foreground`}
                        placeholder="e.g., 8"
                        step={0.01}
                        min={0}
                        max={100}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                )}
                {fee_type === 'Flat Rate' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Management Fee *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={management_fee}
                        onChange={(e) => setManagementFee(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`${inputFieldClass} pl-8 pr-3 placeholder:text-muted-foreground`}
                        placeholder="e.g., 100.00"
                        step={0.01}
                        min={0}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Billing Frequency *</label>
                  <SelectWithDescription
                    value={billing_frequency || ''}
                    onChange={(v) => setBillingFrequency((v || '') as BillingFrequency | '')}
                    options={[
                      { value: 'Monthly', label: 'Monthly' },
                      { value: 'Annual', label: 'Annual' },
                    ]}
                    placeholder="Select frequency..."
                    triggerClassName={fieldSurfaceClass}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className={`rounded-lg border border-primary/30 p-4 text-sm relative ${editingBanking || editingServices ? 'bg-white shadow-lg' : 'bg-primary/5'}`}>
        {editingBanking && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-sm" />}
        {editingServices && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-sm" />}
        {editingBanking ? editBanking : editingServices ? editServices : view}
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
    </>
  )
}

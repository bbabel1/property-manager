"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { SelectWithDescription } from '@/components/ui/SelectWithDescription'
import { Button } from '@/components/ui/button'
import { X, Save } from 'lucide-react'
import EditLink from '@/components/ui/EditLink'
import Link from 'next/link'

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

interface UnitFinancialServicesCardProps {
  fin?: { 
    cash_balance?: number; 
    security_deposits?: number; 
    reserve?: number; 
    available_balance?: number; 
    prepayments?: number 
  }
  rent?: number | null
  prepayments?: number | null
  property: any
  unit?: any
  leaseId?: string | null
}

export default function UnitFinancialServicesCard({ 
  fin, 
  rent, 
  prepayments, 
  property, 
  unit,
  leaseId 
}: UnitFinancialServicesCardProps) {
  const [editing, setEditing] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  const fmt = (n?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

  // Fetch CSRF when entering edit mode
  useEffect(() => {
    if (!editing) return
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
  }, [editing])

  // Auto-select all active services when selecting Full plan
  useEffect(() => {
    if (service_plan === 'Full') {
      setActiveServices([...ALL_SERVICES])
    }
  }, [service_plan])

  const requiresFees = useMemo(() => fee_assignment === 'Building', [fee_assignment])

  function validate(): string | null {
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

  async function onSave() {
    const msg = validate()
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
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save management services')
    } finally {
      setSaving(false)
    }
  }

  const financialSection = (
    <div className="border-b border-border pb-4 mb-4">
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Balance:</span>
          <span className="text-lg font-semibold text-foreground">{fmt(fin?.available_balance ?? fin?.cash_balance)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Deposits held:</span>
          <span>{fmt(fin?.security_deposits)}</span>
        </div>
      </div>
      {leaseId && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="text-xs">
            Receive payment
          </Button>
          <Link href={`/leases/${leaseId}`} className="text-sm text-primary hover:underline">
            Lease ledger
          </Link>
        </div>
      )}
    </div>
  )

  const managementServicesView = (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold text-foreground">Management Services</h3>
        <EditLink onClick={() => setEditing(true)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            if (type === 'Flat Rate' && typeof management_fee === 'number') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(management_fee)
            return '—'
          })()}</p>
        </div>
      </div>
    </div>
  )

  const managementServicesEdit = (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold text-foreground">Management Services</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setError(null) }}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || !validate()}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="space-y-6">
        {error ? (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">{error}</div>
        ) : null}
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

  const combinedView = (
    <div>
      {financialSection}
      {managementServicesView}
    </div>
  )

  const combinedEdit = (
    <div>
      {financialSection}
      {managementServicesEdit}
    </div>
  )

  return (
    <Card className="bg-primary/5 border border-primary/30 shadow-sm">
      <CardContent className="p-4">
        {editing ? combinedEdit : combinedView}
      </CardContent>
    </Card>
  )
}

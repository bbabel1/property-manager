"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Dropdown } from '@/components/ui/Dropdown'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function LeaseSection({ leases, unit, property }: { leases: any[]; unit: any; property: any }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [propertyId, setPropertyId] = useState<string>(property?.id || '')
  const [unitId, setUnitId] = useState<string>(unit?.id || '')
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unit_number: string }[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rent, setRent] = useState('')
  const [depositDate, setDepositDate] = useState('')
  const [leaseType, setLeaseType] = useState<string>('Fixed')
  const [depositAmt, setDepositAmt] = useState('')
  const [showAddTenant, setShowAddTenant] = useState(false)
  // Existing-tenant selection UI state
  const [chooseExisting, setChooseExisting] = useState(false)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<{ id: string; name: string; email?: string | null }[]>([])
  const [selectedExistingTenantIds, setSelectedExistingTenantIds] = useState<string[]>([])
  const [sameAsUnitAddress, setSameAsUnitAddress] = useState(true)
  const [showAltPhone, setShowAltPhone] = useState(false)
  const [altPhone, setAltPhone] = useState('')
  const [showAltEmail, setShowAltEmail] = useState(false)
  const [altEmail, setAltEmail] = useState('')
  // Primary address (blank by default)
  const [addr1, setAddr1] = useState<string>('')
  const [addr2, setAddr2] = useState<string>('')
  const [cityField, setCityField] = useState<string>('')
  const [stateField, setStateField] = useState<string>('')
  const [postalField, setPostalField] = useState<string>('')
  const [countryField, setCountryField] = useState<string>('')
  // Alternate address fields (hidden until link clicked)
  const [showAltAddress, setShowAltAddress] = useState(false)
  const [altAddr1, setAltAddr1] = useState<string>('')
  const [altAddr2, setAltAddr2] = useState<string>('')
  const [altCity, setAltCity] = useState<string>('')
  const [altState, setAltState] = useState<string>('')
  const [altPostal, setAltPostal] = useState<string>('')
  const [altCountry, setAltCountry] = useState<string>('')

  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')
  const fmtUsd = (n?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

  // Load Active properties list when form opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const loadProps = async () => {
      try {
        const res = await fetch('/api/properties')
        const j = await res.json().catch(() => [])
        const active = (Array.isArray(j) ? j : []).filter((p: any) => String(p.status || '').toLowerCase() === 'active')
          .map((p: any) => ({ id: String(p.id), name: p.name || 'Property' }))
        if (!cancelled) setProperties(active)
      } catch {}
    }
    loadProps()
    return () => { cancelled = true }
  }, [open])

  // Load Units for selected property (status != Inactive)
  useEffect(() => {
    if (!open || !propertyId) return
    let cancelled = false
    const primeFromProp = () => {
      if (String(property?.id) === String(propertyId) && Array.isArray(property?.units)) {
        const list = (property.units as any[]).filter(u => String((u as any).status || '').toLowerCase() !== 'inactive')
          .map(u => ({ id: String((u as any).id), unit_number: (u as any).unit_number || 'Unit' }))
        if (list.length) { setUnits(list); return true }
      }
      return false
    }
    const loadUnits = async () => {
      if (primeFromProp()) return
      try {
        const supa = getSupabaseBrowserClient()
        const { data } = await supa
          .from('units')
          .select('id, unit_number, status')
          .eq('property_id', propertyId)
          .not('status', 'eq', 'Inactive')
          .order('unit_number')
        const list = (data || []).map(u => ({ id: String(u.id), unit_number: u.unit_number || 'Unit' }))
        if (!cancelled) setUnits(list)
      } catch {}
    }
    loadUnits()
    return () => { cancelled = true }
  }, [open, propertyId])

  async function save() {
    try {
      setSaving(true); setError(null)
      if (!from) throw new Error('Start date is required')
      const body: any = {
        property_id: propertyId || property?.id,
        unit_id: unitId || unit?.id,
        lease_from_date: from,
        lease_to_date: to || null,
        rent_amount: rent ? Number(rent) : null,
        security_deposit: depositAmt ? Number(depositAmt) : null,
        payment_due_day: depositDate ? new Date(depositDate).getDate() : null,
        unit_number: unit?.unit_number ?? null,
        lease_type: leaseType || 'Fixed',
      }
      if (selectedExistingTenantIds.length) {
        body.contacts = selectedExistingTenantIds.map((id) => ({ tenant_id: id, role: 'Tenant', is_rent_responsible: true }))
      }
      const res = await fetch('/api/leases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const j = await res.json().catch(()=>({} as any))
        throw new Error(j?.error || 'Failed to create lease')
      }
      setOpen(false)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create lease')
    } finally {
      setSaving(false)
    }
  }

  // Search existing tenants/applicants by contact first/last/email
  useEffect(() => {
    if (!showAddTenant || !chooseExisting) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const supa = getSupabaseBrowserClient()
        let query = supa
          .from('tenants')
          .select('id, contact_id, contacts:contact_id ( first_name, last_name, primary_email )')
          .limit(10)
        const term = search.trim()
        if (term) {
          const like = `%${term}%`
          // Filter on related contacts table fields
          // @ts-ignore supabase-js supports foreignTable option
          query = query.or(`first_name.ilike.${like},last_name.ilike.${like},primary_email.ilike.${like}`, { foreignTable: 'contacts' })
        }
        const { data } = await query
        if (!cancelled) {
          const mapped = (data || []).map((r: any) => ({
            id: String(r.id),
            name: [r?.contacts?.first_name, r?.contacts?.last_name].filter(Boolean).join(' ') || 'Unnamed',
            email: r?.contacts?.primary_email || null,
          }))
          setResults(mapped)
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [showAddTenant, chooseExisting, search])

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-foreground">Lease Information</h3>
        {!open && <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Add</Button>}
      </div>

      {!open && (
        <Card>
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Start - End</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!leases || leases.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">You don't have any leases for this unit right now.</TableCell>
                </TableRow>
              ) : leases.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm text-foreground">{l.status || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground">{fmt(l.lease_from_date)} – {fmt(l.lease_to_date)}</TableCell>
                  <TableCell className="text-sm text-foreground">{l.tenant_name || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground">{fmtUsd(l.rent_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {open && (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Add Lease</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
          <CardContent className="space-y-8">
            {/* Lease details (Property, Unit, Type, Dates) */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Lease details</h3>
              {/* Row 1: Property + Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs mb-1">Property *</label>
                  <Dropdown
                    value={propertyId}
                    onChange={(v) => { setPropertyId(v); /* reset unit selection when property changes */ setUnitId('') }}
                    options={(properties.length ? properties : [{ id: property?.id, name: property?.name || 'Property' }]).map(p => ({ value: String(p.id), label: p.name }))}
                    placeholder="Select property"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs mb-1">Unit</label>
                  <Dropdown
                    value={unitId}
                    onChange={setUnitId}
                    options={(units.length ? units : [{ id: unit?.id, unit_number: unit?.unit_number }]).map((u:any)=>({ value: String(u.id), label: u.unit_number || 'Unit' }))}
                    placeholder="Select unit"
                  />
                </div>
              </div>
              {/* Row 2: Lease Type + Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs mb-1">Lease Type *</label>
                  <Dropdown
                    value={leaseType as any}
                    onChange={(v)=>setLeaseType(String(v))}
                    options={[
                      { value: 'Fixed', label: 'Fixed' },
                      { value: 'FixedWithRollover', label: 'Fixed w/rollover' },
                      { value: 'AtWill', label: 'At-will (month-to-month)' },
                    ]}
                    placeholder="Select"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs mb-1">Start date *</label>
                  <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs mb-1">End date</label>
                  <Input type="date" value={to} onChange={e=>setTo(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Approved Applicants, Tenants and cosigners */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Approved Applicants, Tenants and cosigners</h3>
              <button
                type="button"
                className="text-primary text-sm underline inline-flex items-center gap-2"
                onClick={() => setShowAddTenant(true)}
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                Add approved applicant, tenant or cosigner
              </button>
            </div>

            {/* Rent */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Rent</h3>
              <div className="sm:w-64">
                <label className="block text-xs mb-1">Monthly rent</label>
                <Input inputMode="decimal" placeholder="$0.00" value={rent} onChange={e=>setRent(e.target.value)} />
              </div>
            </div>

            {/* Security deposit */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Security deposit <span className="text-muted-foreground">(optional)</span></h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Due date</label>
                  <Input type="date" value={depositDate} onChange={e=>setDepositDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Amount</label>
                  <Input inputMode="decimal" placeholder="$0.00" value={depositAmt} onChange={e=>setDepositAmt(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Don't forget to record the payment once you have collected the deposit.</p>
            </div>

            {/* Charges placeholder */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Charges <span className="text-muted-foreground">(optional)</span></h3>
              <div className="flex items-center gap-4 text-primary text-sm">
                <button type="button" className="underline">+ Add recurring charge</button>
                <span className="text-muted-foreground">|</span>
                <button type="button" className="underline">+ Add one-time charge</button>
              </div>
            </div>

            {/* Upload files placeholder */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Upload files <span className="text-muted-foreground">(Maximum of 10)</span></h3>
              <div className="h-28 border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground">Drag & drop files here or <span className="text-primary underline ml-1">browse</span></div>
            </div>

            {/* Welcome email toggle placeholder */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">Resident Center Welcome Email <span className="align-middle ml-2 text-xs rounded bg-muted px-2 py-0.5">OFF</span></h3>
              <p className="text-sm text-muted-foreground">We'll send a welcome email to anyone without Resident Center access. Once they sign in, they can make online payments, view important documents, submit requests, and more!</p>
            </div>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </CardContent>
        </div>
      )}
      <Dialog open={showAddTenant} onOpenChange={setShowAddTenant}>
        <DialogContent className="w-[calc(100%-3rem)] sm:max-w-4xl md:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add applicant, tenant or cosigner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs defaultValue="tenant">
              <TabsList className="w-full">
                <TabsTrigger value="tenant" className="flex-1">Applicant/Tenant</TabsTrigger>
                <TabsTrigger value="cosigner" className="flex-1">Cosigner</TabsTrigger>
              </TabsList>
              <TabsContent value="tenant" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="existing" checked={chooseExisting} onCheckedChange={(v)=>setChooseExisting(Boolean(v))} />
                    <label htmlFor="existing" className="text-sm text-foreground">Choose existing tenant or applicant</label>
                  </div>
                  <div className="text-xs text-muted-foreground">{selectedExistingTenantIds.length} selected</div>
                </div>

                {chooseExisting && (
                  <div className="space-y-2">
                    <Input placeholder="Search by name or email…" value={search} onChange={(e)=>setSearch(e.target.value)} />
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!results.length && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-sm text-muted-foreground">{searching ? 'Searching…' : 'No results'}</TableCell>
                            </TableRow>
                          )}
                          {results.map((r) => {
                            const checked = selectedExistingTenantIds.includes(r.id)
                            return (
                              <TableRow key={r.id} className="cursor-pointer" onClick={() => {
                                setSelectedExistingTenantIds(prev => checked ? prev.filter(x => x !== r.id) : [...prev, r.id])
                              }}>
                                <TableCell onClick={(e)=>e.stopPropagation()}>
                                  <Checkbox checked={checked} onCheckedChange={(v)=>{
                                    setSelectedExistingTenantIds(prev => Boolean(v) ? Array.from(new Set([...prev, r.id])) : prev.filter(x => x !== r.id))
                                  }} />
                                </TableCell>
                                <TableCell className="text-sm text-primary underline">{r.name}</TableCell>
                                <TableCell className="text-sm">{r.email || '—'}</TableCell>
                                <TableCell className="text-sm">Tenant</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center gap-2 justify-start">
                      <Button size="sm" onClick={()=> setShowAddTenant(false)} disabled={!selectedExistingTenantIds.length}>Add tenant</Button>
                      <Button variant="outline" size="sm" onClick={()=> setShowAddTenant(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {!chooseExisting && (
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">Contact information</div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1">First name *</label>
                        <Input placeholder="First name" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Last name *</label>
                        <Input placeholder="Last name" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1">Mobile phone number</label>
                        <Input placeholder="(555) 555-5555" />
                      </div>
                      <div className="flex items-end">
                        {!showAltPhone ? (
                          <button type="button" onClick={()=>setShowAltPhone(true)} className="text-primary text-sm underline">+ Add alternate phone</button>
                        ) : (
                          <div className="w-full">
                            <label className="block text-xs mb-1">Alternate phone</label>
                            <div className="flex items-center gap-2">
                              <Input placeholder="(555) 555-1234" value={altPhone} onChange={(e)=>setAltPhone(e.target.value)} />
                              <button type="button" className="text-primary text-sm underline whitespace-nowrap" onClick={()=>{ setShowAltPhone(false); setAltPhone('') }}>× Remove</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1">Email</label>
                        <Input type="email" placeholder="name@email.com" />
                      </div>
                      <div className="flex items-end">
                        {!showAltEmail ? (
                          <button type="button" onClick={()=>setShowAltEmail(true)} className="text-primary text-sm underline">+ Add alternate email</button>
                        ) : (
                          <div className="w-full">
                            <label className="block text-xs mb-1">Alternate email</label>
                            <div className="flex items-center gap-2">
                              <Input type="email" placeholder="alt@email.com" value={altEmail} onChange={(e)=>setAltEmail(e.target.value)} />
                              <button type="button" className="text-primary text-sm underline whitespace-nowrap" onClick={()=>{ setShowAltEmail(false); setAltEmail('') }}>× Remove</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {!chooseExisting && (
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">Address *</div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="sameaddr" checked={sameAsUnitAddress} onCheckedChange={(v)=>setSameAsUnitAddress(Boolean(v))} />
                      <label htmlFor="sameaddr" className="text-sm">Same as unit address</label>
                    </div>
                    {!sameAsUnitAddress && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs mb-1">Street Address *</label>
                          <Input value={addr1} onChange={(e)=>setAddr1(e.target.value)} placeholder="e.g., 123 Main Street" />
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Address Line 2 (Optional)</label>
                          <Input value={addr2} onChange={(e)=>setAddr2(e.target.value)} placeholder="Apartment, suite, unit, building, floor, etc." />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1">City *</label>
                            <Input value={cityField} onChange={(e)=>setCityField(e.target.value)} placeholder="Enter city" />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">State *</label>
                            <Input value={stateField} onChange={(e)=>setStateField(e.target.value)} placeholder="Enter state" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1">ZIP Code *</label>
                            <Input value={postalField} onChange={(e)=>setPostalField(e.target.value)} placeholder="Enter ZIP code" />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">Country *</label>
                            <Dropdown value={countryField as any} onChange={setCountryField as any} options={[
                              { value: 'United States', label: 'United States' },
                              { value: 'Canada', label: 'Canada' },
                              { value: 'Mexico', label: 'Mexico' },
                            ]} placeholder="Select country" />
                          </div>
                        </div>
                      </div>
                    )}
                    {!showAltAddress && (
                      <button className="text-primary text-sm underline" type="button" onClick={()=>setShowAltAddress(true)}>+ Add alternate address</button>
                    )}

                    {showAltAddress && (
                      <div className="mt-3 border-t pt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-foreground">Alternate address</div>
                          <button
                            type="button"
                            className="text-primary text-sm underline inline-flex items-center gap-1"
                            onClick={() => { setShowAltAddress(false); setAltAddr1(''); setAltAddr2(''); setAltCity(''); setAltState(''); setAltPostal(''); setAltCountry(''); }}
                          >
                            <span className="text-muted-foreground">×</span>
                            Remove alternate address
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Street Address</label>
                          <Input value={altAddr1} onChange={(e)=>setAltAddr1(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Address Line 2 (Optional)</label>
                          <Input value={altAddr2} onChange={(e)=>setAltAddr2(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1">City</label>
                            <Input value={altCity} onChange={(e)=>setAltCity(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">State</label>
                            <Input value={altState} onChange={(e)=>setAltState(e.target.value)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1">ZIP Code</label>
                            <Input value={altPostal} onChange={(e)=>setAltPostal(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">Country</label>
                            <Dropdown value={altCountry as any} onChange={setAltCountry as any} options={[
                              { value: 'United States', label: 'United States' },
                              { value: 'Canada', label: 'Canada' },
                              { value: 'Mexico', label: 'Mexico' },
                            ]} placeholder="Select country" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Collapsible sections (default collapsed) */}
                {!chooseExisting && (
                <Accordion type="multiple" defaultValue={[]} className="space-y-2">
                  <AccordionItem value="personal">
                    <AccordionTrigger className="bg-muted px-4 rounded-md">Personal information</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-2 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1">Date of birth</label>
                            <Input type="date" />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">Taxpayer ID</label>
                            <Input placeholder="" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Comments</label>
                          <textarea className="w-full min-h-[96px] p-3 border border-border rounded-md bg-background text-sm text-foreground" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="emergency">
                    <AccordionTrigger className="bg-muted px-4 rounded-md">Emergency contact</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-2 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1">Contact name</label>
                            <Input />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">Relationship to tenant</label>
                            <Input />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs mb-1">Email</label>
                            <Input type="email" />
                          </div>
                          <div>
                            <label className="block text-xs mb-1">Phone</label>
                            <Input />
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                )}
                {!chooseExisting && (
                  <div className="flex items-center gap-2 justify-start">
                    <Button size="sm">Add tenant</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowAddTenant(false)}>Cancel</Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="cosigner" className="space-y-4">
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">Contact information</div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1">First name *</label>
                        <Input placeholder="First name" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Last name *</label>
                        <Input placeholder="Last name" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Email</label>
                      <Input type="email" placeholder="name@email.com" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm">Add cosigner</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddTenant(false)}>Cancel</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

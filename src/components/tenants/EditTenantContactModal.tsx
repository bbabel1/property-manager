"use client"

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const COUNTRIES = [
  'United States',
  'Canada',
  'Mexico',
  'United Kingdom',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Australia',
  'Japan',
  'China',
  'India',
  'Brazil'
]

type ContactValues = {
  first_name?: string | null
  last_name?: string | null
  is_company?: boolean | null
  company_name?: string | null
  primary_email?: string | null
  alt_email?: string | null
  primary_phone?: string | null
  alt_phone?: string | null
  date_of_birth?: string | null
  primary_address_line_1?: string | null
  primary_address_line_2?: string | null
  primary_city?: string | null
  primary_state?: string | null
  primary_postal_code?: string | null
  primary_country?: string | null
}

export default function EditTenantContactModal({
  open,
  onOpenChange,
  contactId,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contactId: number
  initial: ContactValues
  onSaved?: () => void
}) {
  const [values, setValues] = useState<ContactValues>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAltPhone, setShowAltPhone] = useState(false)
  const [showCompanyName, setShowCompanyName] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(initial)
      setShowAltPhone(Boolean(initial.alt_phone))
      setShowCompanyName(Boolean(initial.is_company))
    }
  }, [open, initial])

  const supa = getSupabaseBrowserClient()

  const handleSave = async () => {
    try {
      setSaving(true); setError(null)
      const update: any = {
        first_name: values.first_name ?? null,
        last_name: values.last_name ?? null,
        is_company: Boolean(values.is_company ?? false),
        company_name: values.company_name ?? null,
        primary_email: values.primary_email ?? null,
        alt_email: values.alt_email ?? null,
        primary_phone: values.primary_phone ?? null,
        alt_phone: values.alt_phone ?? null,
        date_of_birth: values.date_of_birth ?? null,
        primary_address_line_1: values.primary_address_line_1 ?? null,
        primary_address_line_2: values.primary_address_line_2 ?? null,
        primary_city: values.primary_city ?? null,
        primary_state: values.primary_state ?? null,
        primary_postal_code: values.primary_postal_code ?? null,
        primary_country: values.primary_country ?? 'United States',
        updated_at: new Date().toISOString(),
      }
      const { error } = await supa.from('contacts').update(update).eq('id', contactId)
      if (error) throw new Error(error.message)
      onOpenChange(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-l-4 border-l-primary">
        <DialogHeader>
          <DialogTitle>Edit contact information</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b pb-2">Personal Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-1">First name</div>
                <Input value={values.first_name ?? ''} onChange={(e)=>setValues(v=>({ ...v, first_name: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs mb-1">Last name</div>
                <Input value={values.last_name ?? ''} onChange={(e)=>setValues(v=>({ ...v, last_name: e.target.value }))} />
              </div>
            </div>
            
            <label className="flex items-center gap-2 text-sm">
              <Checkbox 
                checked={Boolean(values.is_company)} 
                onCheckedChange={(v) => {
                  const isCompany = Boolean(v)
                  setValues(val => ({ ...val, is_company: isCompany }))
                  setShowCompanyName(isCompany)
                }} 
              />
              Is company
            </label>
            
            {showCompanyName && (
              <div>
                <div className="text-xs mb-1">Company name</div>
                <Input value={values.company_name ?? ''} onChange={(e)=>setValues(v=>({ ...v, company_name: e.target.value }))} />
              </div>
            )}
            
            <div>
              <div className="text-xs mb-1">Date of Birth</div>
              <DatePicker
                value={values.date_of_birth ? new Date(values.date_of_birth) : undefined}
                onChange={(date) => setValues(v => ({ ...v, date_of_birth: date ? date.toISOString().split('T')[0] : null }))}
                placeholder="Select date of birth"
              />
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-foreground">Email Addresses</h4>
              <div>
                <div className="text-xs mb-1">Primary Email</div>
                <Input type="email" value={values.primary_email ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_email: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs mb-1">Alternative Email</div>
                <Input type="email" value={values.alt_email ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_email: e.target.value }))} />
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-foreground">Phone Numbers</h4>
              <div>
                <div className="text-xs mb-1">Primary Phone</div>
                <Input value={values.primary_phone ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_phone: e.target.value }))} />
              </div>
              <div>
                {showAltPhone ? (
                  <div>
                    <div className="text-xs mb-1">Alternative Phone</div>
                    <Input value={values.alt_phone ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_phone: e.target.value }))} />
                  </div>
                ) : (
                  <div>
                    <div className="text-xs mb-1">Alternative Phone</div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => setShowAltPhone(true)}
                    >
                      + Add alternate phone
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Address Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b pb-2">Address Information</h3>
            
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-foreground">Street Address</h4>
              <div>
                <div className="text-xs mb-1">Address line 1</div>
                <Input value={values.primary_address_line_1 ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_address_line_1: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs mb-1">Address line 2</div>
                <Input value={values.primary_address_line_2 ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_address_line_2: e.target.value }))} />
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-foreground">City, State & ZIP</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs mb-1">City</div>
                  <Input value={values.primary_city ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_city: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs mb-1">State</div>
                  <Input value={values.primary_state ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_state: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs mb-1">Postal code</div>
                  <Input value={values.primary_postal_code ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_postal_code: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs mb-1">Country</div>
                  <select
                    value={values.primary_country ?? 'United States'}
                    onChange={(e) => setValues(v => ({ ...v, primary_country: e.target.value }))}
                    className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground"
                    aria-label="Primary address country"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


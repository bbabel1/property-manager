"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { X, Mail, MapPin, Smartphone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import EditLink from '@/components/ui/EditLink'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Body, Heading, Label } from '@/ui/typography'

type ContactValues = {
  first_name?: string | null
  last_name?: string | null
  primary_email?: string | null
  primary_phone?: string | null
  alt_phone?: string | null
  alt_email?: string | null
  primary_address_line_1?: string | null
  primary_address_line_2?: string | null
  primary_city?: string | null
  primary_state?: string | null
  primary_postal_code?: string | null
  primary_country?: string | null
  alt_address_line_1?: string | null
  alt_address_line_2?: string | null
  alt_city?: string | null
  alt_state?: string | null
  alt_postal_code?: string | null
  alt_country?: string | null
}

export default function TenantContactInlineEditor({ contactId, initial }: { contactId: number; initial: ContactValues }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<ContactValues>(initial || {})
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supa = getSupabaseBrowserClient()
  const [showAltAddress, setShowAltAddress] = useState<boolean>(Boolean(
    initial?.alt_address_line_1 || initial?.alt_address_line_2 ||
    initial?.alt_city || initial?.alt_state || initial?.alt_postal_code || initial?.alt_country
  ))
  const [showAltEmail, setShowAltEmail] = useState<boolean>(Boolean(initial?.alt_email))
  const [showAltPhone, setShowAltPhone] = useState<boolean>(Boolean(initial?.alt_phone))

  const handleSave = async () => {
    try {
      setSaving(true); setError(null)
      const update: Record<string, string | null> = {
        first_name: values.first_name ?? null,
        last_name: values.last_name ?? null,
        primary_email: values.primary_email ?? null,
        primary_phone: values.primary_phone ?? null,
        alt_phone: values.alt_phone ?? null,
        alt_email: values.alt_email ?? null,
        primary_address_line_1: values.primary_address_line_1 ?? null,
        primary_address_line_2: values.primary_address_line_2 ?? null,
        primary_city: values.primary_city ?? null,
        primary_state: values.primary_state ?? null,
        primary_postal_code: values.primary_postal_code ?? null,
        primary_country: values.primary_country ?? null,
        alt_address_line_1: values.alt_address_line_1 ?? null,
        alt_address_line_2: values.alt_address_line_2 ?? null,
        alt_city: values.alt_city ?? null,
        alt_state: values.alt_state ?? null,
        alt_postal_code: values.alt_postal_code ?? null,
        alt_country: values.alt_country ?? null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supa.from('contacts').update(update).eq('id', contactId)
      if (error) throw new Error(error.message)
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <Heading as="h2" size="h3">
          Contact information
        </Heading>
        {!editing ? <EditLink onClick={() => setEditing(true)} /> : null}
      </div>
      <Card className={editing ? 'relative overflow-hidden border-l-2 border-l-primary shadow-lg bg-white border border-border' : 'bg-white'}>
        <CardContent className="relative p-6">
          {editing && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
          {!editing ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-sm">
              <div>
                <Label tone="muted" size="xs" className="mb-1 block">
                  EMAIL
                </Label>
                <Body size="sm">{values.primary_email || '—'}</Body>
              </div>
              <div>
                <Label tone="muted" size="xs" className="mb-1 block">
                  PHONE
                </Label>
                <Body size="sm">{values.primary_phone || values.alt_phone || '—'}</Body>
              </div>
              <div>
                <Label tone="muted" size="xs" className="mb-1 block">
                  ADDRESS
                </Label>
                <Body size="sm" className="space-y-0.5">
                  <div>{values.primary_address_line_1 || '—'}</div>
                  {values.primary_address_line_2 ? <div>{values.primary_address_line_2}</div> : null}
                  <div>
                    {[
                      values.primary_city || '',
                      values.primary_state || '',
                      values.primary_postal_code || ''
                    ]
                      .filter(Boolean)
                      .map((part, index, arr) =>
                        index === arr.length - 1 || !part ? part : `${part}, `
                      )
                      .join('') || '—'}
                  </div>
                </Body>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                aria-label="Close"
                onClick={() => { setEditing(false); setValues(initial || {}) }}
                className="absolute right-6 top-6 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Personal Information */}
                <div className="space-y-3">
                  {/* Name Fields */}
                  <div>
                    <Label tone="muted" size="xs" className="mb-1 block uppercase">
                      FIRST NAME
                    </Label>
                    <Input value={values.first_name ?? ''} onChange={(e)=>setValues(v=>({ ...v, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label tone="muted" size="xs" className="mb-1 block uppercase">
                      LAST NAME
                    </Label>
                    <Input value={values.last_name ?? ''} onChange={(e)=>setValues(v=>({ ...v, last_name: e.target.value }))} />
                  </div>


                  {/* Email Addresses */}
                  <div className="space-y-2">
                    <Label tone="muted" size="xs" className="uppercase">
                      PRIMARY EMAIL
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" type="email" value={values.primary_email ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_email: e.target.value }))} />
                    </div>
                    {!showAltEmail ? (
                      <button type="button" className="text-primary text-sm hover:underline" onClick={()=>setShowAltEmail(true)}>
                        + Add alternate email
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label size="xs" className="mb-1">
                            Alternate email
                          </Label>
                          <button type="button" className="text-primary text-sm hover:underline" onClick={()=>{
                            setShowAltEmail(false)
                            setValues(v=>({ ...v, alt_email: '' }))
                          }}>
                            X Remove alternate email
                          </button>
                        </div>
                        <Input type="email" value={values.alt_email ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_email: e.target.value }))} />
                      </div>
                    )}
                  </div>

                  {/* Phone Numbers */}
                  <div className="space-y-2">
                    <Label tone="muted" size="xs" className="uppercase">
                      PHONE
                    </Label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={values.primary_phone ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_phone: e.target.value }))} />
                    </div>
                    {!showAltPhone ? (
                      <button type="button" className="text-primary text-sm hover:underline" onClick={()=>setShowAltPhone(true)}>
                        + Add alternate phone
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label size="xs" className="mb-1">
                            Alternate phone
                          </Label>
                          <button type="button" className="text-primary text-sm hover:underline" onClick={()=>{
                            setShowAltPhone(false)
                            setValues(v=>({ ...v, alt_phone: '' }))
                          }}>
                            X Remove alternate phone
                          </button>
                        </div>
                        <Input value={values.alt_phone ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_phone: e.target.value }))} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Address Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase">ADDRESS</h4>
                  <div>
                    <div className="text-xs mb-1 font-medium tracking-wide text-muted-foreground uppercase">STREET ADDRESS</div>
                    <Input value={values.primary_address_line_1 ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_address_line_1: e.target.value }))} />
                  </div>
                  <div>
                    <Input placeholder="Address line 2" value={values.primary_address_line_2 ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_address_line_2: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs mb-1">City</div>
                      <Input value={values.primary_city ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_city: e.target.value }))} />
                    </div>
                    <div>
                      <div className="text-xs mb-1">State</div>
                      <Input value={values.primary_state ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_state: e.target.value }))} />
                    </div>
                    <div>
                      <div className="text-xs mb-1">ZIP</div>
                      <Input value={values.primary_postal_code ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_postal_code: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mb-1">Country</div>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="United States" value={values.primary_country ?? ''} onChange={(e)=>setValues(v=>({ ...v, primary_country: e.target.value }))} />
                    </div>
                  </div>
                  {!showAltAddress ? (
                    <button
                      type="button"
                      className="block text-primary text-sm hover:underline"
                      onClick={() => setShowAltAddress(true)}
                    >
                      + Add alternate address
                    </button>
                  ) : null}
                  {showAltAddress ? (
                    <div className="relative rounded-md border border-border/60 bg-muted/30 p-3 pt-8 space-y-2">
                      <div className="absolute right-3 top-3 flex items-center gap-2 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">Alternate address</span>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => {
                            setShowAltAddress(false)
                            setValues(v => ({
                              ...v,
                              alt_address_line_1: '',
                              alt_address_line_2: '',
                              alt_city: '',
                              alt_state: '',
                              alt_postal_code: '',
                              alt_country: ''
                            }))
                          }}
                        >
                          X
                        </button>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">Alternate address</div>
                      <div>
                        <div className="text-xs mb-1">Street address</div>
                        <Input value={values.alt_address_line_1 ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_address_line_1: e.target.value }))} />
                      </div>
                      <div>
                        <div className="text-xs mb-1">Address line 2</div>
                        <Input value={values.alt_address_line_2 ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_address_line_2: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs mb-1">City</div>
                          <Input value={values.alt_city ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_city: e.target.value }))} />
                        </div>
                        <div>
                          <div className="text-xs mb-1">State</div>
                          <Input value={values.alt_state ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_state: e.target.value }))} />
                        </div>
                        <div>
                          <div className="text-xs mb-1">ZIP</div>
                          <Input value={values.alt_postal_code ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_postal_code: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-1">Country</div>
                        <Input value={values.alt_country ?? ''} onChange={(e)=>setValues(v=>({ ...v, alt_country: e.target.value }))} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {error ? <div className="text-sm text-destructive">{error}</div> : null}
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                <Button variant="cancel" onClick={() => { setEditing(false); setValues(initial || {}) }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

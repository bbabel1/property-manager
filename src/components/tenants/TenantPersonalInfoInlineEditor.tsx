"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import EditLink from '@/components/ui/EditLink'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { Body, Heading, Label } from '@/ui/typography'

interface PersonalInfoValues {
  date_of_birth?: string | null
  tax_id?: string | null
  comment?: string | null
}

interface TenantPersonalInfoInlineEditorProps {
  tenantId: string
  contactId: number
  initial: PersonalInfoValues
}

const formatDate = (value?: string | null): string => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

export default function TenantPersonalInfoInlineEditor({
  tenantId,
  contactId,
  initial
}: TenantPersonalInfoInlineEditorProps) {
  const router = useRouter()
  const supa = getSupabaseBrowserClient()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<PersonalInfoValues>(initial)

  const handleCancel = () => {
    setEditing(false)
    setValues(initial)
    setError(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      const now = new Date().toISOString()

      const { error: contactError } = await supa
        .from('contacts')
        .update({ date_of_birth: values.date_of_birth ?? null, updated_at: now })
        .eq('id', contactId)

      if (contactError) throw new Error(contactError.message)

      const tenantResponse = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tax_id: values.tax_id ?? null, comment: values.comment ?? null })
      })

      const tenantJson = (await tenantResponse.json().catch(() => ({}))) as {
        error?: string;
        buildium_sync_error?: string;
      }
      if (!tenantResponse.ok) {
        const errorMessage = tenantJson?.error || 'Failed to save personal information'
        throw new Error(errorMessage)
      }
      if (tenantJson?.buildium_sync_error) {
        throw new Error(`Saved, but failed to sync to Buildium: ${tenantJson.buildium_sync_error}`)
      }

      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save personal information')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <Heading as="h2" size="h3">
          Personal information
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
                  DATE OF BIRTH
                </Label>
                <Body size="sm">{formatDate(values.date_of_birth)}</Body>
              </div>
              <div>
                <Label tone="muted" size="xs" className="mb-1 block">
                  TAXPAYER ID
                </Label>
                <Body size="sm">{values.tax_id || '—'}</Body>
              </div>
              <div>
                <Label tone="muted" size="xs" className="mb-1 block">
                  COMMENTS
                </Label>
                <Body size="sm" className="whitespace-pre-wrap">
                  {values.comment?.trim() || '—'}
                </Body>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                aria-label="Close"
                onClick={handleCancel}
                className="absolute right-6 top-6 p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2">
                <div>
                  <Label size="xs" className="mb-1 block">
                    Date of birth
                  </Label>
                  <DatePicker
                    value={values.date_of_birth ?? null}
                    onChange={(date) => {
                      const iso = date ? new Date(date as Date | string).toISOString() : null
                      setValues((prev) => ({
                        ...prev,
                        date_of_birth: iso,
                      }))
                    }}
                    placeholder="Select date"
                  />
                </div>
                <div>
                  <Label size="xs" className="mb-1 block">
                    Taxpayer ID
                  </Label>
                  <Input
                    value={values.tax_id ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, tax_id: e.target.value }))}
                    placeholder="Enter taxpayer ID"
                  />
                </div>
              </div>
              <div>
                <Label size="xs" className="mb-1 block">
                  Comments
                </Label>
                <Textarea
                  rows={4}
                  value={values.comment ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder="Add notes about this tenant"
                />
              </div>
              {error ? (
                <Body size="sm" className="text-destructive">
                  {error}
                </Body>
              ) : null}
              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="cancel" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

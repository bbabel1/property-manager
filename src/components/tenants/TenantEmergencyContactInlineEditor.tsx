"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import EditLink from '@/components/ui/EditLink'
import { X } from 'lucide-react'

interface EmergencyContactValues {
  emergency_contact_name?: string | null
  emergency_contact_email?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relationship?: string | null
}

interface TenantEmergencyContactInlineEditorProps {
  tenantId: string
  initial: EmergencyContactValues
}

export default function TenantEmergencyContactInlineEditor({ tenantId, initial }: TenantEmergencyContactInlineEditorProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<EmergencyContactValues>(initial)

  const handleCancel = () => {
    setEditing(false)
    setValues(initial)
    setError(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergency_contact_name: values.emergency_contact_name ?? null,
          emergency_contact_email: values.emergency_contact_email ?? null,
          emergency_contact_phone: values.emergency_contact_phone ?? null,
          emergency_contact_relationship: values.emergency_contact_relationship ?? null
        })
      })

      const data = (await response.json().catch(() => ({}))) as { error?: string; buildium_sync_error?: string }
      if (!response.ok) {
        const message = data?.error || 'Failed to save emergency contact'
        throw new Error(message)
      }
      if (data?.buildium_sync_error) {
        throw new Error(`Saved, but failed to sync to Buildium: ${data.buildium_sync_error}`)
      }

      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save emergency contact')
    } finally {
      setSaving(false)
    }
  }

  const safe = (value?: string | null) => value?.trim() || '—'

  return (
    <div className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <h2 className="text-lg font-semibold text-foreground">Emergency contact</h2>
        {!editing ? <EditLink onClick={() => setEditing(true)} /> : null}
      </div>
      <Card className={editing ? 'relative overflow-hidden border-l-2 border-l-primary shadow-lg bg-white border border-border' : 'bg-white'}>
        <CardContent className="relative p-6">
          {editing && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
          {!editing ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">NAME</div>
                <div className="text-foreground">{safe(values.emergency_contact_name)}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">EMAIL</div>
                <div className="text-foreground">{safe(values.emergency_contact_email)}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">PHONE</div>
                <div className="text-foreground">{safe(values.emergency_contact_phone)}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">RELATIONSHIP</div>
                <div className="text-foreground">{safe(values.emergency_contact_relationship)}</div>
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
                  <div className="text-xs mb-1">Name</div>
                  <Input
                    value={values.emergency_contact_name ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <div className="text-xs mb-1">Email</div>
                  <Input
                    type="email"
                    value={values.emergency_contact_email ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, emergency_contact_email: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                </div>
                <div>
                  <div className="text-xs mb-1">Phone</div>
                  <Input
                    value={values.emergency_contact_phone ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    placeholder="(555) 555-1234"
                  />
                </div>
                <div>
                  <div className="text-xs mb-1">Relationship</div>
                  <Input
                    value={values.emergency_contact_relationship ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, emergency_contact_relationship: e.target.value }))}
                    placeholder="e.g. Parent, Partner"
                  />
                </div>
              </div>
              {error ? <div className="text-sm text-destructive">{error}</div> : null}
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

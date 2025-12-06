"use client"
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dropdown } from '@/components/ui/Dropdown'
import { normalizeStaffRole } from '@/lib/staff-role'
import { getAvailableUIStaffRoles } from '@/lib/enums/staff-roles'

const ROLE_OPTIONS = getAvailableUIStaffRoles().map((value) => ({ value, label: value }))

export default function StaffWizardModal({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o:boolean)=>void; onSaved: ()=>void }) {
  const [step, setStep] = useState(1)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [staffRole, setStaffRole] = useState('Property Manager')
  const [sendInvite, setSendInvite] = useState(true)
  const [orgId, setOrgId] = useState<string>('')
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set())
  const [syncToBuildium, setSyncToBuildium] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(1); setErr(null)
    // Load orgs and properties
    const load = async () => {
      try {
        const [o, p] = await Promise.all([
          fetch('/api/admin/orgs').then(r=>r.json()).catch(()=>({ organizations: [] })),
          fetch('/api/properties').then(r=>r.json()).catch(()=>[]),
        ])
        setOrgs(o.organizations || [])
        setProperties(Array.isArray(p) ? p.map((x:any)=>({ id: x.id, name: x.name })) : (p?.items || []))
      } catch {}
    }
    load()
  }, [open])

  const toggleProperty = (id: string) => {
    setSelectedProperties(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const submit = async () => {
    try {
      setBusy(true); setErr(null)
      const normalizedRole = normalizeStaffRole(staffRole)
      if (!normalizedRole) {
        throw new Error('Invalid role selected')
      }
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone, title, role: normalizedRole, isActive: true, orgId: orgId || undefined, sendInvite })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create staff')
      const staffId = data?.staff?.id
      if (staffId && selectedProperties.size) {
        await fetch('/api/property-staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignments: Array.from(selectedProperties).map(pid => ({ property_id: pid, staff_id: staffId, role: 'Property Manager' })) }) })
      }
      if (staffId && syncToBuildium) {
        await fetch('/api/buildium/staff/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: staffId }) })
      }
      onSaved(); onOpenChange(false)
    } catch (e:any) {
      setErr(e.message || 'Failed to create staff')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Personal Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">First Name</label>
                  <Input value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Last Name</label>
                  <Input value={lastName} onChange={(e)=>setLastName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Email</label>
                  <Input value={email} onChange={(e)=>setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Phone</label>
                  <Input value={phone} onChange={(e)=>setPhone(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Title</label>
                  <Input value={title} onChange={(e)=>setTitle(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Organization & Roles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Organization</label>
                  <Dropdown value={orgId} onChange={setOrgId} options={orgs.map(o=>({ value:o.id, label:o.name }))} placeholder="Default (current org)" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Staff Role</label>
                  <Dropdown value={staffRole} onChange={setStaffRole} options={ROLE_OPTIONS} />
                </div>
                <label className="text-sm flex items-center gap-2 md:col-span-2">
                  <input type="checkbox" checked={sendInvite} onChange={(e)=>setSendInvite(e.target.checked)} /> Send invite email
                </label>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Property Assignments</h4>
              <div className="max-h-56 overflow-auto border rounded-md p-2 bg-background">
                {properties.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No properties.</div>
                ) : properties.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm py-1">
                    <input type="checkbox" checked={selectedProperties.has(p.id)} onChange={()=>toggleProperty(p.id)} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Assignments will be saved as Property Manager for selected properties.</p>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Sync</h4>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={syncToBuildium} onChange={(e)=>setSyncToBuildium(e.target.checked)} /> Sync staff to Buildium after saving
              </label>
            </div>
          )}
          {err && <div className="text-sm text-destructive">{err}</div>}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">Step {step} of 4</div>
            <div className="flex items-center gap-2">
              {step > 1 && <Button variant="outline" onClick={()=>setStep(step-1)}>Back</Button>}
              {step < 4 && <Button onClick={()=>setStep(step+1)}>Next</Button>}
              {step === 4 && <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Finish'}</Button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

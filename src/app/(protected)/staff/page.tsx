"use client"
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/Dropdown'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Staff = { id: number; role: string; is_active: boolean }

const ROLE_OPTIONS = [
  { value: 'PROPERTY_MANAGER', label: 'Property Manager' },
  { value: 'ASSISTANT_PROPERTY_MANAGER', label: 'Assistant Property Manager' },
  { value: 'MAINTENANCE_COORDINATOR', label: 'Maintenance Coordinator' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'ADMINISTRATOR', label: 'Administrator' },
]

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newRole, setNewRole] = useState('PROPERTY_MANAGER')
  const [creating, setCreating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/staff', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load staff')
      setStaff(data || [])
    } catch (e:any) {
      setError(e.message || 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const addStaff = async () => {
    try {
      setCreating(true)
      setError(null)
      // Create contact (optional)
      if (firstName || lastName || email || phone) {
        await fetch('/api/admin/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ first_name: firstName, last_name: lastName, email, phone })
        })
      }
      // Create staff
      const res = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole, isActive: true }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create staff')
      await load()
      setShowModal(false)
      setFirstName(''); setLastName(''); setEmail(''); setPhone('')
    } catch (e:any) {
      setError(e.message || 'Failed to create staff')
    } finally {
      setCreating(false)
    }
  }

  const updateRole = async (id: number, role: string) => {
    await fetch('/api/staff', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) })
    await load()
  }

  const toggleActive = async (id: number, active: boolean) => {
    await fetch('/api/staff', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: active }) })
    await load()
  }

  const remove = async (id: number) => {
    await fetch(`/api/staff?id=${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Staff</h1>
      <Card>
        <CardHeader>
          <CardTitle>Add Staff Member</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="w-64">
            <Dropdown value={newRole} onChange={setNewRole} options={ROLE_OPTIONS} placeholder="Select role" />
          </div>
          <Button onClick={()=> setShowModal(true)} disabled={creating}>Add</Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-2">
              {staff.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-56">
                      <Dropdown value={s.role} onChange={(v)=>updateRole(s.id, v)} options={ROLE_OPTIONS} />
                    </div>
                    <label className="text-sm flex items-center gap-2">
                      <input type="checkbox" checked={s.is_active} onChange={(e)=>toggleActive(s.id, e.target.checked)} /> Active
                    </label>
                  </div>
                  <Button variant="outline" onClick={()=>remove(s.id)}>Remove</Button>
                </div>
              ))}
              {staff.length === 0 && <div className="text-sm text-muted-foreground">No staff yet.</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Role</label>
              <Dropdown value={newRole} onChange={setNewRole} options={ROLE_OPTIONS} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">First Name</label>
                <Input value={firstName} onChange={(e)=> setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div>
                <label className="block text-sm mb-1">Last Name</label>
                <Input value={lastName} onChange={(e)=> setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <Input value={email} onChange={(e)=> setEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <Input value={phone} onChange={(e)=> setPhone(e.target.value)} placeholder="(555) 555-5555" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={addStaff} disabled={creating}>{creating ? 'Saving…' : 'Save'}</Button>
              <Button variant="outline" onClick={()=> setShowModal(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

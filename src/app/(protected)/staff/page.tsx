"use client"
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/Dropdown'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import StaffWizardModal from './StaffWizardModal'
import { Guard } from '@/components/Guard'

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
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterActive, setFilterActive] = useState<boolean>(true)
  const [filterSynced, setFilterSynced] = useState<boolean>(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (filterRole) params.set('role', filterRole)
      if (typeof filterActive === 'boolean') params.set('isActive', String(filterActive))
      const res = await fetch(`/api/staff?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load staff')
      let list = (data || []) as any[]
      if (filterSynced) list = list.filter(s => s.buildium_staff_id != null)
      setStaff(list as any)
    } catch (e:any) {
      setError(e.message || 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterRole, filterActive, filterSynced])

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

  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const syncToBuildium = async (id: number) => {
    try {
      setSyncingId(id)
      setSyncError(null)
      const res = await fetch('/api/buildium/staff/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: id }) })
      const data = await res.json().catch(()=>null)
      if (!res.ok) throw new Error(data?.error || 'Sync failed')
      await load()
    } catch (e:any) {
      setSyncError(e.message || 'Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const [syncAllBusy, setSyncAllBusy] = useState(false)
  const syncAll = async () => {
    try {
      setSyncAllBusy(true)
      await fetch('/api/buildium/staff/sync-all', { method: 'POST' })
      await load()
    } finally { setSyncAllBusy(false) }
  }

  // Last sync status
  const [lastSync, setLastSync] = useState<string | null>(null)
  const loadLast = async () => {
    try {
      const res = await fetch('/api/buildium/staff/sync-all', { method: 'GET', cache: 'no-store' })
      const j = await res.json()
      const ts = j?.last?.finished_at || j?.last?.started_at
      setLastSync(ts ? new Date(ts).toLocaleString() : null)
    } catch { setLastSync(null) }
  }
  useEffect(()=>{ loadLast() }, [])

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
          <div className="flex items-center justify-between">
            <CardTitle>Team</CardTitle>
            <Guard require={'org_manager'}>
              <Button size="sm" variant="outline" onClick={syncAll} disabled={syncAllBusy}>{syncAllBusy ? 'Syncing…' : 'Sync All'}</Button>
            </Guard>
          </div>
          {lastSync && (<div className="text-xs text-muted-foreground mt-1">Last staff sync: {lastSync}</div>)}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-48">
              <Dropdown value={filterRole} onChange={setFilterRole} options={ROLE_OPTIONS} placeholder="All Roles" />
            </div>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={filterActive} onChange={(e)=> setFilterActive(e.target.checked)} /> Active
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={filterSynced} onChange={(e)=> setFilterSynced(e.target.checked)} /> Synced to Buildium
            </label>
          </div>
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
                    { (s as any).buildium_staff_id != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Synced</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Guard require={'org_manager'}>
                      <Button variant="outline" onClick={()=>syncToBuildium(s.id)} disabled={syncingId === s.id}>
                        {syncingId === s.id ? 'Syncing…' : 'Sync to Buildium'}
                      </Button>
                    </Guard>
                    <Button variant="outline" onClick={()=>remove(s.id)}>Remove</Button>
                  </div>
                </div>
              ))}
              {staff.length === 0 && <div className="text-sm text-muted-foreground">No staff yet.</div>}
            </div>
          )}
        </CardContent>
      </Card>
      {syncError && <div className="text-sm text-destructive">{syncError}</div>}

      {/* Staff Wizard */}
      <StaffWizardModal open={showModal} onOpenChange={setShowModal} onSaved={load} />
    </div>
  )
}

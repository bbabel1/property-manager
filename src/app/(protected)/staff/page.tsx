"use client"
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/Dropdown'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import StaffWizardModal from './StaffWizardModal'
import { Guard } from '@/components/Guard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Staff = {
  id: number
  role: string
  is_active: boolean
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  buildium_staff_id?: number | null
}

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

  const [showModal, setShowModal] = useState(false)
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterActive, setFilterActive] = useState<boolean>(true)
  const [filterSynced, setFilterSynced] = useState<boolean>(false)

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
  const [editing, setEditing] = useState<Staff | null>(null)
  const openEdit = (s: Staff) => setEditing(s)
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
          <div className="flex items-center justify-between">
            <CardTitle>Team</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={()=> setShowModal(true)}>Add Staff</Button>
              <Guard require={'org_manager'}>
                <Button size="sm" variant="outline" onClick={syncAll} disabled={syncAllBusy}>{syncAllBusy ? 'Syncing…' : 'Sync All'}</Button>
              </Guard>
            </div>
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
            <Table className="min-w-full divide-y divide-border">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card divide-y divide-border">
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="truncate">{s.first_name || '-'}</TableCell>
                    <TableCell className="truncate">{s.last_name || '-'}</TableCell>
                    <TableCell className="truncate">{s.title || '-'}</TableCell>
                    <TableCell className="truncate">{s.email || '-'}</TableCell>
                    <TableCell className="truncate">{s.phone || '-'}</TableCell>
                    <TableCell>{ROLE_OPTIONS.find(r=>r.value===s.role)?.label || s.role}</TableCell>
                    <TableCell>{s.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(s.buildium_staff_id != null) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Synced</span>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                        <Guard require={'org_manager'}>
                          <Button variant="outline" size="sm" onClick={()=>syncToBuildium(s.id)} disabled={syncingId === s.id}>
                            {syncingId === s.id ? 'Syncing…' : 'Sync'}
                          </Button>
                        </Guard>
                        <Button variant="outline" size="sm" onClick={()=>remove(s.id)}>Remove</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">No staff yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {syncError && <div className="text-sm text-destructive">{syncError}</div>}

      {/* Staff Wizard */}
      <StaffWizardModal open={showModal} onOpenChange={setShowModal} onSaved={load} />
      {/* Edit Staff Modal */}
      <EditStaffModal staff={editing} onClose={()=>setEditing(null)} onSaved={load} />
    </div>
  )
}

function EditStaffModal({ staff, onClose, onSaved }:{ staff: Staff | null, onClose: ()=>void, onSaved: ()=>void }){
  const [firstName, setFirst] = useState(staff?.first_name || '')
  const [lastName, setLast] = useState(staff?.last_name || '')
  const [email, setEmail] = useState(staff?.email || '')
  const [phone, setPhone] = useState(staff?.phone || '')
  const [title, setTitle] = useState(staff?.title || '')
  const [role, setRole] = useState(staff?.role || 'PROPERTY_MANAGER')
  const [active, setActive] = useState(!!staff?.is_active)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(()=>{
    setFirst(staff?.first_name || ''); setLast(staff?.last_name || ''); setEmail(staff?.email || ''); setPhone(staff?.phone || ''); setTitle(staff?.title || ''); setRole(staff?.role || 'PROPERTY_MANAGER'); setActive(!!staff?.is_active); setErr(null)
  }, [staff])
  const open = !!staff
  const save = async () => {
    if (!staff) return
    try {
      setBusy(true); setErr(null)
      const res = await fetch('/api/staff', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: staff.id, firstName, lastName, email, phone, title, role, isActive: active }) })
      const j = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(j?.error || 'Save failed')
      onSaved(); onClose()
    } catch (e:any) { setErr(e.message || 'Save failed') } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={(o)=>{ if(!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit Staff</DialogTitle></DialogHeader>
        {staff && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="block text-sm mb-1">First Name</label><Input value={firstName} onChange={(e)=>setFirst(e.target.value)} /></div>
              <div><label className="block text-sm mb-1">Last Name</label><Input value={lastName} onChange={(e)=>setLast(e.target.value)} /></div>
              <div><label className="block text-sm mb-1">Email</label><Input value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
              <div><label className="block text-sm mb-1">Phone</label><Input value={phone} onChange={(e)=>setPhone(e.target.value)} /></div>
              <div className="md:col-span-2"><label className="block text-sm mb-1">Title</label><Input value={title} onChange={(e)=>setTitle(e.target.value)} /></div>
              <div className="md:col-span-1"><label className="block text-sm mb-1">Role</label><Dropdown value={role} onChange={setRole} options={ROLE_OPTIONS} /></div>
              <label className="text-sm flex items-center gap-2 md:col-span-1 self-end">
                <input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} /> Active
              </label>
            </div>
            {err && <div className="text-sm text-destructive">{err}</div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

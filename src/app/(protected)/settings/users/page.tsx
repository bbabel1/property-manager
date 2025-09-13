"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Org = { id: string; name: string }
type Membership = { org_id: string; org_name?: string; role: string }
type UserRow = { id: string; email: string; created_at?: string; last_sign_in_at?: string; memberships: Membership[] }

export default function UsersRolesPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Assign form state
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [role, setRole] = useState<string>('org_staff')
  const [busy, setBusy] = useState(false)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [createOrgErr, setCreateOrgErr] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const [u, o] = await Promise.all([
          fetch('/api/admin/users').then(r => r.json()),
          fetch('/api/admin/orgs').then(r => r.json())
        ])
        if (u?.error) throw new Error(u.error)
        if (o?.error) throw new Error(o.error)
        setUsers(u.users || [])
        setOrgs(o.organizations || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load users')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const assign = async () => {
    if (!selectedUser || !selectedOrg || !role) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser, org_id: selectedOrg, role })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to assign role')
      // Refresh list
      const updated = await fetch('/api/admin/users').then(r => r.json())
      setUsers(updated.users || [])
      setSelectedUser('')
      setSelectedOrg('')
      setRole('org_staff')
    } catch (e: any) {
      setError(e?.message || 'Failed to assign role')
    } finally {
      setBusy(false)
    }
  }

  const createOrg = async () => {
    if (!newOrgName.trim()) return
    setCreatingOrg(true)
    setCreateOrgErr(null)
    try {
      const res = await fetch('/api/admin/orgs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newOrgName.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create organization')
      const o = await fetch('/api/admin/orgs').then(r => r.json())
      setOrgs(o.organizations || [])
      setSelectedOrg(data.organization?.id || '')
      setShowCreateOrg(false)
      setNewOrgName('')
    } catch (e: any) {
      setCreateOrgErr(e?.message || 'Failed to create organization')
    } finally {
      setCreatingOrg(false)
    }
  }

  const setCurrentOrg = (id: string) => {
    if (!id) return
    // client cookie for org context (used by API via x-org-id header if forwarded)
    document.cookie = `x-org-id=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 30}`
    setOrgMsg('Current org set for this browser session')
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Users & Roles</h1>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[280px]">
              <label className="block text-sm mb-1">Organization name</label>
              <Input value={orgName} onChange={e=> setOrgName(e.target.value)} placeholder="Acme Property Co" />
            </div>
            <Button onClick={createOrg} disabled={orgBusy || !orgName.trim()}>{orgBusy ? 'Creating...' : 'Create organization'}</Button>
            {orgMsg && <span className="text-sm text-muted-foreground">{orgMsg}</span>}
          </div>
          <div className="text-sm text-muted-foreground">Existing: {orgs.length || 0}</div>
          <div className="flex flex-wrap gap-2">
            {orgs.map(o => (
              <button key={o.id} onClick={()=> setCurrentOrg(o.id)} className="inline-flex items-center px-2 py-0.5 rounded border text-xs hover:bg-muted" title="Set current org">
                {o.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Organization</label>
              <Select value={selectedOrg} onValueChange={(v)=> v==="__create__" ? setShowCreateOrg(true) : setSelectedOrg(v)}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__create__">+ Create new organization...</SelectItem>
                  {orgs.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org_staff">org_staff</SelectItem>
                  <SelectItem value="org_manager">org_manager</SelectItem>
                  <SelectItem value="org_admin">org_admin</SelectItem>
                  <SelectItem value="platform_admin">platform_admin</SelectItem>
                  <SelectItem value="owner_portal">owner_portal</SelectItem>
                  <SelectItem value="tenant_portal">tenant_portal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button disabled={busy || !selectedUser || !selectedOrg} onClick={assign}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Memberships</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Last Sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4">
                        {(u.memberships || []).length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {u.memberships.map((m, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded border text-xs">
                                {m.org_name || m.org_id} • {m.role}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
                      <td className="py-2 pr-4">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    
      <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <Input value={newOrgName} onChange={(e)=> setNewOrgName(e.target.value)} placeholder="Acme Property Co" />
            </div>
            {createOrgErr && <div className="text-sm text-destructive">{createOrgErr}</div>}
            <div className="flex items-center gap-2">
              <Button onClick={createOrg} disabled={creatingOrg || !newOrgName.trim()}>{creatingOrg ? "Creating..." : "Create"}</Button>
              <Button variant="outline" onClick={()=> setShowCreateOrg(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
</div>
  )
}

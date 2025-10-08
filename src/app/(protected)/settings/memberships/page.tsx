"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Org = { id: string; name: string }
type Membership = { org_id: string; org_name?: string; role: string }
type UserRow = {
  id: string
  email: string
  memberships: Membership[]
}

const ROLE_OPTIONS = [
  { label: 'Org Staff', value: 'org_staff' },
  { label: 'Property Manager', value: 'org_manager' },
  { label: 'Org Admin', value: 'org_admin' },
  { label: 'Platform Admin', value: 'platform_admin' },
  { label: 'Owner Portal', value: 'owner_portal' },
  { label: 'Tenant Portal', value: 'tenant_portal' },
]

export default function MembershipsPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('org_staff')
  const [busy, setBusy] = useState(false)

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
        setUsers((u.users || []).map((x: any) => ({ id: x.id, email: x.email, memberships: x.memberships || [] })))
        setOrgs(o.organizations || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const selectedUserObj = useMemo(() => users.find(u => u.id === selectedUser) || null, [users, selectedUser])

  const assign = async () => {
    if (!selectedUser || !selectedOrg || !selectedRole) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/memberships/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser, org_id: selectedOrg, role: selectedRole })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to assign membership')
      // Refresh users list to reflect change
      const u = await fetch('/api/admin/users').then(r => r.json())
      if (u?.error) throw new Error(u.error)
      setUsers((u.users || []).map((x: any) => ({ id: x.id, email: x.email, memberships: x.memberships || [] })))
    } catch (e: any) {
      setError(e?.message || 'Failed to assign membership')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: string, orgId: string) => {
    if (!userId || !orgId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/memberships/simple', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, org_id: orgId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to remove membership')
      // Refresh users list
      const u = await fetch('/api/admin/users').then(r => r.json())
      if (u?.error) throw new Error(u.error)
      setUsers((u.users || []).map((x: any) => ({ id: x.id, email: x.email, memberships: x.memberships || [] })))
    } catch (e: any) {
      setError(e?.message || 'Failed to remove membership')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Memberships</h1>

      <Card>
        <CardHeader>
          <CardTitle>Quick Assign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-sm text-destructive">{error}</div>}
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <>
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
                  <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                    <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>
                      {orgs.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Role</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Button onClick={assign} disabled={busy || !selectedUser || !selectedOrg || !selectedRole}>
                  {busy ? 'Saving...' : 'Assign Membership'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4">User</th>
                    <th className="text-left py-2 pr-4">Organization</th>
                    <th className="text-left py-2 pr-4">Role</th>
                    <th className="text-left py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.flatMap(u => (u.memberships || []).map(m => ({ u, m }))).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-muted-foreground">No memberships found.</td>
                    </tr>
                  ) : (
                    users.flatMap(u => (u.memberships || []).map(m => ({ u, m }))).map(({ u, m }, idx) => (
                      <tr key={`${u.id}-${m.org_id}-${idx}`} className="border-t">
                        <td className="py-2 pr-4">{u.email}</td>
                        <td className="py-2 pr-4">{m.org_name || m.org_id}</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">{m.role}</Badge></td>
                        <td className="py-2 pr-4">
                          <Button variant="outline" size="sm" disabled={busy} onClick={() => remove(u.id, m.org_id)}>Remove</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


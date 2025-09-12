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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Users & Roles</h1>

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
    </div>
  )
}


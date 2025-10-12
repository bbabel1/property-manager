"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X, Edit } from 'lucide-react'

type Org = { id: string; name: string }
type Membership = { org_id: string; org_name?: string; role: string }
type Contact = { id: string; first_name?: string; last_name?: string; email?: string; phone?: string }
type UserRow = { 
  id: string; 
  email: string; 
  created_at?: string; 
  last_sign_in_at?: string; 
  memberships: Membership[];
  contact?: Contact;
}

export default function UsersRolesPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite form state and shared org/role pickers
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['org_staff'])
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [createOrgErr, setCreateOrgErr] = useState<string | null>(null)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  
  // Edit user state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [editSelectedOrg, setEditSelectedOrg] = useState<string>('')
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([])
  const [editBusy, setEditBusy] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  
  // Edit contact state
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const handleRoleSelect = (role: string) => {
    if (!selectedRoles.includes(role)) {
      setSelectedRoles(prev => [...prev, role])
    }
  }

  const handleRoleRemove = (role: string) => {
    setSelectedRoles(prev => prev.filter(r => r !== role))
  }

  const handleEditRoleSelect = (role: string) => {
    if (!editSelectedRoles.includes(role)) {
      setEditSelectedRoles(prev => [...prev, role])
    }
  }

  const handleEditRoleRemove = (role: string) => {
    setEditSelectedRoles(prev => prev.filter(r => r !== role))
  }

  const startEditUser = (user: UserRow) => {
    setEditingUser(user)
    // Pre-populate with existing memberships
    if (user.memberships && user.memberships.length > 0) {
      const firstMembership = user.memberships[0]
      setEditSelectedOrg(firstMembership.org_id)
      const uniqueRoles = Array.from(new Set(
        user.memberships.map(m => m.role).filter((role): role is string => Boolean(role))
      ))
      setEditSelectedRoles(uniqueRoles)
    } else {
      setEditSelectedOrg('')
      setEditSelectedRoles(['org_staff'])
    }
    
    // Pre-populate contact details
    if (user.contact) {
      setEditContact(user.contact)
      setEditFirstName(user.contact.first_name || '')
      setEditLastName(user.contact.last_name || '')
      setEditPhone(user.contact.phone || '')
    } else {
      setEditContact(null)
      setEditFirstName('')
      setEditLastName('')
      setEditPhone('')
    }

    // Email
    setEditEmail(user.email || '')
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setEditSelectedOrg('')
    setEditSelectedRoles([])
    setEditContact(null)
    setEditFirstName('')
    setEditLastName('')
    setEditPhone('')
    setEditEmail('')
  }

  const saveContactDetails = async () => {
    if (!editingUser) return
    
    try {
      const contactData = {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        phone: editPhone.trim(),
        email: editingUser.email
      }
      
      const res = await fetch('/api/admin/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: editingUser.id,
          ...contactData
        })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'Failed to update contact details')
      }
    } catch (e: any) {
      console.error('Failed to save contact details:', e.message)
      // Don't throw here - we still want to save roles even if contact fails
    }
  }

  const saveEdit = async () => {
    if (!editingUser || !editSelectedOrg || editSelectedRoles.length === 0) return
    setEditBusy(true)
    setError(null)
    try {
      // Save contact details first
      await saveContactDetails()

      // Update email if changed
      if (editEmail && editEmail !== editingUser.email) {
        const resEmail = await fetch('/api/admin/users/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: editingUser.id, email: editEmail })
        })
        const d = await resEmail.json()
        if (!resEmail.ok) throw new Error(d?.error || 'Failed to update email')
      }

      // Then save roles
      const res = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: editingUser.id, 
          org_id: editSelectedOrg, 
          roles: editSelectedRoles 
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update roles')
      // Refresh list
      const updated = await fetch('/api/admin/users').then(r => r.json())
      setUsers(updated.users || [])
      cancelEdit()
    } catch (e: any) {
      setError(e?.message || 'Failed to update roles')
    } finally {
      setEditBusy(false)
    }
  }

  const invite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteErr(null)
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), org_id: selectedOrg || undefined, roles: selectedRoles })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to invite user')
      // Refresh
      const updated = await fetch('/api/admin/users').then(r => r.json())
      setUsers(updated.users || [])
      setInviteEmail('')
    } catch (e: any) {
      setInviteErr(e?.message || 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

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

  // Note: Role/Org assignment is done exclusively in the table edit dialog

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


  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Users & Roles</h1>


      <Card>
        <CardHeader>
          <CardTitle>Invite User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <Input value={inviteEmail} onChange={(e)=> setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-sm mb-1">Organization (optional)</label>
              <Select value={selectedOrg} onValueChange={(v)=> v==="__create__" ? setShowCreateOrg(true) : setSelectedOrg(v)}>
                <SelectTrigger aria-label="Select organization"><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__create__">+ Create New</SelectItem>
                  {orgs.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Initial Roles (optional)</label>
              <Select onValueChange={handleRoleSelect}>
                <SelectTrigger aria-label="Add roles">
                  <SelectValue placeholder="Add roles..." />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { label: 'Org Staff', value: 'org_staff' },
                    { label: 'Property Manager', value: 'org_manager' },
                    { label: 'Org Admin', value: 'org_admin' },
                    { label: 'Platform Admin', value: 'platform_admin' },
                  ]
                    .filter(opt => !selectedRoles.includes(opt.value))
                    .map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedRoles.length > 0 && (
            <div>
              <label className="block text-sm mb-2">Selected Roles</label>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map((role) => (
                  <Badge key={role} variant="secondary" className="flex items-center gap-1">
                    {role}
                    <button
                      type="button"
                      onClick={() => handleRoleRemove(role)}
                      className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                      aria-label={`Remove ${role} role`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button disabled={inviting || !inviteEmail.trim()} onClick={invite}>
              {inviting ? 'Inviting...' : 'Send Invite'}
            </Button>
            {inviteErr && <span className="text-sm text-destructive">{inviteErr}</span>}
          </div>
        </CardContent>
      </Card>


      {/* Assign Role panel removed. Editing occurs via the Users table dialog. */}

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
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Memberships</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Last Sign-in</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {u.contact ? (
                          <div>
                            <div className="font-medium">
                              {u.contact.first_name} {u.contact.last_name}
                            </div>
                            {u.contact.phone && (
                              <div className="text-xs text-muted-foreground">{u.contact.phone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No contact info</span>
                        )}
                      </td>
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
                      <td className="py-2 pr-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditUser(u)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
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
              <Button variant="ghost" onClick={()=> setShowCreateOrg(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => cancelEdit()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingUser && (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Editing user: <span className="font-medium">{editingUser.email}</span>
                </p>
                
                {/* Contact Details Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Contact Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">First Name</label>
                      <Input 
                        value={editFirstName} 
                        onChange={(e) => setEditFirstName(e.target.value)} 
                        placeholder="First name" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Last Name</label>
                      <Input 
                        value={editLastName} 
                        onChange={(e) => setEditLastName(e.target.value)} 
                        placeholder="Last name" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1">Phone</label>
                      <Input 
                        value={editPhone} 
                        onChange={(e) => setEditPhone(e.target.value)} 
                        placeholder="Phone number" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1">Email (sign-in)</label>
                      <Input 
                        value={editEmail} 
                        onChange={(e) => setEditEmail(e.target.value)} 
                        placeholder="user@example.com" 
                      />
                    </div>
                  </div>
                </div>
                
                {/* Organization & Roles Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Organization & Roles</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Organization</label>
                      <Select value={editSelectedOrg} onValueChange={(v)=> v==="__create__" ? setShowCreateOrg(true) : setEditSelectedOrg(v)}>
                        <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__create__">+ Create New</SelectItem>
                          {orgs.map(o => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Roles</label>
                      <Select onValueChange={handleEditRoleSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Add roles..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            { label: 'Org Staff', value: 'org_staff' },
                            { label: 'Property Manager', value: 'org_manager' },
                            { label: 'Org Admin', value: 'org_admin' },
                            { label: 'Platform Admin', value: 'platform_admin' },
                            { label: 'Owner Portal', value: 'owner_portal' },
                            { label: 'Tenant Portal', value: 'tenant_portal' },
                          ]
                            .filter(opt => !editSelectedRoles.includes(opt.value))
                            .map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                {editSelectedRoles.length > 0 && (
                  <div>
                    <label className="block text-sm mb-2">Selected Roles</label>
                    <div className="flex flex-wrap gap-2">
                      {editSelectedRoles.map((role) => (
                        <Badge key={role} variant="secondary" className="flex items-center gap-1">
                          {role}
                          <button
                            type="button"
                            onClick={() => handleEditRoleRemove(role)}
                            className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                            aria-label={`Remove ${role} role`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {error && <div className="text-sm text-destructive">{error}</div>}
                
                <div className="flex items-center gap-2 pt-4">
                  <Button 
                    onClick={saveEdit} 
                    disabled={editBusy || !editSelectedOrg || editSelectedRoles.length === 0}
                  >
                    {editBusy ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
</div>
  )
}

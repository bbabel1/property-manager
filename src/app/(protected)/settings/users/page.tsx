"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X, Edit } from 'lucide-react'
import { getAvailableUIStaffRoles } from '@/lib/enums/staff-roles'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Org = { id: string; name: string }
type Membership = { org_id: string; org_name?: string; roles?: string[] }
type Contact = { id: string; first_name?: string; last_name?: string; email?: string; phone?: string }
type PermissionProfile = { org_id: string; profile_id: string; profile_name?: string }
type PermissionProfileOption = { id: string; name: string; org_id: string | null; description?: string | null }
const DEFAULT_PROFILE_VALUE = '__default__'
const STAFF_ROLE_PLACEHOLDER = '__no_staff_role__'
type UserRow = { 
  id: string; 
  email: string; 
  created_at?: string; 
  last_sign_in_at?: string; 
  memberships: Membership[];
  permission_profiles?: PermissionProfile[];
  contact?: Contact;
  staff?: { id: number; role: string | null } | null;
}

export default function UsersRolesPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfileOption[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // Invite form state and shared org/role pickers
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['org_staff'])
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [createOrgErr, setCreateOrgErr] = useState<string | null>(null)
  const [createOrgContext, setCreateOrgContext] = useState<'invite' | 'edit' | null>(null)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  const [selectedInviteProfileId, setSelectedInviteProfileId] = useState('')
  const [selectedInviteStaffRole, setSelectedInviteStaffRole] = useState('')
  
  // Edit user state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [editSelectedOrg, setEditSelectedOrg] = useState<string>('')
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([])
  const [editBusy, setEditBusy] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editOrgRoles, setEditOrgRoles] = useState<Record<string, string[]>>({})
  const [editError, setEditError] = useState<string | null>(null)
  const [editSelectedProfileId, setEditSelectedProfileId] = useState<string>('') 
  const [editSelectedStaffRole, setEditSelectedStaffRole] = useState<string>('') 
  
  // Edit contact state
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editPhone, setEditPhone] = useState('')

    const setRolesForOrg = (orgId: string, roles: string[]) => {
      if (!orgId) return
      const uniqueRoles = Array.from(new Set(roles.filter(Boolean)))
      setEditOrgRoles(prev => ({ ...prev, [orgId]: uniqueRoles }))
      setEditSelectedRoles(uniqueRoles.length ? uniqueRoles : [])

      // Keep staff role in sync with org when possible
      if (editingUser?.staff?.role) {
        setEditSelectedStaffRole(editingUser.staff.role)
      }
    }

  const handleRoleSelect = (role: string) => {
    if (!selectedRoles.includes(role)) {
      setSelectedRoles(prev => [...prev, role])
    }
  }

  const handleRoleRemove = (role: string) => {
    setSelectedRoles(prev => prev.filter(r => r !== role))
  }

  const handleEditRoleSelect = (role: string) => {
    if (!editSelectedOrg || editSelectedRoles.includes(role)) return
    setRolesForOrg(editSelectedOrg, [...editSelectedRoles, role])
  }

  const handleEditRoleRemove = (role: string) => {
    if (!editSelectedOrg) return
    setRolesForOrg(editSelectedOrg, editSelectedRoles.filter(r => r !== role))
  }

  const startEditUser = (user: UserRow) => {
    setEditingUser(user)
    setEditError(null)
    const membershipsByOrg: Record<string, string[]> = {}
    if (user.memberships && user.memberships.length > 0) {
      user.memberships.forEach((membership) => {
        if (!membershipsByOrg[membership.org_id]) {
          membershipsByOrg[membership.org_id] = []
        }
        const rolesForMembership = Array.isArray(membership.roles) && membership.roles.length
          ? membership.roles
          : (membership as any).role
            ? [(membership as any).role as string]
            : []
        rolesForMembership.forEach((role) => {
          if (role) membershipsByOrg[membership.org_id].push(role)
        })
      })
    const firstMembership = user.memberships[0]
    let rolesForOrg = membershipsByOrg[firstMembership.org_id] || []
    if (!rolesForOrg.length) {
      rolesForOrg = ['org_staff']
    }
    const uniqueRoles = Array.from(new Set(rolesForOrg))
    membershipsByOrg[firstMembership.org_id] = uniqueRoles
    setEditOrgRoles(membershipsByOrg)
    setEditSelectedOrg(firstMembership.org_id)
    setEditSelectedRoles(uniqueRoles)
    const profileForOrg = (user.permission_profiles || []).find((p) => p.org_id === firstMembership.org_id)
    setEditSelectedProfileId(profileForOrg?.profile_id || '')
    setEditSelectedStaffRole(user.staff?.role || '')
  } else {
    setEditOrgRoles({})
    setEditSelectedOrg('')
    setEditSelectedRoles(['org_staff'])
    setEditSelectedProfileId('')
    setEditSelectedStaffRole('')
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
    setEditOrgRoles({})
    setEditError(null)
    setEditContact(null)
    setEditFirstName('')
    setEditLastName('')
    setEditPhone('')
    setEditEmail('')
    setEditSelectedProfileId('')
    setEditSelectedStaffRole('')
  }

  const saveContactDetails = async (contactEmail: string) => {
    if (!editingUser) return
    
    try {
      const contactData = {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        phone: editPhone.trim(),
        email: contactEmail
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
    if (!editingUser || !editSelectedOrg) return
    const rolesToSave = Array.from(new Set(editSelectedRoles.filter(Boolean)))
    if (rolesToSave.length === 0) {
      setEditError('Select at least one role')
      return
    }
    const trimmedEmail = editEmail.trim()
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setEditError('Enter a valid email address')
      return
    }
    const normalizedEmail = trimmedEmail.toLowerCase()
    const contactEmail = trimmedEmail ? normalizedEmail : editingUser.email
    setEditBusy(true)
    setEditError(null)
    try {
      // Save contact details first
      await saveContactDetails(contactEmail)

      // Update email if changed
      if (trimmedEmail && normalizedEmail !== editingUser.email) {
        const resEmail = await fetch('/api/admin/users/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: editingUser.id, email: normalizedEmail })
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
          roles: rolesToSave,
          staff_role: editSelectedStaffRole || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update roles')
      // Assign permission profile (optional)
      const assignRes = await fetch('/api/admin/permission-profiles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: editingUser.id,
          org_id: editSelectedOrg,
          profile_id: editSelectedProfileId || null
        })
      })
      if (!assignRes.ok) {
        const assignData = await assignRes.json().catch(() => ({}))
        throw new Error(assignData?.error || 'Failed to assign permission profile')
      }
      // Refresh list
      const updated = await fetch('/api/admin/users').then(r => r.json())
      setUsers(updated.users || [])
      cancelEdit()
    } catch (e: any) {
      setEditError(e?.message || 'Failed to update roles')
    } finally {
      setEditBusy(false)
    }
  }

  const invite = async () => {
    const trimmedEmail = inviteEmail.trim().toLowerCase()
    if (!trimmedEmail) {
      setInviteErr('Enter an email address')
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setInviteErr('Enter a valid email address')
      return
    }
    setInviting(true)
    setInviteErr(null)
    try {
      const uniqueRoles = Array.from(new Set(selectedRoles.filter(Boolean)))
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: trimmedEmail, 
          org_id: selectedOrg || undefined, 
          roles: uniqueRoles.length ? uniqueRoles : ['org_staff'],
          permission_profile_id: selectedInviteProfileId || undefined,
          staff_role: selectedInviteStaffRole || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to invite user')
      // Refresh
      const updated = await fetch('/api/admin/users').then(r => r.json())
      setUsers(updated.users || [])
      setInviteEmail('')
      setSelectedRoles(['org_staff'])
      setSelectedInviteProfileId('')
      setSelectedInviteStaffRole('')
      setShowInviteDialog(false)
    } catch (e: any) {
      setInviteErr(e?.message || 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setPageError(null)
      try {
        const [u, o, p] = await Promise.all([
          fetch('/api/admin/users').then(r => r.json()),
          fetch('/api/admin/orgs').then(r => r.json()),
          fetch('/api/admin/permission-profiles').then(r => r.json())
        ])
        if (u?.error) throw new Error(u.error)
        if (o?.error) throw new Error(o.error)
        if (p?.error) throw new Error(p.error)
        setUsers(u.users || [])
        setOrgs(o.organizations || [])
        setPermissionProfiles(p.profiles || [])
      } catch (e: any) {
        setPageError(e?.message || 'Failed to load users')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  // Note: Role/Org assignment is done exclusively in the table edit dialog

  const handleCreateOrgDialogChange = (open: boolean) => {
    setShowCreateOrg(open)
    if (!open) {
      setNewOrgName('')
      setCreateOrgErr(null)
      setCreateOrgContext(null)
    }
  }

  const openCreateOrgDialog = (context: 'invite' | 'edit') => {
    setCreateOrgContext(context)
    setCreateOrgErr(null)
    setNewOrgName('')
    setShowCreateOrg(true)
  }

  const handleInviteOrgChange = (value: string) => {
    if (value === '__create__') {
      openCreateOrgDialog('invite')
      return
    }
    setSelectedOrg(value)
  }

  const handleEditOrgChange = (value: string) => {
    if (value === '__create__') {
      openCreateOrgDialog('edit')
      return
    }
    if (!value) return
    const roles = editOrgRoles[value]
    const normalizedRoles = roles && roles.length ? Array.from(new Set(roles)) : ['org_staff']
    setEditOrgRoles(prev => ({ ...prev, [value]: normalizedRoles }))
    setEditSelectedOrg(value)
    setEditSelectedRoles(normalizedRoles)
    const profileForOrg = editingUser?.permission_profiles?.find((p) => p.org_id === value)
    setEditSelectedProfileId(profileForOrg?.profile_id || '')
    setEditSelectedStaffRole(editingUser?.staff?.role || '')
  }

  const createOrg = async () => {
    const name = newOrgName.trim()
    if (!name) return
    setCreatingOrg(true)
    setCreateOrgErr(null)
    try {
      const res = await fetch('/api/admin/orgs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create organization')
      const refreshed = await fetch('/api/admin/orgs').then(r => r.json())
      setOrgs(refreshed.organizations || [])
      const createdId = data.organization?.id || ''
      if (createOrgContext === 'edit') {
        if (createdId) {
          setEditOrgRoles(prev => ({ ...prev, [createdId]: ['org_staff'] }))
          setEditSelectedOrg(createdId)
          setEditSelectedRoles(['org_staff'])
        }
      } else if (createOrgContext === 'invite') {
        if (createdId) {
          setSelectedOrg(createdId)
        }
      }
      handleCreateOrgDialogChange(false)
    } catch (e: any) {
      setCreateOrgErr(e?.message || 'Failed to create organization')
    } finally {
      setCreatingOrg(false)
    }
  }

  const inviteEmailTrimmed = inviteEmail.trim()
  const inviteEmailValid = inviteEmailTrimmed.length > 0 && EMAIL_REGEX.test(inviteEmailTrimmed.toLowerCase())
  const filteredInviteProfiles = permissionProfiles.filter(
    (p) => !selectedOrg || !p.org_id || p.org_id === selectedOrg
  )
  const filteredEditProfiles = permissionProfiles.filter(
    (p) => !editSelectedOrg || !p.org_id || p.org_id === editSelectedOrg
  )
  const staffRoleOptions = getAvailableUIStaffRoles()


  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Users & Roles</h1>
        <Button onClick={() => setShowInviteDialog(true)}>Invite User</Button>
      </div>


      {/* Assign Role panel removed. Editing occurs via the Users table dialog. */}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : pageError ? (
            <div className="text-sm text-destructive">{pageError}</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-md px-4 py-6 text-center">
              No users yet. Send an invite to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Organization</th>
                    <th className="py-2 pr-4">Roles</th>
                    <th className="py-2 pr-4">Permission Profile</th>
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
                          <div className="flex flex-col gap-1">
                            {u.memberships.map((m, idx) => (
                              <span key={idx} className="text-sm">
                                {m.org_name || m.org_id}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {(u.memberships || []).length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {u.memberships.map((m, idx) => {
                              const roles = m.roles && m.roles.length > 0 ? m.roles : ['org_staff']
                              return (
                                <span key={idx} className="text-sm">
                                  {roles.join(', ')}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {(u.permission_profiles || []).length === 0 ? (
                          <span className="text-muted-foreground">Default</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {u.permission_profiles?.map((p, idx) => (
                              <span key={idx} className="text-sm">
                                {p.profile_name || p.profile_id}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
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
    
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <Input 
                  value={inviteEmail} 
                  onChange={(e)=> {
                    setInviteEmail(e.target.value)
                    if (inviteErr) setInviteErr(null)
                  }} 
                  placeholder="user@example.com" 
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Organization (optional)</label>
                <Select value={selectedOrg} onValueChange={handleInviteOrgChange}>
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
                <label className="block text-sm mb-1">Permission Profile (optional)</label>
              <Select
                value={selectedInviteProfileId || DEFAULT_PROFILE_VALUE}
                onValueChange={(v) => setSelectedInviteProfileId(v === DEFAULT_PROFILE_VALUE ? '' : v)}
              >
                <SelectTrigger aria-label="Select permission profile">
                  <SelectValue placeholder="Default for role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_PROFILE_VALUE}>(Use default)</SelectItem>
                  {filteredInviteProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.org_id ? '' : ' (global)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Staff Role (optional)</label>
              <Select
                value={selectedInviteStaffRole || STAFF_ROLE_PLACEHOLDER}
                onValueChange={(v) => setSelectedInviteStaffRole(v === STAFF_ROLE_PLACEHOLDER ? '' : v)}
              >
                <SelectTrigger aria-label="Select staff role">
                  <SelectValue placeholder="No staff role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STAFF_ROLE_PLACEHOLDER}>No staff role</SelectItem>
                  {staffRoleOptions.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
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
                      { label: 'Owner Portal', value: 'owner_portal' },
                      { label: 'Tenant Portal', value: 'tenant_portal' },
                      { label: 'Vendor Portal', value: 'vendor_portal' },
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
              <Button disabled={inviting || !inviteEmailValid} onClick={invite}>
                {inviting ? 'Inviting...' : 'Send Invite'}
              </Button>
              {inviteErr && <span className="text-sm text-destructive">{inviteErr}</span>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateOrg} onOpenChange={handleCreateOrgDialogChange}>
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
              <Button variant="cancel" onClick={()=> handleCreateOrgDialogChange(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) cancelEdit() }}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="font-medium">{editingUser.created_at ? new Date(editingUser.created_at).toLocaleString() : '-'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last sign-in</div>
                    <div className="font-medium">{editingUser.last_sign_in_at ? new Date(editingUser.last_sign_in_at).toLocaleString() : '-'}</div>
                  </div>
                </div>
                
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
                        onChange={(e) => {
                          setEditEmail(e.target.value)
                          if (editError) setEditError(null)
                        }} 
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
                      <Select value={editSelectedOrg} onValueChange={handleEditOrgChange}>
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
                        { label: 'Vendor Portal', value: 'vendor_portal' },
                      ]
                        .filter(opt => !editSelectedRoles.includes(opt.value))
                        .map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Staff Role (optional)</label>
                  <Select
                    value={editSelectedStaffRole || STAFF_ROLE_PLACEHOLDER}
                    onValueChange={(v) => setEditSelectedStaffRole(v === STAFF_ROLE_PLACEHOLDER ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No staff role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STAFF_ROLE_PLACEHOLDER}>No staff role</SelectItem>
                      {staffRoleOptions.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Permission Profile</label>
                  <Select
                    value={editSelectedProfileId || DEFAULT_PROFILE_VALUE}
                    onValueChange={(v) => setEditSelectedProfileId(v === DEFAULT_PROFILE_VALUE ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Default for role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={DEFAULT_PROFILE_VALUE}>(Use default)</SelectItem>
                          {filteredEditProfiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {p.org_id ? '' : ' (global)'}
                            </SelectItem>
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
                
                {editError && <div className="text-sm text-destructive">{editError}</div>}
                
                <div className="flex items-center gap-2 pt-4">
                  <Button 
                    onClick={saveEdit} 
                    disabled={editBusy || !editSelectedOrg || editSelectedRoles.length === 0}
                  >
                    {editBusy ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="cancel" onClick={cancelEdit}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
</div>
  )
}

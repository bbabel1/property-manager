'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Org = { id: string; name: string };
type Membership = { org_id: string; org_name?: string; roles?: string[] };
type UserRow = {
  id: string;
  email: string;
  memberships: Membership[];
};
type Role = {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  org_id?: string | null;
};

export default function MembershipsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Set default role when roles are loaded
  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      // Default to first non-portal role, or first role if none found
      const defaultRole = roles.find((r) => !r.name.toLowerCase().includes('portal')) || roles[0];
      setSelectedRole(defaultRole.name);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [u, o, r] = await Promise.all([
          fetch('/api/admin/users').then((r) => r.json()),
          fetch('/api/admin/orgs').then((r) => r.json()),
          fetch('/api/admin/permission-profiles').then((r) => r.json()),
        ]);
        if (u?.error) throw new Error(u.error);
        if (o?.error) throw new Error(o.error);
        if (r?.error) throw new Error(r.error);
        setUsers(
          (u.users || []).flatMap((x) => {
            if (!x?.id || !x?.email) return [];
            const memberships: Membership[] = Array.isArray(x.memberships)
              ? x.memberships.map((m) => ({
                  org_id: String(m?.org_id ?? ''),
                  org_name: m?.org_name,
                  roles: Array.isArray(m?.roles)
                    ? m.roles.map((role: unknown) => String(role)).filter(Boolean)
                    : [],
                }))
              : [];
            return [
              {
                id: String(x.id),
                email: String(x.email),
                memberships,
              },
            ];
          }),
        );
        setOrgs(o.organizations || []);
        setRoles(
          (r.profiles || []).flatMap((p) => {
            if (!p?.id || !p?.name) return [];
            return [
              {
                id: String(p.id),
                name: String(p.name),
                description: p.description || undefined,
                is_system: Boolean(p.is_system),
                org_id: p.org_id ? String(p.org_id) : null,
              },
            ];
          }),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const assign = async () => {
    if (!selectedUser || !selectedOrg || !selectedRole) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/memberships/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser, org_id: selectedOrg, role: selectedRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to assign membership');
      // Refresh users list to reflect change
      const u = await fetch('/api/admin/users').then((r) => r.json());
      if (u?.error) throw new Error(u.error);
      setUsers(
        (u.users || []).flatMap((x) => {
          if (!x?.id || !x?.email) return [];
          const memberships: Membership[] = Array.isArray(x.memberships)
            ? x.memberships.map((m) => ({
                org_id: String(m?.org_id ?? ''),
                org_name: m?.org_name,
                roles: Array.isArray(m?.roles)
                  ? m.roles.map((role: unknown) => String(role)).filter(Boolean)
                  : [],
              }))
            : [];
          return [
            {
              id: String(x.id),
              email: String(x.email),
              memberships,
            },
          ];
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to assign membership';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string, orgId: string) => {
    if (!userId || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/memberships/simple', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, org_id: orgId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to remove membership');
      // Refresh users list
      const u = await fetch('/api/admin/users').then((r) => r.json());
      if (u?.error) throw new Error(u.error);
      setUsers(
        (u.users || []).flatMap((x) => {
          if (!x?.id || !x?.email) return [];
          const memberships: Membership[] = Array.isArray(x.memberships)
            ? x.memberships.map((m) => ({
                org_id: String(m?.org_id ?? ''),
                org_name: m?.org_name,
                roles: Array.isArray(m?.roles)
                  ? m.roles.map((role: unknown) => String(role)).filter(Boolean)
                  : [],
              }))
            : [];
          return [
            {
              id: String(x.id),
              email: String(x.email),
              memberships,
            },
          ];
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to remove membership';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-bold">Memberships</h1>

      <Card>
        <CardHeader>
          <CardTitle>Quick Assign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-destructive text-sm">{error}</div>}
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm">User</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Organization</label>
                  <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Role</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.length === 0 ? (
                        <SelectItem value="loading" disabled>
                          Loading roles...
                        </SelectItem>
                      ) : (
                        roles.map((r) => (
                          <SelectItem key={r.id} value={r.name}>
                            {r.name}
                            {r.description && (
                              <span className="text-muted-foreground text-xs">
                                {' '}
                                - {r.description}
                              </span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedRole && roles.find((r) => r.name === selectedRole)?.description && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {roles.find((r) => r.name === selectedRole)?.description}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Button
                  onClick={assign}
                  disabled={busy || !selectedUser || !selectedOrg || !selectedRole}
                >
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
                    <th className="py-2 pr-4 text-left">User</th>
                    <th className="py-2 pr-4 text-left">Organization</th>
                    <th className="py-2 pr-4 text-left">Role</th>
                    <th className="py-2 pr-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.flatMap((u) => (u.memberships || []).map((m) => ({ u, m }))).length ===
                  0 ? (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground py-4">
                        No memberships found.
                      </td>
                    </tr>
                  ) : (
                    users
                      .flatMap((u) => (u.memberships || []).map((m) => ({ u, m })))
                      .map(({ u, m }, idx) => (
                        <tr key={`${u.id}-${m.org_id}-${idx}`} className="border-t">
                          <td className="py-2 pr-4">{u.email}</td>
                          <td className="py-2 pr-4">{m.org_name || m.org_id}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary">
                              {(m.roles && m.roles.length > 0 ? m.roles : ['org_staff']).join(', ')}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => remove(u.id, m.org_id)}
                            >
                              Remove
                            </Button>
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
  );
}

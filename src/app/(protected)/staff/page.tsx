'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EditLink from '@/components/ui/EditLink';
import { Dropdown } from '@/components/ui/Dropdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import StaffWizardModal from './StaffWizardModal';
import { Guard } from '@/components/Guard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { normalizeStaffRole } from '@/lib/staff-role';
import { getAvailableUIStaffRoles } from '@/lib/enums/staff-roles';
import { Checkbox } from '@/ui/checkbox';
import { Body, Heading, Label } from '@/ui/typography';

type Staff = {
  id: number;
  role: string;
  is_active: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  buildium_staff_id?: number | null;
};

const ROLE_OPTIONS = getAvailableUIStaffRoles().map((value) => ({ value, label: value }));

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean>(true);
  const [filterSynced, setFilterSynced] = useState<boolean>(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      if (typeof filterActive === 'boolean') params.set('isActive', String(filterActive));
      const res = await fetch(`/api/staff?${params.toString()}`, { cache: 'no-store' });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const errMsg =
          data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error?: string }).error
            : 'Failed to load staff';
        throw new Error(errMsg);
      }
      const list = (Array.isArray(data) ? data : []).flatMap((item) => {
        if (item && typeof item === 'object' && 'id' in item && 'role' in item) {
          return [item as Staff];
        }
        return [];
      });
      const filtered = filterSynced ? list.filter((s) => s.buildium_staff_id != null) : list;
      setStaff(filtered);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load staff';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filterActive, filterRole, filterSynced]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: number) => {
    await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncToBuildium = async (id: number) => {
    try {
      setSyncingId(id);
      setSyncError(null);
      const res = await fetch('/api/buildium/staff/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Sync failed');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed';
      setSyncError(message);
    } finally {
      setSyncingId(null);
    }
  };

  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const openEdit = (s: Staff) => setEditing(s);
  const syncAll = async () => {
    try {
      setSyncAllBusy(true);
      await fetch('/api/buildium/staff/sync-all', { method: 'POST' });
      await load();
    } finally {
      setSyncAllBusy(false);
    }
  };

  // Last sync status
  const [lastSync, setLastSync] = useState<string | null>(null);
  const loadLast = useCallback(async () => {
    try {
      const res = await fetch('/api/buildium/staff/sync-all', { method: 'GET', cache: 'no-store' });
      const j = await res.json();
      const ts = j?.last?.finished_at || j?.last?.started_at;
      setLastSync(ts ? new Date(ts).toLocaleString() : null);
    } catch {
      setLastSync(null);
    }
  }, []);
  useEffect(() => {
    void loadLast();
  }, [loadLast]);

  return (
    <div className="space-y-6">
      <Heading as="h1" size="h2">
        Staff
      </Heading>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Team</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowModal(true)}>
                Add Staff
              </Button>
              <Guard require={'org_manager'}>
                <Button size="sm" variant="outline" onClick={syncAll} disabled={syncAllBusy}>
                  {syncAllBusy ? 'Syncing…' : 'Sync All'}
                </Button>
              </Guard>
            </div>
          </div>
          {lastSync && (
            <Label as="div" size="xs" tone="muted" className="mt-1">
              Last staff sync: {lastSync}
            </Label>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-3">
            <div className="w-48">
              <Dropdown
                value={filterRole}
                onChange={setFilterRole}
                options={ROLE_OPTIONS}
                placeholder="All Roles"
              />
            </div>
            <Label as="label" className="flex items-center gap-2">
              <Checkbox
                checked={filterActive}
                onChange={(e) => setFilterActive(e.target.checked)}
              />{' '}
              Active
            </Label>
            <Label as="label" className="flex items-center gap-2">
              <Checkbox
                checked={filterSynced}
                onChange={(e) => setFilterSynced(e.target.checked)}
              />{' '}
              Synced to Buildium
            </Label>
          </div>
          {error && (
            <Body size="sm" className="text-destructive mb-3">
              {error}
            </Body>
          )}
          {loading ? (
            <Body tone="muted">Loading…</Body>
          ) : (
            <Table className="divide-border min-w-full divide-y">
              <TableHeader>
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
              <TableBody className="bg-card divide-border divide-y">
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="truncate">{s.first_name || '-'}</TableCell>
                    <TableCell className="truncate">{s.last_name || '-'}</TableCell>
                    <TableCell className="truncate">{s.title || '-'}</TableCell>
                    <TableCell className="truncate">{s.email || '-'}</TableCell>
                    <TableCell className="truncate">{s.phone || '-'}</TableCell>
                    <TableCell>
                      {ROLE_OPTIONS.find((r) => r.value === s.role)?.label || s.role}
                    </TableCell>
                    <TableCell>{s.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.buildium_staff_id != null && (
                          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-600">
                            Synced
                          </span>
                        )}
                        <EditLink onClick={() => openEdit(s)} />
                        <Guard require={'org_manager'}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncToBuildium(s.id)}
                            disabled={syncingId === s.id}
                          >
                            {syncingId === s.id ? 'Syncing…' : 'Sync'}
                          </Button>
                        </Guard>
                        <Button variant="outline" size="sm" onClick={() => remove(s.id)}>
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Body size="sm" tone="muted">
                        No staff yet.
                      </Body>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {syncError && (
        <Body size="sm" className="text-destructive">
          {syncError}
        </Body>
      )}

      {/* Staff Wizard */}
      <StaffWizardModal open={showModal} onOpenChange={setShowModal} onSaved={load} />
      {/* Edit Staff Modal */}
      <EditStaffModal staff={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function EditStaffModal({
  staff,
  onClose,
  onSaved,
}: {
  staff: Staff | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirst] = useState(staff?.first_name || '');
  const [lastName, setLast] = useState(staff?.last_name || '');
  const [email, setEmail] = useState(staff?.email || '');
  const [phone, setPhone] = useState(staff?.phone || '');
  const [title, setTitle] = useState(staff?.title || '');
  const [role, setRole] = useState(staff?.role || 'Property Manager');
  const [active, setActive] = useState(!!staff?.is_active);
  const [busy, setBusy] = useState(false);
  const [err, setError] = useState<string | null>(null);
  useEffect(() => {
    setFirst(staff?.first_name || '');
    setLast(staff?.last_name || '');
    setEmail(staff?.email || '');
    setPhone(staff?.phone || '');
    setTitle(staff?.title || '');
    setRole(staff?.role || 'Property Manager');
    setActive(!!staff?.is_active);
    setError(null);
  }, [staff]);
  const open = !!staff;
  const save = async () => {
    if (!staff) return;
    try {
      setBusy(true);
      setError(null);
      const normalizedRole = normalizeStaffRole(role);
      if (!normalizedRole) {
        throw new Error('Invalid role selected');
      }
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staff.id,
          firstName,
          lastName,
          email,
          phone,
          title,
          role: normalizedRole,
          isActive: active,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Save failed');
      onSaved();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="w-[680px] max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Edit Staff</DialogTitle>
        </DialogHeader>
        {staff && (
          <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1 block">First Name</Label>
                <Input value={firstName} onChange={(e) => setFirst(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLast(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <Label className="mb-1 block">Role</Label>
                <Dropdown value={role} onChange={setRole} options={ROLE_OPTIONS} />
              </div>
            <Label as="label" className="flex items-center gap-2 self-end md:col-span-1">
                <Checkbox
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{' '}
                Active
              </Label>
            </div>
            {err && (
              <Body size="sm" className="text-destructive">
                {err}
              </Body>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="cancel" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

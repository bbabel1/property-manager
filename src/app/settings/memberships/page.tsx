"use client"
import { useState } from 'react'
import { Guard } from '@/components/Guard'

export default function MembershipsPage() {
  const [userId, setUserId] = useState('')
  const [orgId, setOrgId] = useState('')
  const [role, setRole] = useState('org_staff')
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, org_id: orgId, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Request failed')
      setResult('Saved')
    } catch (err: any) {
      setResult(err?.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Guard require={'org_admin'}>
      <div className="max-w-xl">
        <h1 className="text-lg font-semibold mb-4">Organization Memberships</h1>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">User ID</label>
            <input className="w-full border rounded px-2 py-1" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="auth.users.id" />
          </div>
          <div>
            <label className="block text-sm mb-1">Org ID</label>
            <input className="w-full border rounded px-2 py-1" value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="organizations.id" />
          </div>
          <div>
            <label className="block text-sm mb-1">Role</label>
            <select className="w-full border rounded px-2 py-1" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="org_staff">org_staff</option>
              <option value="org_manager">org_manager</option>
              <option value="org_admin">org_admin</option>
              <option value="platform_admin">platform_admin</option>
              <option value="owner_portal">owner_portal</option>
              <option value="tenant_portal">tenant_portal</option>
            </select>
          </div>
          <button disabled={busy} className="px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50" type="submit">
            {busy ? 'Saving...' : 'Save'}
          </button>
          {result && <div className="text-sm text-muted-foreground">{result}</div>}
        </form>
      </div>
    </Guard>
  )
}


import Link from 'next/link'
import { Settings, Users, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Users className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Users & Roles</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Manage users, organizations, and role assignments.</p>
            <Link href="/settings/users" className="text-primary underline">Open Users & Roles</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <ShieldCheck className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Memberships (Quick Assign)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Assign a single user to an organization with a role.</p>
            <Link href="/settings/memberships" className="text-primary underline">Open Memberships</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

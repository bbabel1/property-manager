import Link from 'next/link'
import { Bell, CreditCard, ShieldCheck, UserCog, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Personal settings cover how you experience Ora. Workspace settings cover how your organization runs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <UserCog className="mr-2 h-5 w-5 text-primary" />
              <CardTitle>My Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Personal info, contact details, landing page, and notification defaults.
            </p>
            <Link href="/settings/profile" className="text-primary underline">
              Go to My Profile
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Bell className="mr-2 h-5 w-5 text-primary" />
              <CardTitle>Notifications & Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Fine-tune alerts, verification, and two-factor authentication.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href="/settings/notifications" className="text-primary underline">
                Notifications
              </Link>
              <Link href="/settings/security" className="text-primary underline">
                Security
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Users className="mr-2 h-5 w-5 text-primary" />
              <CardTitle>Team & Roles</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Invite teammates, assign roles, and manage org memberships.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href="/settings/users" className="text-primary underline">
                Users & Roles
              </Link>
              <Link href="/settings/memberships" className="text-primary underline">
                Quick assign
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center">
              <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
              <CardTitle>Organization</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Org profile, association defaults, and compliance preferences.
            </p>
            <Link href="/settings/organization" className="text-primary underline">
              Open Organization
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5 text-primary" />
              <CardTitle>Billing & Integrations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Plans, invoices, and workspace integrations like Buildium and Square.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href="/settings/billing" className="text-primary underline">
                Billing
              </Link>
              <Link href="/settings/integrations" className="text-primary underline">
                Integrations
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

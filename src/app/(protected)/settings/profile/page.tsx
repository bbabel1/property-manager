"use client"

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/components/providers'
import type { AppRole } from '@/lib/auth/roles'
import { RoleRank } from '@/lib/auth/roles'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type CompletionStep = { key: string; label: string; done: boolean }
type NotificationPrefs = { critical?: boolean; financial?: boolean; compliance?: boolean }
type PersonalIntegrations = { calendar?: boolean; email_logging?: boolean }

type ProfileMetadata = {
  full_name?: string
  name?: string
  first_name?: string
  last_name?: string
  display_name?: string
  phone?: string
  mobile?: string
  avatar_url?: string
  favorite_properties?: string[]
  landing_page?: string
  timezone?: string
  locale?: string
  date_format?: string
  currency?: string
  number_format?: string
  two_factor_enabled?: boolean
  notification_preferences?: NotificationPrefs
  personal_integrations?: PersonalIntegrations
  primary_work_role?: AppRole
}

const WORK_ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'org_admin', label: 'Administrator' },
  { value: 'org_manager', label: 'Property Manager' },
  { value: 'org_staff', label: 'Staff' },
  { value: 'owner_portal', label: 'Owner / Investor' },
  { value: 'tenant_portal', label: 'Resident / Tenant' },
  { value: 'vendor_portal', label: 'Maintenance / Vendor' },
  { value: 'platform_admin', label: 'Platform Admin' },
]

const LANDING_PAGES = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'properties', label: 'Properties' },
  { value: 'maintenance', label: 'Work Orders' },
  { value: 'financials', label: 'Financials' },
  { value: 'board', label: 'Board / Association' },
]

const TIMEZONE_OPTIONS = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC']
const LOCALE_OPTIONS = ['en-US', 'en-GB', 'es-ES', 'fr-CA']
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY']
const NUMBER_FORMATS = ['1,234.00', '1.234,00']
const CURRENCIES = ['USD', 'CAD', 'EUR']

const roleLabel = (role: AppRole | string): string => {
  switch (role) {
    case 'platform_admin':
      return 'Platform Admin'
    case 'org_admin':
      return 'Administrator'
    case 'org_manager':
      return 'Property Manager'
    case 'org_staff':
      return 'Staff'
    case 'owner_portal':
      return 'Owner / Investor'
    case 'tenant_portal':
      return 'Resident / Tenant'
    case 'vendor_portal':
      return 'Maintenance / Vendor'
    default:
      return role
  }
}

const buildInitials = (value?: string | null) => {
  const fallback = (value || '').trim()
  if (!fallback) return 'U'
  const parts = fallback.includes('@')
    ? [fallback[0], fallback.split('@')[0].slice(-1)]
    : fallback.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || 'U'
  const second = parts[1]?.[0] || parts[0]?.[1] || ''
  return (first + (second || '')).toUpperCase()
}

export default function ProfilePage() {
  const { user } = useAuth()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const meta = (user?.user_metadata ?? {}) as ProfileMetadata
  const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>
  const claims = (appMeta?.claims ?? {}) as Record<string, unknown>
  const roles =
    ((claims as { roles?: AppRole[] })?.roles ??
      (appMeta as { roles?: AppRole[] })?.roles ??
      []) || []
  const orgRoles = ((claims as { org_roles?: Record<string, AppRole[]> })?.org_roles ?? {}) as Record<
    string,
    AppRole[]
  >

  const displayNameFromMeta =
    meta.full_name ||
    meta.name ||
    `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim() ||
    user?.email ||
    'Signed in'
  const initials = buildInitials(displayNameFromMeta)

  const existingNotifications = meta.notification_preferences || {}
  const existingIntegrations = meta.personal_integrations || {}

  const [fullName, setFullName] = useState(displayNameFromMeta)
  const [displayName, setDisplayName] = useState(meta.display_name || '')
  const [primaryWorkRole, setPrimaryWorkRole] = useState<AppRole>(
    roles.sort((a, b) => (RoleRank[b] ?? 0) - (RoleRank[a] ?? 0))[0] || 'org_manager',
  )
  const [favoriteProperties, setFavoriteProperties] = useState<string[]>(
    Array.isArray(meta.favorite_properties) ? (meta.favorite_properties as string[]) : [],
  )
  const [landingPage, setLandingPage] = useState<string>(meta.landing_page || 'dashboard')
  const [phone, setPhone] = useState<string>(meta.phone || meta.mobile || '')
  const [timezone, setTimezone] = useState<string>(
    meta.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
  )
  const [locale, setLocale] = useState<string>(meta.locale || 'en-US')
  const [dateFormat, setDateFormat] = useState<string>(meta.date_format || 'MM/DD/YYYY')
  const [currency, setCurrency] = useState<string>(meta.currency || 'USD')
  const [numberFormat, setNumberFormat] = useState<string>(meta.number_format || '1,234.00')
  const [notificationSnapshot, setNotificationSnapshot] = useState({
    critical: Boolean(existingNotifications.critical ?? true),
    financial: Boolean(existingNotifications.financial ?? true),
    compliance: Boolean(existingNotifications.compliance ?? false),
  })
  const [calendarConnected, setCalendarConnected] = useState<boolean>(Boolean(existingIntegrations.calendar))
  const [emailLogging, setEmailLogging] = useState<boolean>(Boolean(existingIntegrations.email_logging))
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(meta.two_factor_enabled))
  const [savingArea, setSavingArea] = useState<string | null>(null)

  const completionSteps: CompletionStep[] = useMemo(() => {
    return [
      { key: 'avatar', label: 'Upload profile photo', done: Boolean(meta.avatar_url) },
      { key: 'mobile', label: 'Add mobile number', done: Boolean(phone) },
      { key: 'email', label: 'Verify email', done: Boolean(user?.email_confirmed_at) },
      { key: '2fa', label: 'Enable 2FA', done: twoFactorEnabled },
      { key: 'notifications', label: 'Set notification preferences', done: notificationSnapshot.critical },
    ]
  }, [meta.avatar_url, notificationSnapshot.critical, phone, twoFactorEnabled, user?.email_confirmed_at])

  const completed = completionSteps.filter((step) => step.done).length
  const completionPercent = Math.round((completed / completionSteps.length) * 100)

  const orgSummaries = useMemo(
    () =>
      Object.entries(orgRoles || {}).map(([orgId, orgRoleList]) => ({
        orgId,
        roles: (orgRoleList as AppRole[]).map(roleLabel),
      })),
    [orgRoles],
  )

  const saveMetadata = async (area: string, patch: Partial<ProfileMetadata>) => {
    if (!user) return
    setSavingArea(area)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), ...patch },
      })
      if (error) {
        toast.error(`Could not save ${area}`, { description: error.message })
        return
      }
      toast.success(`${area} saved`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Could not save ${area}`, { description: message })
    } finally {
      setSavingArea(null)
    }
  }

  const toggleFavoriteProperty = (value: string) => {
    setFavoriteProperties((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal info, contact details, and how Ora talks to you.
          </p>
        </div>
        <div className="w-full max-w-sm rounded-lg border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm font-medium text-foreground">
            <span>Profile completeness</span>
            <span>{completionPercent}%</span>
          </div>
          <Progress value={completionPercent} className="mt-2" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {completionSteps.map((step) => (
              <div key={step.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]',
                    step.done ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                  )}
                >
                  {step.done ? '✓' : ''}
                </span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Profile Overview</CardTitle>
              <p className="text-sm text-muted-foreground">
                These details appear to other users in messages, tasks, and approvals.
              </p>
            </div>
            <Badge variant="secondary">Personal</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Avatar className="h-16 w-16">
                {meta.avatar_url ? <AvatarImage src={meta.avatar_url} alt={fullName} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="text-sm font-medium">{displayNameFromMeta}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.info('Avatar upload coming soon')}>
                    Upload photo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toast.info('Initials fallback will be used')}>
                    Use initials
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  placeholder="Shown in comments and messages"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary role</Label>
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2.5 text-sm">
                  <Badge variant="outline">{roleLabel(primaryWorkRole)}</Badge>
                  <span className="text-muted-foreground">Driven by your RBAC assignment</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Associated organizations</Label>
                {orgSummaries.length ? (
                  <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
                    {orgSummaries.map((org) => (
                      <div key={org.orgId} className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-foreground">{org.orgId}</div>
                          <div className="text-xs text-muted-foreground">Roles: {org.roles.join(', ')}</div>
                        </div>
                        <Badge variant="outline">Org</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
                    Your organization memberships will appear here from your role assignments.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveMetadata('Profile overview', {
                    full_name: fullName,
                    display_name: displayName,
                    primary_work_role: primaryWorkRole,
                  })
                }
                disabled={savingArea === 'Profile overview'}
              >
                {savingArea === 'Profile overview' ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Contact &amp; Identity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Login email, mobile for SMS alerts, and how dates and currency display.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span>{user?.email}</span>
                  <Badge variant={user?.email_confirmed_at ? 'default' : 'destructive'} className="capitalize">
                    {user?.email_confirmed_at ? 'Verified' : 'Not verified'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Primary login</span>
                  <span>•</span>
                  <span>Changes trigger verification</span>
                </div>
                <div>
                  <Button size="sm" variant="outline" onClick={() => toast.info('Email change flow coming soon')}>
                    Change email
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Used for SMS alerts and two-factor.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used for notification scheduling and due dates.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="locale">Locale</Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger id="locale">
                    <SelectValue placeholder="Select locale" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_OPTIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger id="dateFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>
                        {fmt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((cur) => (
                      <SelectItem key={cur} value={cur}>
                        {cur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberFormat">Number formatting</Label>
              <Select value={numberFormat} onValueChange={setNumberFormat}>
                <SelectTrigger id="numberFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUMBER_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveMetadata('Contact & identity', {
                    phone,
                    mobile: phone,
                    timezone,
                    locale,
                    date_format: dateFormat,
                    currency,
                    number_format: numberFormat,
                    two_factor_enabled: twoFactorEnabled,
                  })
                }
                disabled={savingArea === 'Contact & identity'}
              >
                {savingArea === 'Contact & identity' ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Role &amp; Work Context</CardTitle>
              <p className="text-sm text-muted-foreground">
                Personalize dashboards, default filters, and where you land first.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="workRole">Primary work role</Label>
                <Select value={primaryWorkRole} onValueChange={(value) => setPrimaryWorkRole(value as AppRole)}>
                  <SelectTrigger id="workRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="landingPage">Default landing page</Label>
                <Select value={landingPage} onValueChange={setLandingPage}>
                  <SelectTrigger id="landingPage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANDING_PAGES.map((page) => (
                      <SelectItem key={page.value} value={page.value}>
                        {page.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used to personalize dashboards, filters, and what you see first when you log in.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Properties / associations I care about most</Label>
              <div className="flex flex-wrap gap-2">
                {['Top portfolio', 'Board favorites', 'Maintenance-heavy'].map((item) => {
                  const active = favoriteProperties.includes(item)
                  return (
                    <Button
                      key={item}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className={cn('rounded-full', active ? '' : 'bg-muted/40 text-foreground')}
                      onClick={() => toggleFavoriteProperty(item)}
                    >
                      {active ? '✓ ' : ''}
                      {item}
                    </Button>
                  )
                })}
                {!favoriteProperties.length ? (
                  <span className="text-xs text-muted-foreground">
                    We&apos;ll surface your real properties from org assignments.
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveMetadata('Role & work context', {
                    primary_work_role: primaryWorkRole,
                    landing_page: landingPage,
                    favorite_properties: favoriteProperties,
                  })
                }
                disabled={savingArea === 'Role & work context'}
              >
                {savingArea === 'Role & work context' ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Notification Snapshot</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quick view of your critical channels. Manage the full matrix in notifications.
              </p>
            </div>
            <Badge variant="outline">Personal</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { key: 'critical', label: 'Critical alerts (failed rent, urgent work orders)', value: notificationSnapshot.critical },
                { key: 'financial', label: 'Financial summaries (owner statements, draws)', value: notificationSnapshot.financial },
                { key: 'compliance', label: 'Board & compliance notices', value: notificationSnapshot.compliance },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{row.label}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Email</Badge>
                      <Badge variant="outline">SMS</Badge>
                      <Badge variant="outline">In-app</Badge>
                    </div>
                  </div>
                  <Switch
                    checked={row.value}
                    onCheckedChange={(checked) =>
                      setNotificationSnapshot((prev) => ({ ...prev, [row.key]: checked }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-muted-foreground">Need more control? Adjust channels per event.</div>
              <Link href="/settings/notifications" className="text-primary underline">
                Manage full notification settings →
              </Link>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveMetadata('Notification snapshot', {
                    notification_preferences: notificationSnapshot as NotificationPrefs,
                  })
                }
                disabled={savingArea === 'Notification snapshot'}
              >
                {savingArea === 'Notification snapshot' ? 'Saving...' : 'Save snapshot'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Personal Integrations</CardTitle>
              <p className="text-sm text-muted-foreground">
                These follow you, not the workspace. Org-level integrations live under Workspace → Integrations.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'calendar',
                title: 'Calendar (Google / Outlook)',
                description: 'Sync tasks and key dates to your calendar.',
                connected: calendarConnected,
                onToggle: setCalendarConnected,
              },
              {
                key: 'email',
                title: 'Email logging',
                description: 'Let Ora log relevant email threads with tenants, owners, and vendors.',
                connected: emailLogging,
                onToggle: setEmailLogging,
              },
            ].map((integration) => (
              <div
                key={integration.key}
                className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-foreground">{integration.title}</div>
                    <Badge variant={integration.connected ? 'default' : 'outline'}>
                      {integration.connected ? 'Connected' : 'Not connected'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                  {integration.connected ? (
                    <p className="text-xs text-muted-foreground">Last sync: moments ago</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={integration.connected ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => {
                      integration.onToggle(!integration.connected)
                      toast.success(
                        integration.connected ? 'Disconnected' : 'Connected',
                        { description: `${integration.title} toggled locally.` },
                      )
                    }}
                  >
                    {integration.connected ? 'Manage' : 'Connect'}
                  </Button>
                  {integration.connected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        integration.onToggle(false)
                        toast.success('Disconnected', { description: `${integration.title} disconnected locally.` })
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  saveMetadata('Personal integrations', {
                    personal_integrations: {
                      calendar: calendarConnected,
                      email_logging: emailLogging,
                    },
                  })
                }
                disabled={savingArea === 'Personal integrations'}
              >
                {savingArea === 'Personal integrations' ? 'Saving...' : 'Save integrations'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

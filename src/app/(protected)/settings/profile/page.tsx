"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/components/providers'
import type { AppRole } from '@/lib/auth/roles'
import { RoleRank } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'

type CompletionStep = { key: string; label: string; done: boolean }
type NotificationPrefs = { critical?: boolean; financial?: boolean; compliance?: boolean }
type OrgMembership = { org_id: string; role: AppRole }

type UserProfile = {
  user_id: string
  contact_id?: number
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  display_name?: string | null
  phone?: string | null
  timezone?: string | null
  locale?: string | null
  date_format?: string | null
  currency?: string | null
  number_format?: string | null
  notification_preferences?: NotificationPrefs
  favorite_properties?: string[]
  landing_page?: string | null
  avatar_url?: string | null
  two_factor_enabled?: boolean | null
  primary_work_role?: AppRole | null
  updated_at?: string | null
  email?: string | null
}

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

// Use common timezones from the static registry (no DB query)
import { getCommonTimezones } from '@/lib/timezones'
const TIMEZONE_OPTIONS = getCommonTimezones()
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
  const meta = (user?.user_metadata ?? {}) as ProfileMetadata
  const appMeta = useMemo(() => (user?.app_metadata ?? {}) as Record<string, unknown>, [user?.app_metadata])
  const claims = useMemo(() => (appMeta?.claims ?? {}) as Record<string, unknown>, [appMeta])
  const roles =
    ((claims as { roles?: AppRole[] })?.roles ??
      (appMeta as { roles?: AppRole[] })?.roles ??
      []) || []
  const isAdmin = roles.includes('platform_admin') || roles.includes('org_admin')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const orgRoles = useMemo(
    () =>
      ((claims as { org_roles?: Record<string, AppRole[]> })?.org_roles ?? {}) as Record<string, AppRole[]>,
    [claims],
  )

  const displayNameFromMeta =
    meta.full_name ||
    meta.name ||
    `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim() ||
    user?.email ||
    'Signed in'

  const existingNotifications = meta.notification_preferences || {}

  const [profileLoading, setProfileLoading] = useState<boolean>(true)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [orgMemberships, setOrgMemberships] = useState<OrgMembership[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(meta.avatar_url ?? null)
  const [fullName, setFullName] = useState(displayNameFromMeta)
  const [displayName, setDisplayName] = useState(meta.display_name || '')
  const [primaryWorkRole, setPrimaryWorkRole] = useState<AppRole>(
    roles.sort((a, b) => (RoleRank[b] ?? 0) - (RoleRank[a] ?? 0))[0] || 'org_manager',
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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(meta.two_factor_enabled))
  const [savingArea, setSavingArea] = useState<string | null>(null)
  const nameForInitials = displayName || fullName || displayNameFromMeta
  const initials = useMemo(() => buildInitials(nameForInitials), [nameForInitials])

  const handleAvatarSelect = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Upload failed')
      }
      const data = (await response.json()) as { profile?: UserProfile; memberships?: OrgMembership[]; error?: string }
      if (data.error) throw new Error(data.error)
      if (data.profile) {
        applyProfile(data.profile)
      }
      if (Array.isArray(data.memberships)) setOrgMemberships(data.memberships)
      toast.success('Profile photo updated')
    } catch (error) {
      console.error(error)
      toast.error('Could not upload photo', { description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const completionSteps: CompletionStep[] = useMemo(() => {
    return [
      { key: 'avatar', label: 'Upload profile photo', done: Boolean(avatarUrl) },
      { key: 'mobile', label: 'Add mobile number', done: Boolean(phone) },
      { key: 'email', label: 'Verify email', done: Boolean(user?.email_confirmed_at) },
      { key: '2fa', label: 'Enable 2FA', done: twoFactorEnabled },
      { key: 'notifications', label: 'Set notification preferences', done: notificationSnapshot.critical },
    ]
  }, [avatarUrl, notificationSnapshot.critical, phone, twoFactorEnabled, user?.email_confirmed_at])

  const completed = completionSteps.filter((step) => step.done).length
  const completionPercent = Math.round((completed / completionSteps.length) * 100)

  const orgSummaries = useMemo(() => {
    if (orgMemberships.length) {
      return orgMemberships.map((membership) => ({
        orgId: membership.org_id,
        roles: [roleLabel(membership.role)],
      }))
    }
    return Object.entries(orgRoles || {}).map(([orgId, orgRoleList]) => ({
      orgId,
      roles: (orgRoleList as AppRole[]).map(roleLabel),
    }))
  }, [orgMemberships, orgRoles])

  const applyProfile = useCallback(
    (profile?: UserProfile | null) => {
      if (!profile) return
      if (profile.full_name) setFullName(profile.full_name)
      if (profile.display_name !== undefined && profile.display_name !== null) setDisplayName(profile.display_name)
      if (profile.primary_work_role) setPrimaryWorkRole(profile.primary_work_role)
      if (profile.avatar_url !== undefined && profile.avatar_url !== null) setAvatarUrl(profile.avatar_url)
      if (profile.landing_page) setLandingPage(profile.landing_page)
      if (profile.phone !== undefined && profile.phone !== null) setPhone(profile.phone)
      if (profile.timezone) setTimezone(profile.timezone)
      if (profile.locale) setLocale(profile.locale)
      if (profile.date_format) setDateFormat(profile.date_format)
      if (profile.currency) setCurrency(profile.currency)
      if (profile.number_format) setNumberFormat(profile.number_format)
      if (profile.notification_preferences) {
        setNotificationSnapshot({
          critical: Boolean(profile.notification_preferences.critical),
          financial: Boolean(profile.notification_preferences.financial),
          compliance: Boolean(profile.notification_preferences.compliance),
        })
      }
      if (typeof profile.two_factor_enabled === 'boolean') setTwoFactorEnabled(profile.two_factor_enabled)
      if (profile.updated_at) setLastSyncedAt(profile.updated_at)
      setSyncState('saved')
    },
    [],
  )

  const loadProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) throw new Error('Failed to load profile')
      const data = (await response.json()) as { profile?: UserProfile; memberships?: OrgMembership[] }
      if (data.profile) applyProfile(data.profile)
      if (Array.isArray(data.memberships)) setOrgMemberships(data.memberships)
    } catch (error) {
      console.error(error)
      setSyncState('error')
      toast.error('Could not load profile', { description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setProfileLoading(false)
    }
  }, [applyProfile])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const saveProfile = useCallback(
    async (area: string, patch: Partial<UserProfile>) => {
      setSavingArea(area)
      setSyncState('saving')
      try {
        const response = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || 'Failed to save profile')
        }
        const data = (await response.json()) as { profile?: UserProfile; memberships?: OrgMembership[]; error?: string }
        if (data.error) throw new Error(data.error)
        if (data.profile) applyProfile(data.profile)
        if (Array.isArray(data.memberships)) setOrgMemberships(data.memberships)
        toast.success(`${area} saved`)
        setSyncState('saved')
      } catch (error) {
        console.error(error)
        setSyncState('error')
        toast.error(`Could not save ${area}`, { description: error instanceof Error ? error.message : 'Unknown error' })
      } finally {
        setSavingArea(null)
      }
    },
    [applyProfile],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">Keep the essentials tidy and let Ora handle the rest.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">Personal profile</Badge>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-block h-2.5 w-2.5 rounded-full',
                syncState === 'saving'
                  ? 'bg-amber-500 animate-pulse'
                  : syncState === 'error'
                    ? 'bg-destructive'
                    : 'bg-emerald-500',
              )}
            />
            <span>
              {syncState === 'saving'
                ? 'Saving…'
                : syncState === 'error'
                  ? 'Sync issue'
                  : lastSyncedAt
                    ? `Synced ${new Date(lastSyncedAt).toLocaleString()}`
                    : 'Synced to your account'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px,1fr]">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Profile snapshot</CardTitle>
                  <p className="text-sm text-muted-foreground">A quick read on how others see you.</p>
                </div>
                <Badge variant="secondary">Personal</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-base font-semibold">
                      <span>{displayName || fullName || displayNameFromMeta}</span>
                      <Badge variant="outline">{roleLabel(primaryWorkRole)}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{user?.email}</span>
                      {phone ? <span>• {phone}</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {timezone} • {locale} • {currency}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void handleAvatarSelect(file)
                        event.target.value = ''
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar || profileLoading}
                  >
                    {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between text-xs font-medium text-foreground">
                  <span>
                    {completed} of {completionSteps.length} complete
                  </span>
                  <span>{completionPercent}%</span>
                </div>
                <Progress value={completionPercent} className="mt-2" />
                <div className="mt-3 space-y-2">
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Tabs defaultValue="essentials" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="essentials">Essentials</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="essentials" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>Identity &amp; contact</CardTitle>
                  <p className="text-sm text-muted-foreground">Lighten up your public details and region defaults.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
                    <div className="space-y-4">
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
                    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold">Login email</div>
                          <div className="text-sm text-muted-foreground">{user?.email}</div>
                        </div>
                        <Badge variant={user?.email_confirmed_at ? 'default' : 'destructive'} className="capitalize">
                          {user?.email_confirmed_at ? 'Verified' : 'Not verified'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Primary login; changes trigger verification.</span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isAdmin}
                          onClick={() => toast.info('Email change flow available to admins only')}
                        >
                          {isAdmin ? 'Change' : 'Admin only'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

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
                      <p className="text-xs text-muted-foreground">Controls reminders and due dates.</p>
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

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr,1fr]">
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
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-border/80 px-3 py-3">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-foreground">Two-factor sign-in</div>
                        <p className="text-xs text-muted-foreground">
                          Extra verification for logins and sensitive actions.
                        </p>
                      </div>
                      <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
                    </div>
                  </div>

                  <Accordion type="single" collapsible className="rounded-lg border border-border/70">
                    <AccordionItem value="orgs" className="border-none">
                      <AccordionTrigger className="px-3 py-2 text-sm font-semibold">
                        Access &amp; memberships
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 text-sm">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{roleLabel(primaryWorkRole)}</Badge>
                            <span className="text-muted-foreground">Driven by your RBAC assignment.</span>
                          </div>
                          {orgSummaries.length ? (
                            <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
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
                            <p className="text-xs text-muted-foreground">
                              Your organization memberships will appear here from your role assignments.
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="flex justify-end">
                    <Button
                      onClick={() =>
                        saveProfile('Profile basics', {
                          full_name: fullName,
                          display_name: displayName,
                          phone,
                          timezone,
                          locale,
                          date_format: dateFormat,
                          currency,
                          number_format: numberFormat,
                          two_factor_enabled: twoFactorEnabled,
                        })
                      }
                      disabled={savingArea === 'Profile basics' || profileLoading}
                    >
                      {savingArea === 'Profile basics' ? 'Saving...' : 'Save basics'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>Work defaults</CardTitle>
                  <p className="text-sm text-muted-foreground">Tune where you land and what you see first.</p>
                </CardHeader>
                <CardContent className="space-y-5">
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
                        Personalizes dashboards and filters when you sign in.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() =>
                        saveProfile('Work defaults', {
                          primary_work_role: primaryWorkRole,
                          landing_page: landingPage,
                        })
                      }
                      disabled={savingArea === 'Work defaults' || profileLoading}
                    >
                      {savingArea === 'Work defaults' ? 'Saving...' : 'Save defaults'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>Notifications &amp; automations</CardTitle>
                  <p className="text-sm text-muted-foreground">Keep the noise low and the signals strong.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {[
                      { key: 'critical', label: 'Critical alerts', helper: 'Failed rent, urgent work orders', value: notificationSnapshot.critical },
                      { key: 'financial', label: 'Financial summaries', helper: 'Owner statements and draws', value: notificationSnapshot.financial },
                      { key: 'compliance', label: 'Board & compliance', helper: 'Notices and approvals', value: notificationSnapshot.compliance },
                    ].map((row) => (
                      <div
                        key={row.key}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-3"
                      >
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-foreground">{row.label}</div>
                          <div className="text-xs text-muted-foreground">{row.helper}</div>
                          <div className="flex flex-wrap gap-2">
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
                    <Link href="/settings/notifications" className="text-primary underline">
                      Open advanced notification matrix →
                    </Link>
                    <Button
                      onClick={() =>
                        saveProfile('Preferences & automations', {
                          notification_preferences: notificationSnapshot as NotificationPrefs,
                        })
                      }
                      disabled={savingArea === 'Preferences & automations' || profileLoading}
                    >
                      {savingArea === 'Preferences & automations' ? 'Saving...' : 'Save preferences'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

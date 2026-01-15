"use client"

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/components/providers'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Body, Heading, Label } from '@/ui/typography'

const RECENT_LOGINS = [
  { device: 'MacBook Pro · Safari', location: 'Brooklyn, NY', time: 'Today, 8:12 AM', current: true },
  { device: 'iPhone · Mobile Safari', location: 'Brooklyn, NY', time: 'Yesterday, 5:40 PM' },
  { device: 'Windows · Chrome', location: 'Queens, NY', time: '2 days ago, 1:22 PM' },
]

export default function SecurityPage() {
  const { user } = useAuth()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>

  const [twoFactorSms, setTwoFactorSms] = useState(Boolean(meta['two_factor_sms']))
  const [twoFactorTotp, setTwoFactorTotp] = useState(Boolean(meta['two_factor_totp']))
  const [smsNumber, setSmsNumber] = useState(typeof meta['two_factor_phone'] === 'string' ? (meta['two_factor_phone'] as string) : '')
  const [saving, setSaving] = useState(false)

  const handleSaveSecurity = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          two_factor_sms: twoFactorSms,
          two_factor_totp: twoFactorTotp,
          two_factor_phone: smsNumber,
        },
      })
      if (error) {
        toast.error('Could not save security preferences', { description: error.message })
        return
      }
      toast.success('Security preferences saved')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Could not save security preferences', { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Heading as="h1" size="h3" className="font-bold">
          Security
        </Heading>
        <Body tone="muted" size="sm">
          Keep your account protected with two-factor authentication and session visibility.
        </Body>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Password &amp; login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Body tone="muted" size="sm">
            Ora uses Supabase auth. Send yourself a password reset to change your login password.
          </Body>
          <Button onClick={() => toast.info('Password reset', { description: 'Send reset via Supabase auth API.' })}>
            Email me a reset link
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <Body as="div" size="sm" className="font-medium">
                  SMS verification
                </Body>
                <Label as="p" size="xs" tone="muted">
                  Secure sign-in codes and critical alerts.
                </Label>
              </div>
              <Switch checked={twoFactorSms} onCheckedChange={setTwoFactorSms} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smsNumber">Mobile number</Label>
                <Input
                  id="smsNumber"
                  placeholder="+1 (555) 123-4567"
                  value={smsNumber}
                  onChange={(e) => setSmsNumber(e.target.value)}
                  disabled={!twoFactorSms}
                />
              </div>
              <div className="space-y-2">
                <Label>Backup codes</Label>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!twoFactorSms}
                  onClick={() => toast.info('Backup codes', { description: 'Generate single-use backup codes.' })}
                >
                  Generate codes
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <Body as="div" size="sm" className="font-medium">
                  Authenticator app
                </Body>
                <Label as="p" size="xs" tone="muted">
                  Use Google Authenticator, 1Password, or Duo.
                </Label>
              </div>
              <Switch checked={twoFactorTotp} onCheckedChange={setTwoFactorTotp} />
            </div>
            <Label as="p" size="xs" tone="muted">
              Turn on to display a QR code and secret key. We’ll respect existing SMS or TOTP 2FA during sign-in.
            </Label>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSecurity} disabled={saving}>
              {saving ? 'Saving...' : 'Save security preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {RECENT_LOGINS.map((row) => (
            <div
              key={`${row.device}-${row.time}`}
              className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Body as="div" size="sm" className="flex flex-wrap items-center gap-2 font-medium">
                  <span>{row.device}</span>
                  {row.current ? <Badge variant="outline">This device</Badge> : null}
                </Body>
                <Label as="div" size="xs" tone="muted">
                  {row.location} • {row.time}
                </Label>
              </div>
              {!row.current ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toast.info('Session revoked', { description: `Session for ${row.device} will be logged out.` })
                  }
                >
                  Revoke
                </Button>
              ) : null}
            </div>
          ))}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => toast.info('Log out others')}>
              Log out of other devices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

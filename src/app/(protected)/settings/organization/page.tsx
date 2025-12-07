"use client"

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function OrganizationPage() {
  const [name, setName] = useState('Ora Property Management')
  const [timezone, setTimezone] = useState('America/New_York')
  const [currency, setCurrency] = useState('USD')
  const [portfolioType, setPortfolioType] = useState('mixed')

  const handleSave = () => {
    toast.success('Organization settings saved', {
      description: 'Connect to your Supabase org profile update endpoint next.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Organization</h1>
        <p className="text-sm text-muted-foreground">
          Define how your workspace is identified across statements, emails, and resident portals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Org profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization name</Label>
            <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Default timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                  <SelectItem value="America/Denver">America/Denver</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Default currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolioType">Portfolio type</Label>
            <Select value={portfolioType} onValueChange={setPortfolioType}>
              <SelectTrigger id="portfolioType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed (PM + associations)</SelectItem>
                <SelectItem value="pm">Property management</SelectItem>
                <SelectItem value="hoa">Condo / HOA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            These defaults inform statement templates, notifications, and onboarding flows for residents, owners, and board members.
          </p>
          <div className="flex justify-end">
            <Button onClick={handleSave}>Save organization profile</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

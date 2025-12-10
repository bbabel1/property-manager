"use client"

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { PageShell, PageHeader, PageBody, Stack } from '@/components/layout/page-shell'

type Program = {
  id: string
  org_id: string
  template_id: string | null
  code: string
  name: string
  jurisdiction: string
  frequency_months: number
  lead_time_days: number
  applies_to: 'property' | 'asset' | 'both'
  severity_score: number
  is_enabled: boolean
  notes: string | null
  template?: {
    code: string
    name: string
    jurisdiction: string
    frequency_months: number
    lead_time_days: number
    applies_to: 'property' | 'asset' | 'both'
    severity_score: number
  }
}

export default function ComplianceProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const loadPrograms = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/compliance/programs')
      if (!res.ok) throw new Error('Failed to load programs')
      const data = await res.json()
      setPrograms(data.programs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrograms()
  }, [])

  const toggleProgram = async (programId: string, nextEnabled: boolean) => {
    try {
      const res = await fetch(`/api/compliance/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: nextEnabled }),
      })
      if (!res.ok) throw new Error('Failed to update program')
      const data = await res.json()
      setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, ...data.program } : p)))
      toast.success(`Program ${nextEnabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update program')
    }
  }

  const generateItems = async (programId: string) => {
    try {
      setGeneratingId(programId)
      const res = await fetch(`/api/compliance/programs/${programId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periods_ahead: 12 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate items')

      toast.success('Compliance items generated', {
        description: `Created ${data.items_created}, skipped ${data.items_skipped}`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate items')
    } finally {
      setGeneratingId(null)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Compliance Programs" />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Compliance Programs" />
        <PageBody>
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Error: {error}</p>
            <Button onClick={loadPrograms} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </PageBody>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Compliance Programs" />
      <PageBody>
        <Stack gap="lg">
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div><strong>Programs</strong> are the rulebooks (NYC DOB/HPD/FDNY requirements).</div>
              <div><strong>Items</strong> are the generated reminders/todos per building or asset.</div>
              <div><strong>Events</strong> are real-world inspections and filings pulled from NYC data.</div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {programs.map((program) => (
              <Card key={program.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {program.name}
                      <Badge variant="outline">{program.jurisdiction}</Badge>
                      <Badge variant="outline">{program.applies_to === 'asset' ? 'Asset' : 'Property'} scope</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{program.code}</p>
                    <p className="text-xs text-muted-foreground">
                      Every {program.frequency_months} month(s); lead time {program.lead_time_days} days; severity {program.severity_score}/5
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={program.is_enabled}
                      onCheckedChange={(checked) => toggleProgram(program.id, checked)}
                    />
                    <Badge variant={program.is_enabled ? 'outline' : 'secondary'}>
                      {program.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {program.is_enabled ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>
                      {program.is_enabled
                        ? 'New items will be generated for applicable buildings/assets.'
                        : 'Items will not be generated until enabled.'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generatingId === program.id}
                    onClick={() => generateItems(program.id)}
                  >
                    {generatingId === program.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Generate items
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </Stack>
      </PageBody>
    </PageShell>
  )
}

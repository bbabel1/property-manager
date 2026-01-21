import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, RefreshCw, Sparkles } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Body, Label } from '@/ui/typography'
import { cn } from '@/components/ui/utils'
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch'

type Draft = {
  id: string
  property_id: string
  status: string
  progress: number
  createdAt: string
  updatedAt: string
  properties?: {
    id: string
    name: string
    address_line1: string | null
    city: string | null
    state: string | null
    postal_code: string | null
  }
}

type Props = {
  onStartNew: () => void
  onResume: (draftId: string) => void
}

function formatAddress(draft: Draft): string {
  const parts = [
    draft.properties?.address_line1,
    draft.properties?.city,
    draft.properties?.state,
    draft.properties?.postal_code,
  ].filter(Boolean)
  return parts.join(', ') || 'Address pending'
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'READY_TO_SEND' || status === 'AGREEMENT_SENT'
      ? 'bg-green-100 text-green-800'
      : status === 'UNITS_ADDED' || status === 'OWNERS_ADDED'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-amber-100 text-amber-800'
  return <Badge className={cn('capitalize', tone)}>{status.replace(/_/g, ' ').toLowerCase()}</Badge>
}

export default function OnboardingBoard({ onStartNew, onResume }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDrafts = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchWithSupabaseAuth('/api/onboarding?limit=50', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load drafts (${res.status})`)
      const json = await res.json()
      setDrafts(Array.isArray(json?.drafts) ? json.drafts : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDrafts()
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Onboarding drafts</CardTitle>
          <Body size="sm" tone="muted">
            Resume an in-progress onboarding or start a new one.
          </Body>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadDrafts} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 border-destructive/30 mb-3 rounded-md border px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading drafts…
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-3">
            <div>
              <Body size="sm">No onboarding drafts yet.</Body>
              <Body size="xs" tone="muted">
                Start a new onboarding to see it here.
              </Body>
            </div>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {drafts.map((draft) => (
              <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <Label size="sm">{draft.properties?.name || 'Untitled property'}</Label>
                  <Body size="xs" tone="muted">
                    {formatAddress(draft)}
                  </Body>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={draft.status} />
                  <Body size="xs" tone="muted">
                    Progress {draft.progress ?? 0}%
                  </Body>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="inline-flex items-center gap-1"
                    onClick={() => onResume(draft.id)}
                  >
                    Resume
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/properties/${draft.property_id}`} className="inline-flex items-center gap-1">
                      View property
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

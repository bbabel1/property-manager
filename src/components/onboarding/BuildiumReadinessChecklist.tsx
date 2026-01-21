import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Body, Label } from '@/ui/typography'
import { Button } from '@/components/ui/button'

type Issue = { code: string; message: string; path?: string }

type ReadinessResponse = {
  ready: boolean
  issues: Issue[]
}

export default function BuildiumReadinessChecklist({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<ReadinessResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/buildium/readiness/${propertyId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load readiness (${res.status})`)
      const json = (await res.json()) as ReadinessResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load readiness')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-base">Buildium readiness</CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="bg-destructive/10 border-destructive/30 rounded-md border px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {loading && !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking requirements…
          </div>
        ) : data ? (
          <>
            <div className="flex items-center gap-2">
              {data.ready ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
              <Label size="sm">
                {data.ready
                  ? 'Ready to sync to Buildium'
                  : `${data.issues.length} requirement${data.issues.length === 1 ? '' : 's'} missing`}
              </Label>
            </div>
            {!data.ready && (
              <div className="space-y-2">
                {data.issues.map((issue) => (
                  <div
                    key={issue.code}
                    className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-amber-900">{issue.message}</div>
                    {issue.path ? (
                      <Body size="xs" tone="muted">
                        Field: {issue.path}
                      </Body>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <Body size="sm" tone="muted">
            No readiness data.
          </Body>
        )}
      </CardContent>
    </Card>
  )
}

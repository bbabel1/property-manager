'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Info, Sparkles } from 'lucide-react'

import AddPropertyModal from '@/components/AddPropertyModal'
import OnboardingBoard from '@/components/onboarding/OnboardingBoard'
import { useOnboardingFlag } from '@/hooks/useOnboardingFlag'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader, PageShell, Stack } from '@/components/layout/page-shell'
import { Body, Label } from '@/ui/typography'
import type { Signer } from '@/components/onboarding/OwnerSignerSection'
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch'

export default function OnboardingPage() {
  const onboardingEnabled = useOnboardingFlag()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null)
  const [resumeData, setResumeData] = useState<{
    onboardingId: string
    propertyId: string
    property?: {
      name?: string | null
      addressLine1?: string | null
      city?: string | null
      state?: string | null
      postalCode?: string | null
      country?: string | null
      propertyType?: string | null
      serviceAssignment?: string | null
    }
    signers?: Signer[]
  } | null>(null)

  useEffect(() => {
    if (!resumeDraftId || !onboardingEnabled) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchWithSupabaseAuth(`/api/onboarding/${resumeDraftId}`)
        if (!res.ok) throw new Error(`Failed to load draft (${res.status})`)
        const json = await res.json()
        const onboarding = json?.onboarding
        if (!onboarding || cancelled) return
        const prop = onboarding.property || onboarding.properties
        const stage = onboarding.currentStage || {}
        setResumeData({
          onboardingId: onboarding.id,
          propertyId: onboarding.propertyId,
          property: {
            name: prop?.name,
            addressLine1: prop?.address_line1 ?? prop?.addressLine1,
            city: prop?.city,
            state: prop?.state,
            postalCode: prop?.postal_code ?? prop?.postalCode,
            country: prop?.country,
            propertyType: prop?.property_type ?? prop?.propertyType,
            serviceAssignment: prop?.service_assignment ?? prop?.serviceAssignment,
          },
          signers: Array.isArray(stage.signers)
            ? stage.signers.map((s: any) => ({
                clientRowId: s.clientRowId || crypto.randomUUID(),
                email: s.email,
                name: s.name || '',
              }))
            : [],
        })
        setIsModalOpen(true)
      } catch (e) {
        console.error(e)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [resumeDraftId])

  return (
    <PageShell>
      <PageHeader
        title="Property Onboarding"
        description="Guided flow for creating properties, owners, units, and agreements."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/properties">Back to properties</Link>
          </Button>
        }
      />
      <PageBody>
        <Stack gap="md">
          {!onboardingEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Enable onboarding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Body size="sm">
                  Property onboarding is feature-flagged. Set
                  <code className="mx-1 rounded-sm bg-muted px-1 py-0.5 text-xs">
                    NEXT_PUBLIC_ENABLE_PROPERTY_ONBOARDING=true
                  </code>
                  and reload to surface the entry points.
                </Body>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Start onboarding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Body size="sm">Launch the onboarding wizard to create a property end-to-end.</Body>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setResumeData(null)
                        setResumeDraftId(null)
                        setIsModalOpen(true)
                      }}
                      className="inline-flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Start onboarding
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/properties" className="inline-flex items-center gap-2">
                        View properties
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <OnboardingBoard
                onStartNew={() => {
                  setResumeData(null)
                  setResumeDraftId(null)
                  setIsModalOpen(true)
                }}
                onResume={(draftId) => setResumeDraftId(draftId)}
              />
            </>
          )}
        </Stack>
      </PageBody>
      {onboardingEnabled && (
        <AddPropertyModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setResumeDraftId(null)
          }}
          onSuccess={() => setIsModalOpen(false)}
          onboardingMode
          resumeOnboarding={resumeData ?? undefined}
        />
      )}
    </PageShell>
  )
}

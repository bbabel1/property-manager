import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import InfoCard from '@/components/layout/InfoCard'

export default async function ReconciliationFallback({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseServerClient()
  const { data } = await supabase
    .from('reconciliation_log')
    .select('property_id')
    .eq('buildium_reconciliation_id', Number(id))
    .maybeSingle<{ property_id: string | null }>()

  const propertyId = (data as { property_id: string | null } | null)?.property_id

  if (propertyId) {
    redirect(`/properties/${propertyId}/reconciliations/${id}`)
  }

  return (
    <InfoCard title="Reconciliation">
      <p className="text-sm text-muted-foreground">Cannot resolve property context for reconciliation {id}. Try syncing reconciliations, then reload.</p>
    </InfoCard>
  )
}

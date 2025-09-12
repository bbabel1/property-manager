import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import InfoCard from '@/components/layout/InfoCard'

export default async function ReconciliationFallback({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServerClient()
  const { data } = await (supabase as any)
    .from('reconciliation_log')
    .select('property_id')
    .eq('buildium_reconciliation_id', Number(id))
    .maybeSingle()

  if (data?.property_id) {
    redirect(`/properties/${data.property_id}/reconciliations/${id}`)
  }

  return (
    <InfoCard title="Reconciliation">
      <p className="text-sm text-muted-foreground">Cannot resolve property context for reconciliation {id}. Try syncing reconciliations, then reload.</p>
    </InfoCard>
  )
}


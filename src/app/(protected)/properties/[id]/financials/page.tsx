import InfoCard from '@/components/layout/InfoCard'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export default async function FinancialsTab({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ as_of?: string }> }) {
  const { id } = await params
  const sp = (await (searchParams || Promise.resolve({}))) as any
  const asOf = sp?.as_of ? new Date(sp.as_of) : new Date()
  const supabase = getSupabaseServerClient()
  let snapshot: any = null
  try {
    const { data, error } = await (supabase as any).rpc('get_property_financials', { p_property_id: id, p_as_of: asOf.toISOString().slice(0,10) })
    if (!error) snapshot = data
  } catch {}

  const cash = snapshot?.cash_balance ?? 0
  const sec = snapshot?.security_deposits ?? 0
  const reserve = snapshot?.reserve ?? 0
  const avail = snapshot?.available_balance ?? (cash - sec - reserve)
  const asOfText = new Date(snapshot?.as_of || asOf).toLocaleDateString()

  return (
    <div id="panel-financials" role="tabpanel" aria-labelledby="financials" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-6 lg:col-span-2">
        <InfoCard title="Account Activity">
          <p className="text-muted-foreground">Coming soon: GL account activity and period statements.</p>
        </InfoCard>
      </div>
      <div className="space-y-6">
        <InfoCard title="Cash balance" className="rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground">Cash balance:</span>
            <span className="text-lg font-bold text-foreground">${Number(cash).toLocaleString()}</span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>- Security deposits and early payments:</span>
              <span>${Number(sec).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>- Property reserve:</span>
              <span>${Number(reserve).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-sm text-foreground">Available balance</span>
            <span className="text-sm font-bold text-foreground">${Number(avail).toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">as of {asOfText}</p>
        </InfoCard>
      </div>
    </div>
  )
}

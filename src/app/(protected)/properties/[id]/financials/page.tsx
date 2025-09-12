import InfoCard from '@/components/layout/InfoCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import DateRangeControls from '@/components/DateRangeControls'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth } from 'date-fns'

export default async function FinancialsTab({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ from?: string; to?: string }> }) {
  const { id } = await params
  const sp = (await (searchParams || Promise.resolve({}))) as any

  const to = sp?.to ? new Date(sp.to) : new Date()
  const from = sp?.from ? new Date(sp.from) : startOfMonth(to)
  const supabase = getSupabaseServerClient()

  // Snapshot as of 'to'
  let snapshot: any = null
  try {
    const { data, error } = await (supabase as any).rpc('get_property_financials', { p_property_id: id, p_as_of: to.toISOString().slice(0,10) })
    if (!error) snapshot = data
  } catch {}

  // Period activity
  let activity: any[] = []
  try {
    const { data, error } = await (supabase as any).rpc('gl_account_activity', {
      p_property_id: id,
      p_from: from.toISOString().slice(0,10),
      p_to: to.toISOString().slice(0,10),
      p_gl_account_ids: null,
    })
    if (!error && Array.isArray(data)) activity = data as any[]
  } catch {}

  const cash = snapshot?.cash_balance ?? 0
  const sec = snapshot?.security_deposits ?? 0
  const reserve = snapshot?.reserve ?? 0
  const avail = snapshot?.available_balance ?? (cash - sec - reserve)
  const asOfText = new Date(snapshot?.as_of || to).toLocaleDateString()
  const lastRec = snapshot?.last_reconciled_at ? new Date(snapshot.last_reconciled_at).toLocaleDateString() : '—'

  const fmt = (n: number) => `$${Number(n || 0).toLocaleString()}`

  return (
    <div id="panel-financials" role="tabpanel" aria-labelledby="financials" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Account Activity</h2>
          <DateRangeControls defaultFrom={from} defaultTo={to} />
        </div>
        <InfoCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">GL Account</TableHead>
                <TableHead className="text-right">Debits</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity?.length ? activity.map((row: any) => (
                <TableRow key={row.gl_account_id}>
                  <TableCell className="text-foreground">{row.gl_account_name ?? row.name}</TableCell>
                  <TableCell className="text-right">{fmt(row.debits ?? row.debits)}</TableCell>
                  <TableCell className="text-right">{fmt(row.credits ?? row.credits)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(row.net ?? row.net_change)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No activity for the selected period.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </InfoCard>
      </div>
      <div className="space-y-6">
        <InfoCard title="Cash balance" className="rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground">Cash balance:</span>
            <span className="text-lg font-bold text-foreground">{fmt(cash)}</span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>- Security deposits and early payments:</span>
              <span>{fmt(sec)}</span>
            </div>
            <div className="flex justify-between">
              <span>- Property reserve:</span>
              <span>{fmt(reserve)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-sm text-foreground">Available balance</span>
            <span className="text-sm font-bold text-foreground">{fmt(avail)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">As of {asOfText} • Last reconciled (finished only) {lastRec}</p>
        </InfoCard>
      </div>
    </div>
  )
}

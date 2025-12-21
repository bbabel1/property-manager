import InfoCard from '@/components/layout/InfoCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { resolvePropertyIdentifier } from '@/lib/public-id-utils'

export default async function LedgerPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ gl?: string; as_of?: string }> }) {
  const { id: slug } = await params
  const { internalId: propertyId, publicId: propertyPublicId } = await resolvePropertyIdentifier(slug)
  const sp = (await (searchParams || Promise.resolve({}))) as any
  const gl = sp?.gl as string | undefined
  const asOf = sp?.as_of as string | undefined
  const supabase = await getSupabaseServerClient()

  let rows: any[] = []
  if (gl && asOf) {
    const { data } = await (supabase as any)
      .from('transaction_lines')
      .select('id, date, memo, posting_type, amount')
      .eq('property_id', propertyId)
      .eq('gl_account_id', gl)
      .lte('date', asOf)
      .order('date', { ascending: true })
    rows = data || []
  }

  const fmt = (n: number) => `$${Number(n || 0).toLocaleString()}`

  return (
    <div className="space-y-6">
      <InfoCard title="Ledger Detail">
        <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
          <div>Property: {propertyPublicId}</div>
          <div>GL: {gl || '—'}</div>
          <div>As of: {asOf || '—'}</div>
        </div>
        {gl && asOf ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-foreground">{r.memo || ''}</TableCell>
                  <TableCell className="text-right">{r.posting_type === 'Debit' ? fmt(r.amount) : ''}</TableCell>
                  <TableCell className="text-right">{r.posting_type === 'Credit' ? fmt(r.amount) : ''}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No entries up to {asOf}.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground">Provide gl and as_of in the URL to view ledger details.</p>
        )}
      </InfoCard>
    </div>
  )
}

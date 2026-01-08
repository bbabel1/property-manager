import { AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

type WarningLevel = 'critical' | 'warning' | 'info'

type WarningRow = {
  org_id: string
  payment_count: number
  total_amount: number
  max_age_days: number
  avg_age_days: number
  warning_level: WarningLevel
}

type PaymentRow = {
  transaction_id: string
  org_id: string
  payment_date: string
  total_amount: number
  transaction_type: string
  memo: string | null
  tenant_id: string | null
  paid_to_tenant_id: string | null
  is_undeposited: boolean
  age_days: number
}

export function UndepositedFundsWarning({
  warnings,
  payments,
  depositUrl = '/bank-accounts',
}: {
  warnings: WarningRow[]
  payments: PaymentRow[]
  depositUrl?: string
}) {
  if (!warnings?.length) return null

  const iconForLevel = (level: WarningLevel) => {
    if (level === 'critical') return <ShieldAlert className="h-5 w-5 text-destructive" />
    if (level === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-500" />
    return <Info className="h-5 w-5 text-blue-500" />
  }

  const headerForLevel = (level: WarningLevel) => {
    if (level === 'critical') return 'Undeposited funds require immediate action'
    if (level === 'warning') return 'Undeposited funds need attention'
    return 'Undeposited funds on file'
  }

  const descriptionForLevel = (level: WarningLevel) => {
    if (level === 'critical') return 'Funds are aging past 60 days or exceed $10k.'
    if (level === 'warning') return 'Funds are aging past 30 days or exceed $5k.'
    return 'Funds are awaiting deposit.'
  }

  const mostSevere = warnings.reduce<WarningLevel>((acc, row) => {
    if (row.warning_level === 'critical') return 'critical'
    if (row.warning_level === 'warning' && acc === 'info') return 'warning'
    return acc
  }, 'info')

  return (
    <div className="border-border/60 bg-muted/30 mb-6 rounded-lg border p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {iconForLevel(mostSevere)}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-foreground text-sm font-semibold">{headerForLevel(mostSevere)}</p>
              <p className="text-muted-foreground text-xs">{descriptionForLevel(mostSevere)}</p>
            </div>
            <Link href={depositUrl} className="text-primary text-xs font-semibold underline">
              Record deposit
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {warnings.map((w) => (
              <div
                key={w.org_id}
                className="border-border/50 bg-background/60 rounded-md border p-3 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Org: {w.org_id.slice(0, 8)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      w.warning_level === 'critical'
                        ? 'bg-destructive/10 text-destructive'
                        : w.warning_level === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {w.warning_level}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  <p>Payments: {w.payment_count}</p>
                  <p>Total: ${Number(w.total_amount ?? 0).toLocaleString()}</p>
                  <p>Max age: {Number(w.max_age_days ?? 0)} days</p>
                </div>
              </div>
            ))}
          </div>
          {payments?.length ? (
            <div className="border-border/50 bg-background/80 rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Sample payments</p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-xs">
                {payments.slice(0, 6).map((p) => (
                  <div key={p.transaction_id} className="rounded border border-border/40 p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.transaction_type}</span>
                      <span className="text-muted-foreground">{p.age_days}d</span>
                    </div>
                    <p className="text-muted-foreground">Amount: ${Number(p.total_amount ?? 0).toLocaleString()}</p>
                    {p.memo ? <p className="line-clamp-2 text-muted-foreground">{p.memo}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

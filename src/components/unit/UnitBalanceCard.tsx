import { Card, CardContent } from '@/components/ui/card'

export default function UnitBalanceCard({ fin, rent, prepayments }: { fin?: { cash_balance?: number; security_deposits?: number; reserve?: number; available_balance?: number; prepayments?: number }; rent?: number | null; prepayments?: number | null }) {
  const fmt = (n?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
  return (
    <Card>
      <CardContent className="p-4 bg-muted rounded-md space-y-1">
        <div className="flex items-center justify-between"><span className="text-sm text-foreground">Balance:</span><span className="text-xl font-bold text-foreground">{fmt(fin?.available_balance ?? fin?.cash_balance)}</span></div>
        <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Prepayments:</span><span>{fmt(prepayments ?? fin?.prepayments ?? 0)}</span></div>
        <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Deposits held:</span><span>{fmt(fin?.security_deposits)}</span></div>
        <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Rent:</span><span>{fmt(rent)}</span></div>
      </CardContent>
    </Card>
  )
}


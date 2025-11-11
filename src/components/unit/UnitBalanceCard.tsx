import { Card, CardContent } from '@/components/ui/card';

export default function UnitBalanceCard({
  fin,
  rent,
  prepayments,
}: {
  fin?: {
    cash_balance?: number;
    security_deposits?: number;
    reserve?: number;
    available_balance?: number;
    prepayments?: number;
  };
  rent?: number | null;
  prepayments?: number | null;
}) {
  const fmt = (n?: number | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
  return (
    <Card>
      <CardContent className="bg-muted space-y-1 rounded-md p-4">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>Balance:</span>
          <span className="text-foreground">
            {fmt(fin?.available_balance ?? fin?.cash_balance)}
          </span>
        </div>
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>Prepayments:</span>
          <span>{fmt(prepayments ?? fin?.prepayments ?? 0)}</span>
        </div>
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>Deposits held:</span>
          <span>{fmt(fin?.security_deposits)}</span>
        </div>
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>Rent:</span>
          <span>{fmt(rent)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

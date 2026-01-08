import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';

type Props = {
  state?: string | null;
  className?: string;
};

const STATE_COPY: Record<string, string> = {
  created: 'Created',
  submitted: 'Submitted',
  pending: 'Pending',
  settled: 'Settled',
  failed: 'Failed',
  authorized: 'Authorized',
};

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  created: 'secondary',
  submitted: 'default',
  pending: 'default',
  settled: 'secondary',
  failed: 'destructive',
  authorized: 'default',
};

export function PaymentIntentStatus({ state, className }: Props) {
  if (!state) return null;
  const key = state.toLowerCase();
  const label = STATE_COPY[key] ?? state;
  const variant = STATE_VARIANT[key] ?? 'outline';

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Intent</span>
      <Badge variant={variant}>{label}</Badge>
    </div>
  );
}

export default PaymentIntentStatus;

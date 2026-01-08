import { format } from 'date-fns';

type Event = {
  source_event_id?: string | null;
  provider?: string | null;
  normalized_event_type?: string | null;
  raw_event_type?: string | null;
  normalized_result_code?: string | null;
  raw_result_code?: string | null;
  occurred_at?: string | null;
};

type Props = {
  events: Event[];
  className?: string;
};

const formatTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'MMM d, yyyy h:mma');
};

export function PaymentEventsTimeline({ events, className }: Props) {
  if (!events?.length) return null;
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Payment events
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
        {events.map((ev) => (
          <div key={ev.source_event_id ?? `${ev.raw_event_type}-${ev.occurred_at ?? Math.random()}`} className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{ev.normalized_event_type ?? ev.raw_event_type ?? 'event'}</div>
              {ev.normalized_result_code || ev.raw_result_code ? (
                <div className="text-xs text-muted-foreground">
                  {ev.normalized_result_code ?? ev.raw_result_code}
                </div>
              ) : null}
              {ev.provider ? (
                <div className="text-xs text-muted-foreground">{ev.provider}</div>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(ev.occurred_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PaymentEventsTimeline;

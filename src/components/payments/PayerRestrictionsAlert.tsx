import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Restriction = {
  id: string;
  restriction_type: string;
  restricted_until: string | null;
  reason: string | null;
  methods: string[];
};

type Props = {
  restrictions: Restriction[];
  onClearRestriction?: (restrictionId: string) => void | Promise<void>;
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

export function PayerRestrictionsAlert({ restrictions, onClearRestriction }: Props) {
  if (!restrictions?.length) return null;
  return (
    <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-900">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">Payment restrictions in effect</AlertTitle>
      <AlertDescription className="space-y-2">
        {onClearRestriction ? (
          <div className="text-[11px] font-medium text-amber-800">
            Only admins can clear restrictions.
          </div>
        ) : null}
        {restrictions.map((r) => {
          const expiry = formatDate(r.restricted_until);
          return (
            <div key={r.id} className="text-xs leading-relaxed">
              <div className="font-medium">
                {r.restriction_type.replaceAll('_', ' ')}{' '}
                {r.methods?.length ? `(${r.methods.join(', ')})` : ''}
              </div>
              {r.reason ? <div>Reason: {r.reason}</div> : null}
              <div>{expiry ? `Expires ${expiry}` : 'No expiry set'}</div>
              {onClearRestriction ? (
                <button
                  type="button"
                  onClick={() => onClearRestriction(r.id)}
                  className="mt-1 text-[11px] font-semibold text-amber-800 underline"
                >
                  Clear restriction
                </button>
              ) : null}
            </div>
          );
        })}
      </AlertDescription>
    </Alert>
  );
}

export default PayerRestrictionsAlert;

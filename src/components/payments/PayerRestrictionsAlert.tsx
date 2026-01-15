import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Body, Heading } from '@/ui/typography';

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
      <AlertTitle className="text-left">
        <Heading as="div" size="h6" className="text-amber-900">
          Payment restrictions in effect
        </Heading>
      </AlertTitle>
      <AlertDescription className="space-y-2">
        {onClearRestriction ? (
          <Body as="div" size="xs" className="font-medium text-amber-800">
            Only admins can clear restrictions.
          </Body>
        ) : null}
        {restrictions.map((r) => {
          const expiry = formatDate(r.restricted_until);
          return (
            <div key={r.id} className="space-y-0.5">
              <Body as="div" size="xs" className="font-medium text-amber-900">
                {r.restriction_type.replaceAll('_', ' ')}{' '}
                {r.methods?.length ? `(${r.methods.join(', ')})` : ''}
              </Body>
              {r.reason ? (
                <Body as="div" size="xs" className="text-amber-900">
                  Reason: {r.reason}
                </Body>
              ) : null}
              <Body as="div" size="xs" className="text-amber-900">
                {expiry ? `Expires ${expiry}` : 'No expiry set'}
              </Body>
              {onClearRestriction ? (
                <button
                  type="button"
                  onClick={() => onClearRestriction(r.id)}
                  className="mt-1 text-amber-800 underline"
                >
                  <Body as="span" size="xs" className="font-semibold">
                    Clear restriction
                  </Body>
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

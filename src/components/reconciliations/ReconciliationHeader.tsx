import { Badge } from '@/components/ui/badge'
import { Body, Heading } from '@/ui/typography'

export default function ReconciliationHeader({
  bankName,
  maskedNumber,
  statementDate,
  status,
  propertyId,
}: {
  bankName?: string
  maskedNumber?: string
  statementDate?: string
  status?: 'Pending' | 'Finished'
  propertyId?: string
}) {
  const dateText = statementDate ? new Date(statementDate).toLocaleDateString() : '—'
  return (
    <div className="flex items-center justify-between">
      <div>
        <Heading as="h1" size="h3" className="text-foreground">
          {bankName || 'Bank Account'} {maskedNumber ? `• ${maskedNumber}` : ''}
        </Heading>
        <Body as="p" size="sm" tone="muted">
          Statement ending {dateText}
        </Body>
      </div>
      <div className="flex items-center gap-3">
        {propertyId && (
          <Body
            as="a"
            href={`/properties/${propertyId}/financials`}
            size="sm"
            className="text-primary underline"
          >
            Back to Financials
          </Body>
        )}
        <Badge
          variant={status === 'Finished' ? 'success' : 'warning'}
          className="status-pill px-2 py-1 text-xs"
        >
          {status || 'Pending'}
        </Badge>
      </div>
    </div>
  )
}

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
        <h1 className="text-xl font-semibold text-foreground">
          {bankName || 'Bank Account'} {maskedNumber ? `• ${maskedNumber}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">Statement ending {dateText}</p>
      </div>
      <div className="flex items-center gap-3">
        {propertyId && (
          <a href={`/properties/${propertyId}/financials`} className="text-sm text-primary underline">Back to Financials</a>
        )}
        <span className={`text-xs px-2 py-1 rounded border ${status === 'Finished' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          {status || 'Pending'}
        </span>
      </div>
    </div>
  )
}


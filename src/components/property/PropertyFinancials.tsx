import React, { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { Body, Heading, Label } from '@/ui/typography'

interface PropertyFinancialsProps {
  propertyId: string
  fin?: { cash_balance?: number; security_deposits?: number; reserve?: number; available_balance?: number; as_of?: string }
}

export function PropertyFinancials({ propertyId, fin }: PropertyFinancialsProps) {
  const [financials, setFinancials] = useState(fin ?? null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!propertyId) return
    setIsLoading(true)
    setError(null)
    fetch(`/api/properties/${propertyId}/financials`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load financials (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        setFinancials(data ?? null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [propertyId])

  const fmt = (n?: number | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
  const fmtHeld = (n?: number | null) => fmt(Math.abs(n ?? 0))

  const hasFinancialData = true

  return (
    <div className="space-y-6">
      {isLoading && <p className="text-sm text-muted-foreground">Loading financials…</p>}
      {error && <p className="text-sm text-destructive">Error loading financials: {error}</p>}

      {/* Cash Balance Section */}
      <div className="bg-card rounded-lg border border-border p-6">
        <Heading as="h2" size="h5" className="mb-4">
          Cash Balance
        </Heading>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-foreground">Cash balance:</span>
            <span className="font-semibold text-foreground">{fmt(financials?.cash_balance)}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="pl-4">- Security deposits and early payments:</span>
            <span>{fmtHeld(financials?.security_deposits)}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="pl-4">- Property reserve:</span>
            <span>{fmt(financials?.reserve)}</span>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">Available:</span>
              <Heading as="span" size="h4">
                {fmt(financials?.available_balance)}
              </Heading>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Data (when available) */}
      {hasFinancialData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Statement */}
          <div className="bg-card rounded-lg border border-border">
            <div className="p-6 border-b border-border">
              <Heading as="h2" size="h5">
                Income Statement
              </Heading>
              <Body as="p" size="sm" tone="muted">
                Last 30 days
              </Body>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-foreground">Gross Revenue</span>
                <span className="font-semibold text-foreground">$0</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="pl-4">- Vacancy Loss</span>
                <span>-$0</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="pl-4">- Bad Debt</span>
                <span>-$0</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Effective Gross Income</span>
                  <span className="font-semibold text-foreground">$0</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-red-600">
                  <span>Total Expenses</span>
                  <span>-$0</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-foreground">
                  <Heading as="span" size="h5">
                    Net Operating Income
                  </Heading>
                  <Heading as="span" size="h5">
                    $0
                  </Heading>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-card rounded-lg border border-border">
            <div className="p-6 border-b border-border">
              <Heading as="h2" size="h5">
                Expense Breakdown
              </Heading>
              <Body as="p" size="sm" tone="muted">
                Monthly expenses
              </Body>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-foreground">Property Management</span>
                <span className="font-semibold text-foreground">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground">Maintenance & Repairs</span>
                <span className="font-semibold text-foreground">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground">Utilities</span>
                <span className="font-semibold text-foreground">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground">Insurance</span>
                <span className="font-semibold text-foreground">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground">Property Taxes</span>
                <span className="font-semibold text-foreground">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground">Other</span>
                <span className="font-semibold text-foreground">$0</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center font-bold text-foreground">
                  <span>Total Expenses</span>
                  <span>$0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasFinancialData && (
        <div className="text-center py-12">
          <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <Heading as="h3" size="h5" className="mb-2">
            No financial data available
          </Heading>
          <Body as="p" tone="muted" className="mb-6">
            Financial data will appear here once you start tracking income, expenses, and property metrics.
          </Body>
        </div>
      )}
    </div>
  )
}

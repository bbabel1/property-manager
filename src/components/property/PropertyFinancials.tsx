import { DollarSign, TrendingUp, TrendingDown, Users, Building } from 'lucide-react'

interface PropertyFinancialsProps {
  propertyId: string
}

export function PropertyFinancials({ propertyId }: PropertyFinancialsProps) {
  // TODO: Implement real financial data with database integration
  const hasFinancialData = false

  return (
    <div className="space-y-6">
      {/* Empty State */}
      {!hasFinancialData && (
        <div className="text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No financial data available</h3>
          <p className="text-gray-500 mb-6">Financial data will appear here once you start tracking income, expenses, and property metrics.</p>
        </div>
      )}

      {/* Financial Data (when available) */}
      {hasFinancialData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Statement */}
          <div className="bg-card rounded-lg border">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold">Income Statement</h2>
              <p className="text-sm text-muted-foreground">Last 30 days</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span>Gross Revenue</span>
                <span className="font-semibold">$0</span>
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
                  <span className="font-semibold">Effective Gross Income</span>
                  <span className="font-semibold">$0</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-red-600">
                  <span>Total Expenses</span>
                  <span>-$0</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Net Operating Income</span>
                  <span>$0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-card rounded-lg border">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold">Expense Breakdown</h2>
              <p className="text-sm text-muted-foreground">Monthly expenses</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span>Property Management</span>
                <span className="font-semibold">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Maintenance & Repairs</span>
                <span className="font-semibold">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Utilities</span>
                <span className="font-semibold">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Insurance</span>
                <span className="font-semibold">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Property Taxes</span>
                <span className="font-semibold">$0</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Other</span>
                <span className="font-semibold">$0</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center font-bold">
                  <span>Total Expenses</span>
                  <span>$0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

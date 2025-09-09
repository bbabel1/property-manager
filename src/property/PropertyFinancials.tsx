import { DollarSign, TrendingUp, TrendingDown, Users, Building, Banknote } from 'lucide-react'

interface PropertyFinancialsProps {
  propertyId: string
}

export function PropertyFinancials({ propertyId }: PropertyFinancialsProps) {
  // TODO: Implement real financial data with database integration
  const hasFinancialData = true // Changed to true to show the cash balance layout

  return (
    <div className="space-y-6">
      {/* Cash Balance Section */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Cash Balance</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-foreground">Cash balance:</span>
            <span className="font-semibold text-foreground">$3,061.80</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="pl-4">- Security deposits and early payments:</span>
            <span>$875.00</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="pl-4">- Property reserve:</span>
            <span>$200.00</span>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">Available:</span>
              <span className="text-xl font-bold text-foreground">$2,576.80</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Data (when available) */}
      {hasFinancialData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Statement */}
          <div className="bg-card rounded-lg border border-border shadow-sm">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Income Statement</h2>
              <p className="text-sm text-muted-foreground">Last 30 days</p>
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
                <div className="flex justify-between items-center text-lg font-bold text-foreground">
                  <span>Net Operating Income</span>
                  <span>$0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-card rounded-lg border border-border shadow-sm">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Expense Breakdown</h2>
              <p className="text-sm text-muted-foreground">Monthly expenses</p>
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
          <h3 className="text-lg font-medium text-foreground mb-2">No financial data available</h3>
          <p className="text-muted-foreground mb-6">Financial data will appear here once you start tracking income, expenses, and property metrics.</p>
        </div>
      )}
    </div>
  )
}

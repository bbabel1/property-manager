import { 
  ArrowLeft, 
  Building2, 
  User, 
  DollarSign, 
  Calendar,
  FileText,
  MapPin,
  Receipt,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Activity,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface MonthlyLogDetailsProps {
  unitId: string;
  propertyId: string;
  monthlyLogId: string;
  onBack: () => void;
}

export function MonthlyLogDetails({ unitId, propertyId, monthlyLogId, onBack }: MonthlyLogDetailsProps) {
  // Mock data - in a real app, this would be fetched based on monthlyLogId
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Mock data for monthly log details
  const monthlyLog = {
    id: monthlyLogId,
    month: '2024-02',
    period: 'February 2024',
    status: 'completed',
    generatedDate: '2024-03-01'
  };

  const unit = {
    id: unitId,
    unit_number: "2A",
    bedrooms: 2,
    bathrooms: 1,
    market_rent: 2200
  };

  const property = {
    id: propertyId,
    name: "Sunset Apartments",
    address: "123 Main St, Anytown, CA 90210"
  };

  const mockMonthlyLogData = {
    leaseTransactions: [
      { id: 1, date: '2024-02-01', type: 'charge', category: 'Rent', description: 'Monthly Rent - February 2024', amount: 2200 },
      { id: 2, date: '2024-02-01', type: 'payment', category: 'Rent Payment', description: 'Rent Payment Received', amount: -2200 },
      { id: 3, date: '2024-02-05', type: 'charge', category: 'Late Fee', description: 'Late Fee - Rent Payment', amount: 75 },
      { id: 4, date: '2024-02-15', type: 'credit', category: 'Credit', description: 'Maintenance Credit - Tenant Repair', amount: -150 }
    ],
    expenses: [
      { id: 1, date: '2024-02-03', category: 'Maintenance', description: 'Plumbing Repair - Kitchen Sink', amount: 150, vendor: 'ABC Plumbing' },
      { id: 2, date: '2024-02-10', category: 'Utilities', description: 'Water & Sewer - February', amount: 85, vendor: 'City Utilities' },
      { id: 3, date: '2024-02-15', category: 'Insurance', description: 'Property Insurance - Monthly', amount: 125, vendor: 'State Farm' }
    ],
    taxEscrow: [
      { id: 1, date: '2024-02-01', description: 'Property Tax Escrow - February', amount: 250, status: 'withheld' }
    ],
    managementFees: [
      { id: 1, date: '2024-02-28', description: 'Management Fee - February (8%)', amount: 176, rate: '8%' }
    ],
    ownerDraws: [
      { id: 1, date: '2024-02-28', description: 'Owner Distribution - February', amount: 1589, owner: 'John Smith' }
    ]
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'charge':
        return TrendingUp;
      case 'payment':
        return TrendingDown;
      case 'credit':
        return Minus;
      default:
        return DollarSign;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'charge':
        return 'text-red-600';
      case 'payment':
        return 'text-green-600';
      case 'credit':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Monthly Log - {monthlyLog.period}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                <span>{property.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>Unit {unit.unit_number}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Generated: {formatDate(monthlyLog.generatedDate)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800">
            {monthlyLog.status}
          </Badge>
          <Button>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-red-600" />
            <span>Total Charges</span>
          </div>
          <p className="text-2xl font-semibold">
            {formatCurrency(mockMonthlyLogData.leaseTransactions
              .filter(t => t.type === 'charge')
              .reduce((sum, t) => sum + t.amount, 0))}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-green-600" />
            <span>Total Payments</span>
          </div>
          <p className="text-2xl font-semibold">
            {formatCurrency(Math.abs(mockMonthlyLogData.leaseTransactions
              .filter(t => t.type === 'payment')
              .reduce((sum, t) => sum + t.amount, 0)))}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-orange-600" />
            <span>Total Expenses</span>
          </div>
          <p className="text-2xl font-semibold">
            {formatCurrency(mockMonthlyLogData.expenses.reduce((sum, e) => sum + e.amount, 0))}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span>Net Income</span>
          </div>
          <p className="text-2xl font-semibold">
            {formatCurrency(
              mockMonthlyLogData.leaseTransactions.reduce((sum, t) => sum + t.amount, 0) -
              mockMonthlyLogData.expenses.reduce((sum, e) => sum + e.amount, 0) -
              mockMonthlyLogData.taxEscrow.reduce((sum, t) => sum + t.amount, 0) -
              mockMonthlyLogData.managementFees.reduce((sum, m) => sum + m.amount, 0)
            )}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Lease Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockMonthlyLogData.leaseTransactions.map((transaction) => {
                const IconComponent = getTransactionIcon(transaction.type);
                const colorClass = getTransactionColor(transaction.type);
                return (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-1 rounded-full bg-muted ${colorClass}`}>
                        <IconComponent className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.date)} • {transaction.category}
                        </p>
                      </div>
                    </div>
                    <div className={`font-medium ${colorClass}`}>
                      {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pt-4 border-t mt-4">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Transaction
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Bills & Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockMonthlyLogData.expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-muted text-red-600">
                      <Receipt className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(expense.date)} • {expense.vendor}
                      </p>
                    </div>
                  </div>
                  <div className="font-medium text-red-600">
                    {formatCurrency(expense.amount)}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t mt-4">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Tax Escrow & Fees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {mockMonthlyLogData.taxEscrow.map((escrow) => (
                <div key={escrow.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-muted text-orange-600">
                      <Building2 className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{escrow.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(escrow.date)} • {escrow.status}
                      </p>
                    </div>
                  </div>
                  <div className="font-medium text-orange-600">
                    {formatCurrency(escrow.amount)}
                  </div>
                </div>
              ))}
              
              {mockMonthlyLogData.managementFees.map((fee) => (
                <div key={fee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-muted text-blue-600">
                      <User className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{fee.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(fee.date)} • Rate: {fee.rate}
                      </p>
                    </div>
                  </div>
                  <div className="font-medium text-blue-600">
                    {formatCurrency(fee.amount)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Owner Distributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockMonthlyLogData.ownerDraws.map((draw) => (
                <div key={draw.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-muted text-purple-600">
                      <User className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{draw.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(draw.date)} • {draw.owner}
                      </p>
                    </div>
                  </div>
                  <div className="font-medium text-purple-600">
                    {formatCurrency(draw.amount)}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t mt-4">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Distribution
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Monthly Statement Summary
            </div>
            <Button size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Generate Statement
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="pb-4 border-b">
                <h4 className="font-medium mb-3">Income</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Rent Charges</span>
                    <span>{formatCurrency(2200)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Late Fees</span>
                    <span>{formatCurrency(75)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Other Charges</span>
                    <span>{formatCurrency(0)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-sm pt-2 border-t">
                    <span>Total Income</span>
                    <span>{formatCurrency(2275)}</span>
                  </div>
                </div>
              </div>

              <div className="pb-4 border-b">
                <h4 className="font-medium mb-3">Deductions</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Credits</span>
                    <span>{formatCurrency(150)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Payments Received</span>
                    <span>{formatCurrency(2200)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-sm pt-2 border-t">
                    <span>Total Deductions</span>
                    <span>{formatCurrency(2350)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="pb-4 border-b">
                <h4 className="font-medium mb-3">Expenses</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Maintenance</span>
                    <span>{formatCurrency(150)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Utilities</span>
                    <span>{formatCurrency(85)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Insurance</span>
                    <span>{formatCurrency(125)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax Escrow</span>
                    <span>{formatCurrency(250)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Management Fee</span>
                    <span>{formatCurrency(176)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-sm pt-2 border-t">
                    <span>Total Expenses</span>
                    <span>{formatCurrency(786)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Net Owner Distribution</span>
                  <span className="font-semibold">{formatCurrency(1589)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Available for distribution after expenses
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
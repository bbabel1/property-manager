import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  PieChart, 
  BarChart,
  Calendar,
  Download,
  Plus
} from "lucide-react";

interface PropertyFinancialsProps {
  propertyId: string;
  accessToken?: string;
}

export function PropertyFinancials({ propertyId, accessToken }: PropertyFinancialsProps) {
  const [financialData, setFinancialData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("ytd");

  // Mock financial data for demonstration
  const mockFinancialData = {
    income: {
      rental: 45000,
      late_fees: 350,
      other: 1200,
      total: 46550
    },
    expenses: {
      maintenance: 3200,
      insurance: 2400,
      taxes: 4800,
      management: 2790,
      utilities: 1800,
      other: 1500,
      total: 16490
    },
    netIncome: 30060,
    cashFlow: 28560,
    occupancyRate: 94,
    collections: 98.5,
    monthlyTrends: [
      { month: 'Jan', income: 3800, expenses: 1400, net: 2400 },
      { month: 'Feb', income: 3850, expenses: 1320, net: 2530 },
      { month: 'Mar', income: 3900, expenses: 1650, net: 2250 },
      { month: 'Apr', income: 3900, expenses: 1280, net: 2620 },
      { month: 'May', income: 3950, expenses: 1450, net: 2500 },
      { month: 'Jun', income: 4000, expenses: 1380, net: 2620 },
    ]
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div className="flex items-center justify-between">
        <h2>Financial Overview</h2>
        <div className="flex items-center gap-2">
          <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="w-auto">
            <TabsList>
              <TabsTrigger value="mtd">MTD</TabsTrigger>
              <TabsTrigger value="qtd">QTD</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>



      {/* Income & Expense Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Breakdown */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Income Breakdown
            </h3>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Income
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span>Rental Income</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.income.rental)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Late Fees</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.income.late_fees)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Other Income</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.income.other)}</span>
            </div>
            <div className="flex items-center justify-between py-2 font-medium text-lg border-t-2">
              <span>Total Income</span>
              <span className="text-green-600">{formatCurrency(mockFinancialData.income.total)}</span>
            </div>
          </div>
        </Card>

        {/* Expense Breakdown */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Expense Breakdown
            </h3>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span>Maintenance & Repairs</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.expenses.maintenance)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Property Management</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.expenses.management)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Property Taxes</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.expenses.taxes)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Insurance</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.expenses.insurance)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Utilities</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.expenses.utilities)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span>Other Expenses</span>
              <span className="font-medium">{formatCurrency(mockFinancialData.expenses.other)}</span>
            </div>
            <div className="flex items-center justify-between py-2 font-medium text-lg border-t-2">
              <span>Total Expenses</span>
              <span className="text-red-600">{formatCurrency(mockFinancialData.expenses.total)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2">
            <BarChart className="w-5 h-5" />
            Monthly Performance Trends
          </h3>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            View Details
          </Button>
        </div>

        <div className="grid grid-cols-6 gap-4">
          {mockFinancialData.monthlyTrends.map((month, index) => (
            <div key={index} className="text-center p-3 border rounded-lg">
              <p className="text-sm font-medium mb-2">{month.month}</p>
              <div className="space-y-1 text-xs">
                <p className="text-green-600">+{formatCurrency(month.income)}</p>
                <p className="text-red-600">-{formatCurrency(month.expenses)}</p>
                <p className="font-medium border-t pt-1">{formatCurrency(month.net)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Financial Ratios */}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5" />
          Key Financial Ratios
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Expense Ratio</p>
            <p className="text-2xl font-semibold">
              {Math.round((mockFinancialData.expenses.total / mockFinancialData.income.total) * 100)}%
            </p>
            <p className="text-xs text-muted-foreground">Expenses vs Income</p>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Collection Rate</p>
            <p className="text-2xl font-semibold text-green-600">
              {mockFinancialData.collections}%
            </p>
            <p className="text-xs text-muted-foreground">Payment Collections</p>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Cash Flow Margin</p>
            <p className="text-2xl font-semibold">
              {Math.round((mockFinancialData.cashFlow / mockFinancialData.income.total) * 100)}%
            </p>
            <p className="text-xs text-muted-foreground">Cash Flow vs Income</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
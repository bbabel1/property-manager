import { Plus, Building, TrendingUp, DollarSign, AlertTriangle, Users, Calendar, Wrench, FileText, UserCheck, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function DashboardPage() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your properties.</p>
        </div>
        <Button className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Properties</p>
                <p className="text-2xl font-bold text-foreground">4</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">80 units</Badge>
                  <span className="text-xs text-muted-foreground">+2 this month</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Occupancy Rate</p>
                <p className="text-2xl font-bold text-foreground">93%</p>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs bg-success text-white">74 occupied</Badge>
                  <span className="text-xs text-muted-foreground">6 available</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Monthly Rent Roll</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(17000)}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">74 active leases</Badge>
                  <span className="text-xs text-success">+5.2%</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Open Work Orders</p>
                <p className="text-2xl font-bold text-foreground">4</p>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">3 urgent</Badge>
                  <span className="text-xs text-muted-foreground">1 low priority</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Lease Renewals</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-destructive">0</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Critical</p>
                <p className="text-xs text-muted-foreground">≤30 days</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-warning">0</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Upcoming</p>
                <p className="text-xs text-muted-foreground">30-60 days</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-primary">0</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Future</p>
                <p className="text-xs text-muted-foreground">60-90 days</p>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <UserCheck className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Property Onboarding</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-primary">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">In Progress</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-warning">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Pending</p>
                <p className="text-xs text-muted-foreground">Approval</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-destructive">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Overdue</p>
                <p className="text-xs text-muted-foreground">Needs attention</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Maple Heights Complex</p>
                <p className="text-xs text-muted-foreground">Documentation • Sarah Johnson</p>
              </div>
              <div className="flex items-center">
                <div className="w-20 bg-muted rounded-full h-2 mr-2">
                  <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: '60%' }}></div>
                </div>
                <Badge variant="secondary" className="text-xs">60%</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Riverside Apartments</p>
                <p className="text-xs text-muted-foreground">Inspection • Michael Brown</p>
              </div>
              <div className="flex items-center">
                <div className="w-16 bg-muted rounded-full h-2 mr-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
                <span className="text-xs text-muted-foreground">30%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Downtown Lofts</p>
                <p className="text-xs text-muted-foreground">Legal Review • Lisa Wilson</p>
              </div>
              <div className="flex items-center">
                <div className="w-20 bg-muted rounded-full h-2 mr-2">
                  <div className="bg-warning h-2 rounded-full transition-all duration-300" style={{ width: '85%' }}></div>
                </div>
                <Badge variant="secondary" className="text-xs">85%</Badge>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Recent Transactions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Electric Bill - Oak Grove Townhomes</p>
                  <p className="text-xs text-muted-foreground">Oak Grove Townhomes • 8/4/2024</p>
                </div>
              </div>
              <Badge variant="destructive" className="text-xs">-$180</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Plumbing Repair - Kitchen Sink</p>
                  <p className="text-xs text-muted-foreground">Sunset Apartments • 8/2/2024</p>
                </div>
              </div>
              <Badge variant="destructive" className="text-xs">-$125</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Rent Payment - Unit 101</p>
                  <p className="text-xs text-muted-foreground">Sunset Apartments • 7/31/2024</p>
                </div>
              </div>
              <Badge variant="default" className="text-xs bg-success text-white">+$2,200</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Rent Payment - Unit 102</p>
                  <p className="text-xs text-muted-foreground">Sunset Apartments • 7/31/2024</p>
                </div>
              </div>
              <Badge variant="default" className="text-xs bg-success text-white">+$2,200</Badge>
            </div>
          </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Wrench className="h-5 w-5 text-primary mr-2" />
              <CardTitle>Active Work Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">AC unit not cooling properly</p>
                  <p className="text-xs text-muted-foreground">urgent • 8/9/2024</p>
                </div>
              </div>
              <Button variant="link" size="sm">open</Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Bathroom door handle loose</p>
                  <p className="text-xs text-muted-foreground">low • 8/7/2024</p>
                </div>
              </div>
              <Button variant="link" size="sm">open</Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Paint touch-up in master bedroom</p>
                  <p className="text-xs text-muted-foreground">low • 8/6/2024</p>
                </div>
              </div>
              <Button variant="link" size="sm">open</Button>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

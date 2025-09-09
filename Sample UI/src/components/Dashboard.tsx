import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Building2, Users, DollarSign, AlertTriangle, Plus, TrendingUp, Home, Calendar, Wrench, FileText, CheckCircle, Clock, UserPlus } from "lucide-react";
import { getDashboardStats, mockProperties, mockWorkOrders, mockLeases, mockTransactions, mockUnits, mockLeaseTenants, mockTenants } from "../utils/mockData";

interface DashboardProps {
  onNavigate: (section: string, propertyId?: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    availableUnits: 0,
    occupancyRate: 0,
    totalRentRoll: 0,
    openWorkOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading delay for better UX
    const timer = setTimeout(() => {
      const dashboardStats = getDashboardStats();
      setStats(dashboardStats);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRecentActivity = () => {
    const recentTransactions = mockTransactions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
    
    const recentWorkOrders = mockWorkOrders
      .filter(wo => wo.status === 'open' || wo.status === 'in_progress')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);

    return { recentTransactions, recentWorkOrders };
  };

  const getLeaseRenewalData = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(today.getDate() + 60);
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);

    const expiringSoon = mockLeases.filter(lease => {
      const endDate = new Date(lease.end_date);
      return endDate <= ninetyDaysFromNow && endDate > today && lease.status === 'active';
    });

    const criticalRenewals = expiringSoon.filter(lease => {
      const endDate = new Date(lease.end_date);
      return endDate <= thirtyDaysFromNow;
    });

    const upcomingRenewals = expiringSoon.filter(lease => {
      const endDate = new Date(lease.end_date);
      return endDate > thirtyDaysFromNow && endDate <= sixtyDaysFromNow;
    });

    const futureRenewals = expiringSoon.filter(lease => {
      const endDate = new Date(lease.end_date);
      return endDate > sixtyDaysFromNow;
    });

    return {
      totalExpiring: expiringSoon.length,
      critical: criticalRenewals.length,
      upcoming: upcomingRenewals.length,
      future: futureRenewals.length,
      recentRenewals: expiringSoon.slice(0, 4)
    };
  };

  const getPropertyOnboardingData = () => {
    // Mock onboarding data - in reality this would come from a separate onboarding table
    const onboardingProperties = [
      {
        id: 'onb-1',
        name: 'Maple Heights Complex',
        stage: 'documentation',
        progress: 60,
        status: 'in_progress',
        created_at: '2024-08-05T10:00:00Z',
        target_completion: '2024-08-20',
        manager: 'Sarah Johnson'
      },
      {
        id: 'onb-2', 
        name: 'Riverside Apartments',
        stage: 'inspection',
        progress: 30,
        status: 'in_progress',
        created_at: '2024-08-08T14:30:00Z',
        target_completion: '2024-08-25',
        manager: 'Michael Brown'
      },
      {
        id: 'onb-3',
        name: 'Downtown Lofts',
        stage: 'legal_review',
        progress: 85,
        status: 'pending_approval',
        created_at: '2024-08-01T09:15:00Z',
        target_completion: '2024-08-15',
        manager: 'Lisa Wilson'
      }
    ];

    const activeOnboarding = onboardingProperties.filter(p => p.status === 'in_progress');
    const pendingApproval = onboardingProperties.filter(p => p.status === 'pending_approval');
    const overdue = onboardingProperties.filter(p => {
      const targetDate = new Date(p.target_completion);
      return targetDate < new Date() && p.status !== 'completed';
    });

    return {
      total: onboardingProperties.length,
      active: activeOnboarding.length,
      pendingApproval: pendingApproval.length,
      overdue: overdue.length,
      properties: onboardingProperties
    };
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="flex items-center gap-2">
            <Home className="w-6 h-6" />
            Dashboard
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const { recentTransactions, recentWorkOrders } = getRecentActivity();
  const leaseRenewalData = getLeaseRenewalData();
  const onboardingData = getPropertyOnboardingData();

  return (
    <div className="space-y-6">
      {/* Header with colored accent */}
      <div className="bg-white border-b border-palette-silver p-6">
        <div className="border-l-4 border-l-palette-blue pl-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-palette-blue">
              <Home className="w-6 h-6 text-palette-blue" />
              Dashboard
            </h1>
            <Button 
              onClick={() => onNavigate("properties")}
              className="bg-palette-blue hover:bg-palette-blue/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Property
            </Button>
          </div>
          <p className="text-palette-medium-gray mt-2">
            Welcome back! Here's an overview of your property management portfolio.
          </p>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-palette-blue" onClick={() => onNavigate("properties")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Building2 className="h-4 w-4 text-palette-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProperties}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalUnits} total units
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-palette-teal" onClick={() => onNavigate("properties")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-palette-teal" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.occupancyRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.occupiedUnits} occupied, {stats.availableUnits} available
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500" onClick={() => onNavigate("rent")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Rent Roll</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRentRoll)}</div>
              <p className="text-xs text-muted-foreground">
                From {stats.occupiedUnits} active leases
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-palette-yellow" onClick={() => onNavigate("maintenance")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Work Orders</CardTitle>
              <AlertTriangle className="h-4 w-4 text-palette-yellow" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.openWorkOrders}</div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lease Renewals & Property Onboarding */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lease Renewals */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("lease-renewals")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-palette-blue" />
                Lease Renewals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{leaseRenewalData.critical}</div>
                  <p className="text-xs text-muted-foreground">Critical (≤30 days)</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{leaseRenewalData.upcoming}</div>
                  <p className="text-xs text-muted-foreground">Upcoming (30-60 days)</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{leaseRenewalData.future}</div>
                  <p className="text-xs text-muted-foreground">Future (60-90 days)</p>
                </div>
              </div>
              
              {leaseRenewalData.recentRenewals.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Expiring Soon</h4>
                  {leaseRenewalData.recentRenewals.map((lease) => {
                    const unit = mockUnits.find(u => u.id === lease.unit_id);
                    const property = unit ? mockProperties.find(p => p.id === unit.property_id) : null;
                    const leaseTenant = mockLeaseTenants.find(lt => lt.lease_id === lease.id && lt.role === 'primary');
                    const tenant = leaseTenant ? mockTenants.find(t => t.id === leaseTenant.tenant_id) : null;
                    const endDate = new Date(lease.end_date);
                    const daysUntilExpiry = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={lease.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{property?.name} - Unit {unit?.unit_number}</p>
                          <p className="text-muted-foreground">{tenant?.first_name} {tenant?.last_name}</p>
                        </div>
                        <Badge variant={daysUntilExpiry <= 30 ? "destructive" : daysUntilExpiry <= 60 ? "secondary" : "outline"}>
                          {daysUntilExpiry} days
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Property Onboarding */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("properties")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-palette-teal" />
                Property Onboarding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{onboardingData.active}</div>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{onboardingData.pendingApproval}</div>
                  <p className="text-xs text-muted-foreground">Pending Approval</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{onboardingData.overdue}</div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Active Onboarding</h4>
                {onboardingData.properties.slice(0, 3).map((property) => {
                  const getStageDisplay = (stage: string) => {
                    switch (stage) {
                      case 'documentation': return 'Documentation';
                      case 'inspection': return 'Inspection';
                      case 'legal_review': return 'Legal Review';
                      default: return stage;
                    }
                  };

                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'in_progress': return 'bg-blue-500';
                      case 'pending_approval': return 'bg-yellow-500';
                      case 'completed': return 'bg-green-500';
                      default: return 'bg-gray-500';
                    }
                  };

                  return (
                    <div key={property.id} className="flex items-center justify-between text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{property.name}</p>
                        <p className="text-muted-foreground">{getStageDisplay(property.stage)} • {property.manager}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getStatusColor(property.status)}`}
                            style={{ width: `${property.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{property.progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTransactions.map((transaction) => {
                  const property = mockProperties.find(p => p.id === transaction.property_id);
                  return (
                    <div key={transaction.id} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {property?.name} • {new Date(transaction.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`text-sm font-medium ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  );
                })}
                {recentTransactions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recent transactions</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Work Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-600" />
                Active Work Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentWorkOrders.map((workOrder) => {
                  const property = mockProperties.find(p => 
                    mockProperties.some(prop => 
                      mockWorkOrders.some(wo => wo.id === workOrder.id && wo.unit_id)
                    )
                  );
                  
                  const priorityColors = {
                    low: 'bg-gray-100 text-gray-800',
                    medium: 'bg-yellow-100 text-yellow-800',
                    high: 'bg-orange-100 text-orange-800',
                    urgent: 'bg-red-100 text-red-800'
                  };

                  return (
                    <div key={workOrder.id} className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium">{workOrder.description}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={priorityColors[workOrder.priority]}>
                            {workOrder.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(workOrder.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Badge variant={workOrder.status === 'in_progress' ? 'default' : 'secondary'}>
                        {workOrder.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
                {recentWorkOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active work orders</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-palette-blue">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-20 flex-col gap-2 hover:bg-palette-blue hover:text-white transition-colors" onClick={() => onNavigate("properties")}>
                <Building2 className="w-6 h-6 text-palette-blue" />
                <span>View Properties</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2 hover:bg-palette-teal hover:text-white transition-colors" onClick={() => onNavigate("tenants")}>
                <Users className="w-6 h-6 text-palette-teal" />
                <span>Manage Tenants</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2 hover:bg-palette-yellow hover:text-white transition-colors" onClick={() => onNavigate("lease-renewals")}>
                <FileText className="w-6 h-6 text-palette-yellow" />
                <span>Lease Renewals</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2 hover:bg-green-600 hover:text-white transition-colors" onClick={() => onNavigate("leases")}>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span>Leases</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
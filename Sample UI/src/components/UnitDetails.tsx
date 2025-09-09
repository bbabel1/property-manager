import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { 
  ArrowLeft, 
  Building2, 
  User, 
  DollarSign, 
  Calendar,
  FileText,
  Bed,
  Bath,
  Square,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Plus,
  Activity,
  Receipt,
  MoreVertical,
  PlusCircle,
  Home,
  Eye,
  Settings
} from "lucide-react";
import { getUnitById, getLeasesByUnitId, getPropertyById } from "../utils/mockData";

interface UnitDetailsProps {
  unitId: string;
  propertyId: string;
  onBack: () => void;
  onMonthlyLogSelect?: (monthlyLogId: string) => void;
}

export function UnitDetails({ unitId, propertyId, onBack, onMonthlyLogSelect }: UnitDetailsProps) {
  const [unit, setUnit] = useState<any>(null);
  const [lease, setLease] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [managementDetails, setManagementDetails] = useState({
    servicePlan: "Premium",
    activeServices: ["Property Management", "Maintenance Coordination", "Tenant Screening"],
    feeType: "Percentage",
    feeFrequency: "Monthly",
    feePercent: 8.0,
    managementFee: 240.00
  });
  const [isManagementDialogOpen, setIsManagementDialogOpen] = useState(false);

  // Available management services
  const availableServices = [
    "Property Management",
    "Maintenance Coordination", 
    "Tenant Screening",
    "Rent Collection",
    "Property Inspections",
    "Financial Reporting",
    "Legal Compliance",
    "Marketing & Leasing",
    "Insurance Management",
    "Tax Preparation Support",
    "Eviction Services",
    "24/7 Emergency Response"
  ];

  const handleServiceToggle = (service: string) => {
    setManagementDetails(prev => ({
      ...prev,
      activeServices: prev.activeServices.includes(service)
        ? prev.activeServices.filter(s => s !== service)
        : [...prev.activeServices, service]
    }));
  };

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Mock lease data for this unit
  const getUnitLeases = () => {
    return [
      {
        id: 'lease-1',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        monthlyRent: 1200,
        securityDeposit: 1800,
        status: 'active',
        tenant: {
          id: 'tenant-1',
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@email.com',
          phone: '(555) 123-4567',
          role: 'primary'
        }
      },
      {
        id: 'lease-2',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        monthlyRent: 1150,
        securityDeposit: 1725,
        status: 'expired',
        tenant: {
          id: 'tenant-2',
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.johnson@email.com',
          phone: '(555) 987-6543',
          role: 'primary'
        }
      },
      {
        id: 'lease-3',
        startDate: '2022-01-01',
        endDate: '2022-12-31',
        monthlyRent: 1100,
        securityDeposit: 1650,
        status: 'expired',
        tenant: {
          id: 'tenant-3',
          firstName: 'Michael',
          lastName: 'Davis',
          email: 'michael.davis@email.com',
          phone: '(555) 456-7890',
          role: 'primary'
        }
      }
    ];
  };

  // Mock data for recent activity
  const mockRecentActivity = [
    { 
      id: 1, 
      type: 'payment', 
      description: 'Rent payment received', 
      date: '2024-02-01', 
      time: '10:30 AM',
      icon: DollarSign,
      iconColor: 'text-green-600'
    },
    { 
      id: 2, 
      type: 'maintenance', 
      description: 'Work order completed - Leaky faucet', 
      date: '2024-01-28', 
      time: '2:15 PM',
      icon: CheckCircle,
      iconColor: 'text-blue-600'
    },
    { 
      id: 3, 
      type: 'communication', 
      description: 'Email sent to tenant - Rent reminder', 
      date: '2024-01-25', 
      time: '9:00 AM',
      icon: Mail,
      iconColor: 'text-purple-600'
    },
    { 
      id: 4, 
      type: 'inspection', 
      description: 'Annual inspection scheduled', 
      date: '2024-01-20', 
      time: '11:45 AM',
      icon: Calendar,
      iconColor: 'text-orange-600'
    }
  ];

  // Mock data for inspections
  const mockInspectionHistory = [
    {
      id: 1,
      date: '2024-01-15',
      type: 'Annual Inspection',
      inspector: 'John Martinez',
      status: 'completed',
      score: 95,
      notes: 'Unit in excellent condition. Minor wear on kitchen faucet noted.',
      issues: ['Kitchen faucet showing wear', 'Bathroom grout needs touch-up']
    },
    {
      id: 2,
      date: '2023-07-20',
      type: 'Move-in Inspection',
      inspector: 'Sarah Chen',
      status: 'completed',
      score: 98,
      notes: 'Unit ready for occupancy. All systems functioning properly.',
      issues: []
    },
    {
      id: 3,
      date: '2023-06-15',
      type: 'Move-out Inspection',
      inspector: 'Mike Wilson',
      status: 'completed',
      score: 85,
      notes: 'Normal wear and tear. Some cleaning required.',
      issues: ['Carpet cleaning needed', 'Wall scuffs in hallway', 'Light fixture replacement required']
    }
  ];

  const mockUpcomingInspections = [
    {
      id: 1,
      date: '2024-07-15',
      type: 'Annual Inspection',
      inspector: 'TBD',
      status: 'scheduled',
      notes: 'Routine annual inspection'
    },
    {
      id: 2,
      date: '2024-03-01',
      type: 'Maintenance Follow-up',
      inspector: 'John Martinez',
      status: 'scheduled',
      notes: 'Follow-up on recent plumbing repairs'
    }
  ];

  // Mock data for monthly logs table
  const mockMonthlyLogs = [
    {
      id: 'ml-2024-02',
      period: 'February 2024',
      month: '2024-02',
      generatedDate: '2024-03-01',
      status: 'completed' as const,
      totalIncome: 2275,
      totalExpenses: 786,
      netIncome: 1589,
      ownerDistribution: 1589,
      managementFee: 176
    },
    {
      id: 'ml-2024-01',
      period: 'January 2024',
      month: '2024-01',
      generatedDate: '2024-02-01',
      status: 'completed' as const,
      totalIncome: 2200,
      totalExpenses: 695,
      netIncome: 1505,
      ownerDistribution: 1505,
      managementFee: 176
    },
    {
      id: 'ml-2023-12',
      period: 'December 2023',
      month: '2023-12',
      generatedDate: '2024-01-01',
      status: 'completed' as const,
      totalIncome: 2200,
      totalExpenses: 1250,
      netIncome: 950,
      ownerDistribution: 950,
      managementFee: 176
    },
    {
      id: 'ml-2024-03',
      period: 'March 2024',
      month: '2024-03',
      generatedDate: '2024-04-01',
      status: 'draft' as const,
      totalIncome: 2200,
      totalExpenses: 425,
      netIncome: 1775,
      ownerDistribution: 1775,
      managementFee: 176
    }
  ];

  useEffect(() => {
    if (unitId) {
      fetchUnitDetails();
    }
  }, [unitId]);

  const fetchUnitDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get unit from mock data
      const unitData = getUnitById(unitId);
      if (unitData) {
        setUnit({
          ...unitData,
          status: Math.random() > 0.3 ? 'occupied' : 'available',
          last_inspection: '2024-01-15',
          next_inspection: '2024-07-15',
          appliances: [
            { id: 1, name: 'Refrigerator', brand: 'Whirlpool', model: 'WRF535SWHZ', condition: 'Excellent', lastServiced: '2024-01-15', warrantyExpiry: '2025-06-01' },
            { id: 2, name: 'Dishwasher', brand: 'KitchenAid', model: 'KDTM354ESS', condition: 'Good', lastServiced: '2024-01-15', warrantyExpiry: '2024-12-01' },
            { id: 3, name: 'Stove/Oven', brand: 'GE', model: 'JGS750SPSS', condition: 'Good', lastServiced: '2023-11-20', warrantyExpiry: '2025-03-01' },
            { id: 4, name: 'Microwave', brand: 'Samsung', model: 'MS14K6000AS', condition: 'Fair', lastServiced: '2023-08-10', warrantyExpiry: '2024-05-01' },
            { id: 5, name: 'Washer/Dryer', brand: 'LG', model: 'WM3900HWA', condition: 'Excellent', lastServiced: '2024-02-01', warrantyExpiry: '2026-01-01' }
          ],
          lease_end_date: '2024-12-31',
          security_deposit: unitData.market_rent ? unitData.market_rent * 1.5 : 0
        });

        // Get property data
        const propertyData = getPropertyById(propertyId);
        if (propertyData) {
          setProperty(propertyData);
        }

        // Get lease data
        const leaseData = getLeasesByUnitId(unitId);
        if (leaseData.length > 0) {
          setLease({
            ...leaseData[0],
            tenant: {
              id: "tenant-1",
              first_name: "John",
              last_name: "Smith",
              email: "john.smith@email.com",
              phone: "(555) 123-4567"
            },
            monthly_rent: unitData.market_rent || 1200,
            security_deposit: unitData.market_rent ? unitData.market_rent * 1.5 : 1800,
            lease_start: '2024-01-01',
            lease_end: '2024-12-31',
            status: 'active'
          });
        }
      } else {
        setError('Unit not found');
      }
    } catch (err: any) {
      console.error('Error loading unit details:', err);
      setError(err.message || 'Failed to load unit details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'Excellent':
        return 'bg-green-100 text-green-800';
      case 'Good':
        return 'bg-blue-100 text-blue-800';
      case 'Fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'Poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'occupied':
        return { label: 'Occupied', className: 'bg-blue-100 text-blue-800' };
      case 'available':
        return { label: 'Available', className: 'bg-green-100 text-green-800' };
      case 'active':
        return { label: 'Active', className: 'bg-green-100 text-green-800' };
      case 'expired':
        return { label: 'Expired', className: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Unknown', className: 'bg-gray-100 text-gray-800' };
    }
  };

  const getLeaseStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', className: 'bg-green-100 text-green-800' };
      case 'expired':
        return { label: 'Expired', className: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Unknown', className: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Property
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading unit details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Property
          </Button>
        </div>
        <div className="text-center py-12">
          <h2 className="mb-4">Failed to Load Unit</h2>
          <p className="text-destructive mb-4">{error || 'Unit not found'}</p>
          <Button onClick={fetchUnitDetails} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(unit.status);
  const unitLeases = getUnitLeases();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Property
        </Button>
        <div className="flex-1">
          <h1 className="flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Unit {unit.unit_number}
          </h1>
          <p className="text-muted-foreground">{property?.name || 'Loading property...'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusBadge.className}>
            {statusBadge.label}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="w-4 h-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <FileText className="w-4 h-4 mr-2" />
                Create New Lease
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Receipt className="w-4 h-4 mr-2" />
                Generate Monthly Log
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Home className="w-4 h-4 mr-2" />
                Add New Appliance
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Edit Unit Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="monthly-log" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Monthly Log
          </TabsTrigger>
          <TabsTrigger value="inspections" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Inspections
          </TabsTrigger>
          <TabsTrigger value="appliances" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Appliances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* First Row - Unit Information and Management Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Unit Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Unit Number</p>
                    <p className="font-medium">{unit.unit_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={statusBadge.className}>
                      {statusBadge.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bedrooms</p>
                    <p className="font-medium">{unit.bedrooms || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bathrooms</p>
                    <p className="font-medium">{unit.bathrooms || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Square Feet</p>
                    <p className="font-medium">
                      {unit.square_feet ? unit.square_feet.toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Market Rent</p>
                    <p className="font-medium">{formatCurrency(unit.market_rent || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Management Details</CardTitle>
                  <Dialog open={isManagementDialogOpen} onOpenChange={setIsManagementDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Edit Management Details</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="servicePlan" className="text-right">
                            Service Plan
                          </Label>
                          <Select value={managementDetails.servicePlan} onValueChange={(value) => setManagementDetails(prev => ({ ...prev, servicePlan: value }))}>
                            <SelectTrigger className="col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Basic">Basic</SelectItem>
                              <SelectItem value="Standard">Standard</SelectItem>
                              <SelectItem value="Premium">Premium</SelectItem>
                              <SelectItem value="Full Service">Full Service</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="feeType" className="text-right">
                            Fee Type
                          </Label>
                          <Select value={managementDetails.feeType} onValueChange={(value) => setManagementDetails(prev => ({ ...prev, feeType: value }))}>
                            <SelectTrigger className="col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Percentage">Percentage</SelectItem>
                              <SelectItem value="Flat Rate">Flat Rate</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {managementDetails.feeType === "Percentage" && (
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="feePercent" className="text-right">
                              Fee %
                            </Label>
                            <Input
                              id="feePercent"
                              type="number"
                              value={managementDetails.feePercent}
                              onChange={(e) => setManagementDetails(prev => ({ ...prev, feePercent: parseFloat(e.target.value) }))}
                              className="col-span-3"
                              step="0.1"
                              min="0"
                              max="100"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-4 items-start gap-4">
                          <Label className="text-right pt-2">
                            Services
                          </Label>
                          <div className="col-span-3 space-y-2 max-h-32 overflow-y-auto">
                            {availableServices.map((service) => (
                              <div key={service} className="flex items-center space-x-2">
                                <Checkbox
                                  id={service}
                                  checked={managementDetails.activeServices.includes(service)}
                                  onCheckedChange={() => handleServiceToggle(service)}
                                />
                                <Label htmlFor={service} className="text-sm">{service}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsManagementDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={() => setIsManagementDialogOpen(false)}>
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Service Plan</p>
                    <p className="font-medium">{managementDetails.servicePlan}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fee Structure</p>
                    <p className="font-medium">
                      {managementDetails.feeType === "Percentage" 
                        ? `${managementDetails.feePercent}% of rent`
                        : "Flat rate"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Fee</p>
                    <p className="font-medium">{formatCurrency(managementDetails.managementFee)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Management Notes</p>
                    <p className="font-medium">Enter notes here.</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Active Services</p>
                  <div className="flex flex-wrap gap-1">
                    {managementDetails.activeServices.slice(0, 3).map((service) => (
                      <Badge key={service} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                    {managementDetails.activeServices.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{managementDetails.activeServices.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second Row - Lease History */}
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Lease History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Monthly Rent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unitLeases.map((lease) => (
                      <TableRow key={lease.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{lease.tenant.firstName} {lease.tenant.lastName}</p>
                            <p className="text-sm text-muted-foreground">{lease.tenant.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(lease.startDate)}</TableCell>
                        <TableCell>{formatDate(lease.endDate)}</TableCell>
                        <TableCell>{formatCurrency(lease.monthlyRent)}</TableCell>
                        <TableCell>
                          <Badge className={getLeaseStatusBadge(lease.status).className}>
                            {getLeaseStatusBadge(lease.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <FileText className="w-4 h-4 mr-2" />
                                Download Lease
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Third Row - Recent Activity */}
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockRecentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <activity.icon className={`w-4 h-4 mt-0.5 ${activity.iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p>{activity.description}</p>
                        <p className="text-muted-foreground">
                          {formatDate(activity.date)} at {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monthly-log" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Monthly Financial Logs</CardTitle>
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Generate New Log
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Income</TableHead>
                    <TableHead>Total Expenses</TableHead>
                    <TableHead>Net Income</TableHead>
                    <TableHead>Management Fee</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockMonthlyLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.period}</p>
                          <p className="text-sm text-muted-foreground">Generated: {formatDate(log.generatedDate)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(log.status)}>
                          {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {formatCurrency(log.totalIncome)}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {formatCurrency(log.totalExpenses)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(log.netIncome)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(log.managementFee)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => onMonthlyLogSelect && onMonthlyLogSelect(log.id)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="w-4 h-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            {log.status === 'draft' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Log
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Inspection History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockInspectionHistory.map((inspection) => (
                    <div key={inspection.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{inspection.type}</h4>
                        <Badge className="bg-green-100 text-green-800">
                          Score: {inspection.score}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {formatDate(inspection.date)} • Inspector: {inspection.inspector}
                      </p>
                      <p className="text-sm mb-2">{inspection.notes}</p>
                      {inspection.issues.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-1">Issues Found:</p>
                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                            {inspection.issues.map((issue, index) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Upcoming Inspections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockUpcomingInspections.map((inspection) => (
                    <div key={inspection.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{inspection.type}</h4>
                        <Badge className="bg-blue-100 text-blue-800">
                          {inspection.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {formatDate(inspection.date)} • Inspector: {inspection.inspector}
                      </p>
                      <p className="text-sm">{inspection.notes}</p>
                    </div>
                  ))}
                  <Button className="w-full mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule New Inspection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appliances" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Unit Appliances</CardTitle>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Appliance
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appliance</TableHead>
                    <TableHead>Brand & Model</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Last Serviced</TableHead>
                    <TableHead>Warranty Expiry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unit.appliances?.map((appliance: any) => (
                    <TableRow key={appliance.id}>
                      <TableCell className="font-medium">{appliance.name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{appliance.brand}</p>
                          <p className="text-sm text-muted-foreground">{appliance.model}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getConditionBadge(appliance.condition)}>
                          {appliance.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(appliance.lastServiced)}</TableCell>
                      <TableCell>{formatDate(appliance.warrantyExpiry)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="w-4 h-4 mr-2" />
                              Schedule Service
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="w-4 h-4 mr-2" />
                              View Manual
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
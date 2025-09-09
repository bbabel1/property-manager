import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Calendar, FileText, Users, Clock, CheckCircle, AlertTriangle, Send, Download, Eye, Plus, Search, Filter } from "lucide-react";

interface LeaseRenewal {
  id: string;
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  currentLeaseEnd: string;
  proposedStartDate: string;
  proposedEndDate: string;
  currentRent: number;
  proposedRent: number;
  status: 'pending' | 'sent' | 'under_review' | 'accepted' | 'declined' | 'expired';
  offerSentDate?: string;
  responseDeadline: string;
  documentStatus: 'not_generated' | 'generated' | 'sent' | 'signed' | 'completed';
  signatureStatus?: 'pending' | 'partial' | 'complete';
  daysToDeadline: number;
}

interface Lease {
  id: string;
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: number;
  securityDeposit: number;
  leaseStatus: 'active' | 'ending_soon' | 'expired' | 'terminated';
  leaseType: 'fixed' | 'month_to_month';
  daysUntilExpiration: number;
  renewalEligible: boolean;
  lastPaymentDate?: string;
  nextPaymentDue?: string;
}

const mockLeases: Lease[] = [
  {
    id: "lease-1",
    propertyName: "Sunset Apartments",
    unitNumber: "2A",
    tenantName: "Sarah Johnson",
    tenantEmail: "sarah.johnson@email.com",
    tenantPhone: "(555) 123-4567",
    leaseStartDate: "2024-01-01",
    leaseEndDate: "2024-12-31",
    monthlyRent: 2500,
    securityDeposit: 2500,
    leaseStatus: "ending_soon",
    leaseType: "fixed",
    daysUntilExpiration: 31,
    renewalEligible: true,
    lastPaymentDate: "2024-11-01",
    nextPaymentDue: "2024-12-01"
  },
  {
    id: "lease-2",
    propertyName: "Oak Street Complex",
    unitNumber: "1B",
    tenantName: "Mike Chen",
    tenantEmail: "mike.chen@email.com",
    tenantPhone: "(555) 234-5678",
    leaseStartDate: "2023-12-01",
    leaseEndDate: "2024-11-30",
    monthlyRent: 1800,
    securityDeposit: 1800,
    leaseStatus: "ending_soon",
    leaseType: "fixed",
    daysUntilExpiration: 10,
    renewalEligible: true,
    lastPaymentDate: "2024-11-01",
    nextPaymentDue: "2024-12-01"
  },
  {
    id: "lease-3",
    propertyName: "Downtown Lofts",
    unitNumber: "5C",
    tenantName: "Emily Rodriguez",
    tenantEmail: "emily.rodriguez@email.com",
    tenantPhone: "(555) 345-6789",
    leaseStartDate: "2024-01-16",
    leaseEndDate: "2025-01-15",
    monthlyRent: 3200,
    securityDeposit: 3200,
    leaseStatus: "active",
    leaseType: "fixed",
    daysUntilExpiration: 46,
    renewalEligible: true,
    lastPaymentDate: "2024-11-01",
    nextPaymentDue: "2024-12-01"
  },
  {
    id: "lease-4",
    propertyName: "Garden View Apartments",
    unitNumber: "3A",
    tenantName: "David Wilson",
    tenantEmail: "david.wilson@email.com",
    tenantPhone: "(555) 456-7890",
    leaseStartDate: "2023-12-16",
    leaseEndDate: "2024-12-15",
    monthlyRent: 2200,
    securityDeposit: 2200,
    leaseStatus: "ending_soon",
    leaseType: "fixed",
    daysUntilExpiration: 15,
    renewalEligible: true,
    lastPaymentDate: "2024-11-01",
    nextPaymentDue: "2024-12-01"
  },
  {
    id: "lease-5",
    propertyName: "Riverside Towers",
    unitNumber: "12B",
    tenantName: "Lisa Thompson",
    tenantEmail: "lisa.thompson@email.com",
    tenantPhone: "(555) 567-8901",
    leaseStartDate: "2024-01-01",
    leaseEndDate: "2024-12-31",
    monthlyRent: 2800,
    securityDeposit: 2800,
    leaseStatus: "ending_soon",
    leaseType: "fixed",
    daysUntilExpiration: 31,
    renewalEligible: false,
    lastPaymentDate: "2024-10-01",
    nextPaymentDue: "2024-12-01"
  },
  {
    id: "lease-6",
    propertyName: "Metropolitan Plaza",
    unitNumber: "7A",
    tenantName: "Robert Davis",
    tenantEmail: "robert.davis@email.com",
    tenantPhone: "(555) 678-9012",
    leaseStartDate: "2024-03-01",
    leaseEndDate: "2025-02-28",
    monthlyRent: 2950,
    securityDeposit: 2950,
    leaseStatus: "active",
    leaseType: "fixed",
    daysUntilExpiration: 90,
    renewalEligible: true,
    lastPaymentDate: "2024-11-01",
    nextPaymentDue: "2024-12-01"
  },
  {
    id: "lease-7",
    propertyName: "Sunset Apartments",
    unitNumber: "4B",
    tenantName: "Jennifer Martinez",
    tenantEmail: "jennifer.martinez@email.com",
    tenantPhone: "(555) 789-0123",
    leaseStartDate: "2023-06-01",
    leaseEndDate: "2024-05-31",
    monthlyRent: 2300,
    securityDeposit: 2300,
    leaseStatus: "expired",
    leaseType: "month_to_month",
    daysUntilExpiration: -183,
    renewalEligible: false,
    lastPaymentDate: "2024-10-01",
    nextPaymentDue: "2024-12-01"
  },
  {
    id: "lease-8",
    propertyName: "Oak Street Complex",
    unitNumber: "3C",
    tenantName: "Andrew Kim",
    tenantEmail: "andrew.kim@email.com",
    tenantPhone: "(555) 890-1234",
    leaseStartDate: "2024-07-01",
    leaseEndDate: "2025-06-30",
    monthlyRent: 1950,
    securityDeposit: 1950,
    leaseStatus: "active",
    leaseType: "fixed",
    daysUntilExpiration: 212,
    renewalEligible: false,
    lastPaymentDate: "2024-11-01",
    nextPaymentDue: "2024-12-01"
  }
];

const mockRenewals: LeaseRenewal[] = [
  {
    id: "1",
    propertyName: "Sunset Apartments",
    unitNumber: "2A",
    tenantName: "Sarah Johnson",
    currentLeaseEnd: "2024-12-31",
    proposedStartDate: "2025-01-01",
    proposedEndDate: "2025-12-31",
    currentRent: 2500,
    proposedRent: 2650,
    status: "sent",
    offerSentDate: "2024-11-15",
    responseDeadline: "2024-12-15",
    documentStatus: "sent",
    signatureStatus: "pending",
    daysToDeadline: 25
  },
  {
    id: "2",
    propertyName: "Oak Street Complex",
    unitNumber: "1B",
    tenantName: "Mike Chen",
    currentLeaseEnd: "2024-11-30",
    proposedStartDate: "2024-12-01",
    proposedEndDate: "2024-11-30",
    currentRent: 1800,
    proposedRent: 1890,
    status: "accepted",
    offerSentDate: "2024-10-01",
    responseDeadline: "2024-11-01",
    documentStatus: "signed",
    signatureStatus: "complete",
    daysToDeadline: -5
  },
  {
    id: "3",
    propertyName: "Downtown Lofts",
    unitNumber: "5C",
    tenantName: "Emily Rodriguez",
    currentLeaseEnd: "2025-01-15",
    proposedStartDate: "2025-01-16",
    proposedEndDate: "2026-01-15",
    currentRent: 3200,
    proposedRent: 3360,
    status: "pending",
    responseDeadline: "2024-12-30",
    documentStatus: "not_generated",
    daysToDeadline: 40
  },
  {
    id: "4",
    propertyName: "Garden View Apartments",
    unitNumber: "3A",
    tenantName: "David Wilson",
    currentLeaseEnd: "2024-12-15",
    proposedStartDate: "2024-12-16",
    proposedEndDate: "2025-12-15",
    currentRent: 2200,
    proposedRent: 2310,
    status: "under_review",
    offerSentDate: "2024-11-01",
    responseDeadline: "2024-12-01",
    documentStatus: "generated",
    signatureStatus: "pending",
    daysToDeadline: 11
  },
  {
    id: "5",
    propertyName: "Riverside Towers",
    unitNumber: "12B",
    tenantName: "Lisa Thompson",
    currentLeaseEnd: "2024-12-31",
    proposedStartDate: "2025-01-01",
    proposedEndDate: "2025-12-31",
    currentRent: 2800,
    proposedRent: 2940,
    status: "declined",
    offerSentDate: "2024-10-15",
    responseDeadline: "2024-11-15",
    documentStatus: "generated",
    daysToDeadline: -5
  }
];

export function LeaseRenewals() {
  const [renewals] = useState<LeaseRenewal[]>(mockRenewals);
  const [leases] = useState<Lease[]>(mockLeases);
  const [filteredRenewals, setFilteredRenewals] = useState<LeaseRenewal[]>(mockRenewals);
  const [filteredLeases, setFilteredLeases] = useState<Lease[]>(mockLeases);
  const [selectedRenewal, setSelectedRenewal] = useState<LeaseRenewal | null>(null);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leaseStatusFilter, setLeaseStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800">Sent</Badge>;
      case 'under_review':
        return <Badge className="bg-purple-100 text-purple-800">Under Review</Badge>;
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>;
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-800">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getDocumentStatusBadge = (status: string) => {
    switch (status) {
      case 'not_generated':
        return <Badge variant="outline">Not Generated</Badge>;
      case 'generated':
        return <Badge className="bg-blue-100 text-blue-800">Generated</Badge>;
      case 'sent':
        return <Badge className="bg-purple-100 text-purple-800">Sent</Badge>;
      case 'signed':
        return <Badge className="bg-green-100 text-green-800">Signed</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getLeaseStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'ending_soon':
        return <Badge className="bg-yellow-100 text-yellow-800">Ending Soon</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case 'terminated':
        return <Badge className="bg-gray-100 text-gray-800">Terminated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getExpirationStatus = (daysUntilExpiration: number) => {
    if (daysUntilExpiration < 0) {
      return { color: "text-red-600", icon: <AlertTriangle className="w-4 h-4" />, text: `${Math.abs(daysUntilExpiration)} days overdue` };
    } else if (daysUntilExpiration <= 30) {
      return { color: "text-orange-600", icon: <Clock className="w-4 h-4" />, text: `${daysUntilExpiration} days left` };
    } else {
      return { color: "text-muted-foreground", icon: <Clock className="w-4 h-4" />, text: `${daysUntilExpiration} days left` };
    }
  };

  const getDeadlineStatus = (daysToDeadline: number) => {
    if (daysToDeadline < 0) {
      return { color: "text-red-600", icon: <AlertTriangle className="w-4 h-4" />, text: `${Math.abs(daysToDeadline)} days overdue` };
    } else if (daysToDeadline <= 7) {
      return { color: "text-orange-600", icon: <Clock className="w-4 h-4" />, text: `${daysToDeadline} days left` };
    } else {
      return { color: "text-muted-foreground", icon: <Clock className="w-4 h-4" />, text: `${daysToDeadline} days left` };
    }
  };

  // Filter renewals based on search and status
  const filterRenewals = () => {
    let filtered = renewals;

    if (searchTerm) {
      filtered = filtered.filter(renewal => 
        renewal.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        renewal.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        renewal.unitNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(renewal => renewal.status === statusFilter);
    }

    setFilteredRenewals(filtered);
  };

  // Filter leases based on search and status
  const filterLeases = () => {
    let filtered = leases;

    if (searchTerm) {
      filtered = filtered.filter(lease => 
        lease.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lease.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lease.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lease.tenantEmail.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (leaseStatusFilter !== "all") {
      filtered = filtered.filter(lease => lease.leaseStatus === leaseStatusFilter);
    }

    setFilteredLeases(filtered);
  };

  // Summary statistics
  const stats = {
    total: renewals.length,
    pending: renewals.filter(r => r.status === 'pending').length,
    sent: renewals.filter(r => r.status === 'sent').length,
    accepted: renewals.filter(r => r.status === 'accepted').length,
    urgent: renewals.filter(r => r.daysToDeadline <= 7 && r.daysToDeadline >= 0).length,
    overdue: renewals.filter(r => r.daysToDeadline < 0).length
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Lease Renewals</h1>
          <p className="text-muted-foreground mt-1">
            Manage lease renewal offers, documents, and deadlines
          </p>
        </div>
        <Button onClick={() => setShowOfferDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Renewal Offer
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Renewals</p>
                <p className="text-lg font-medium">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-lg font-medium">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Send className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-lg font-medium">{stats.sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-lg font-medium">{stats.accepted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-lg font-medium">{stats.urgent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-lg font-medium">{stats.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leases">Leases</TabsTrigger>
          <TabsTrigger value="renewals">All Renewals</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Deadlines */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Upcoming Deadlines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {renewals
                    .filter(r => r.daysToDeadline <= 14)
                    .sort((a, b) => a.daysToDeadline - b.daysToDeadline)
                    .slice(0, 5)
                    .map((renewal) => {
                      const deadline = getDeadlineStatus(renewal.daysToDeadline);
                      return (
                        <div key={renewal.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{renewal.tenantName}</p>
                            <p className="text-sm text-muted-foreground">
                              {renewal.propertyName} - Unit {renewal.unitNumber}
                            </p>
                          </div>
                          <div className={`flex items-center gap-2 ${deadline.color}`}>
                            {deadline.icon}
                            <span className="text-sm font-medium">{deadline.text}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Mike Chen signed lease renewal</p>
                      <p className="text-sm text-muted-foreground">Oak Street Complex - Unit 1B</p>
                    </div>
                    <span className="text-sm text-muted-foreground">2 hours ago</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Renewal offer sent to Sarah Johnson</p>
                      <p className="text-sm text-muted-foreground">Sunset Apartments - Unit 2A</p>
                    </div>
                    <span className="text-sm text-muted-foreground">1 day ago</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Emily Rodriguez renewal pending</p>
                      <p className="text-sm text-muted-foreground">Downtown Lofts - Unit 5C</p>
                    </div>
                    <span className="text-sm text-muted-foreground">3 days ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leases">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Current Leases</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search leases..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setTimeout(() => {
                          filterLeases();
                          filterRenewals();
                        }, 0);
                      }}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={leaseStatusFilter} onValueChange={(value) => {
                    setLeaseStatusFilter(value);
                    setTimeout(filterLeases, 0);
                  }}>
                    <SelectTrigger className="w-40">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="ending_soon">Ending Soon</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property/Unit</TableHead>
                    <TableHead>Lease Period</TableHead>
                    <TableHead>Monthly Rent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeases.map((lease) => {
                    const expiration = getExpirationStatus(lease.daysUntilExpiration);
                    return (
                      <TableRow key={lease.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{lease.tenantName}</p>
                            <p className="text-sm text-muted-foreground">{lease.tenantEmail}</p>
                            <p className="text-sm text-muted-foreground">{lease.tenantPhone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{lease.propertyName}</p>
                            <p className="text-sm text-muted-foreground">Unit {lease.unitNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{formatDate(lease.leaseStartDate)} - {formatDate(lease.leaseEndDate)}</p>
                            <p className="text-sm text-muted-foreground capitalize">{lease.leaseType.replace('_', ' ')}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatCurrency(lease.monthlyRent)}</p>
                            <p className="text-sm text-muted-foreground">Deposit: {formatCurrency(lease.securityDeposit)}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getLeaseStatusBadge(lease.leaseStatus)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 ${expiration.color}`}>
                            {expiration.icon}
                            <div>
                              <p className="text-sm font-medium">{formatDate(lease.leaseEndDate)}</p>
                              <p className="text-xs">{expiration.text}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lease.renewalEligible ? (
                            <Badge className="bg-green-100 text-green-800">Eligible</Badge>
                          ) : (
                            <Badge variant="outline">Not Eligible</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {lease.renewalEligible && (
                              <Button variant="ghost" size="sm" onClick={() => setShowOfferDialog(true)}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewals">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Lease Renewals</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search renewals..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setTimeout(filterRenewals, 0);
                      }}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(value) => {
                    setStatusFilter(value);
                    setTimeout(filterRenewals, 0);
                  }}>
                    <SelectTrigger className="w-40">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Current Rent</TableHead>
                    <TableHead>Proposed Rent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRenewals.map((renewal) => {
                    const deadline = getDeadlineStatus(renewal.daysToDeadline);
                    return (
                      <TableRow key={renewal.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{renewal.tenantName}</p>
                            <p className="text-sm text-muted-foreground">
                              Lease ends: {formatDate(renewal.currentLeaseEnd)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{renewal.propertyName}</p>
                            <p className="text-sm text-muted-foreground">Unit {renewal.unitNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(renewal.currentRent)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatCurrency(renewal.proposedRent)}</p>
                            <p className="text-sm text-green-600">
                              +{formatCurrency(renewal.proposedRent - renewal.currentRent)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(renewal.status)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 ${deadline.color}`}>
                            {deadline.icon}
                            <div>
                              <p className="text-sm font-medium">{formatDate(renewal.responseDeadline)}</p>
                              <p className="text-xs">{deadline.text}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getDocumentStatusBadge(renewal.documentStatus)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setSelectedRenewal(renewal);
                              setShowDocumentDialog(true);
                            }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Document Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renewals.filter(r => r.documentStatus !== 'not_generated').map((renewal) => (
                  <div key={renewal.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      {getDocumentStatusBadge(renewal.documentStatus)}
                    </div>
                    <h3 className="font-medium mb-1">{renewal.tenantName}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {renewal.propertyName} - Unit {renewal.unitNumber}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadlines">
          <Card>
            <CardHeader>
              <CardTitle>Renewal Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {renewals
                  .sort((a, b) => a.daysToDeadline - b.daysToDeadline)
                  .map((renewal) => {
                    const deadline = getDeadlineStatus(renewal.daysToDeadline);
                    return (
                      <div key={renewal.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${deadline.color === 'text-red-600' ? 'bg-red-100' : deadline.color === 'text-orange-600' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                            {deadline.icon}
                          </div>
                          <div>
                            <p className="font-medium">{renewal.tenantName}</p>
                            <p className="text-sm text-muted-foreground">
                              {renewal.propertyName} - Unit {renewal.unitNumber}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Deadline: {formatDate(renewal.responseDeadline)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(renewal.status)}
                          <p className={`text-sm mt-1 ${deadline.color}`}>
                            {deadline.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Renewal Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Renewal Offer</DialogTitle>
            <DialogDescription>
              Generate a new lease renewal offer for a tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Property</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunset">Sunset Apartments</SelectItem>
                    <SelectItem value="oak">Oak Street Complex</SelectItem>
                    <SelectItem value="downtown">Downtown Lofts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1a">1A</SelectItem>
                    <SelectItem value="2a">2A</SelectItem>
                    <SelectItem value="3a">3A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Current Rent</Label>
                <Input type="number" placeholder="2500" />
              </div>
              <div>
                <Label>Proposed Rent</Label>
                <Input type="number" placeholder="2650" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lease Start Date</Label>
                <Input type="date" />
              </div>
              <div>
                <Label>Lease End Date</Label>
                <Input type="date" />
              </div>
            </div>
            <div>
              <Label>Response Deadline</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Additional Terms</Label>
              <Textarea placeholder="Enter any additional terms or conditions..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setShowOfferDialog(false);
                alert('Renewal offer created successfully!');
              }}>
                Create Offer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Details Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>
              Manage renewal documents and signatures for {selectedRenewal?.tenantName}
            </DialogDescription>
          </DialogHeader>
          {selectedRenewal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">PROPERTY</Label>
                  <p className="font-medium">{selectedRenewal.propertyName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">UNIT</Label>
                  <p className="font-medium">Unit {selectedRenewal.unitNumber}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">CURRENT RENT</Label>
                  <p className="font-medium">{formatCurrency(selectedRenewal.currentRent)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">PROPOSED RENT</Label>
                  <p className="font-medium">{formatCurrency(selectedRenewal.proposedRent)}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">DOCUMENT STATUS</Label>
                <div className="mt-2">{getDocumentStatusBadge(selectedRenewal.documentStatus)}</div>
              </div>
              {selectedRenewal.signatureStatus && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">SIGNATURE STATUS</Label>
                  <div className="mt-2">
                    {selectedRenewal.signatureStatus === 'complete' ? (
                      <Badge className="bg-green-100 text-green-800">All Signed</Badge>
                    ) : selectedRenewal.signatureStatus === 'partial' ? (
                      <Badge className="bg-yellow-100 text-yellow-800">Partially Signed</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">Pending Signatures</Badge>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDocumentDialog(false)}>
                  Close
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button>
                  <Send className="w-4 h-4 mr-2" />
                  Send Reminder
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
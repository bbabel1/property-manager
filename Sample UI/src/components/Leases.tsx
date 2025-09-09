import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Search, Plus, Eye, Edit, FileText } from "lucide-react";
import { 
  mockLeases, 
  mockUnits, 
  mockTenants, 
  mockProperties, 
  mockLeaseTenants 
} from "../utils/mockData";

export function Leases() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Get leases from mock data
  const leases = mockLeases;
  
  // Get related data for display
  const units = mockUnits;
  const tenants = mockTenants;
  const properties = mockProperties;
  const leaseTenantsData = mockLeaseTenants;

  // Create lookup maps for efficient data retrieval
  const unitMap = new Map(units.map(unit => [unit.id, unit]));
  const tenantMap = new Map(tenants.map(tenant => [tenant.id, tenant]));
  const propertyMap = new Map(properties.map(property => [property.id, property]));

  // Filter leases based on search and status
  const filteredLeases = leases.filter(lease => {
    const matchesSearch = searchTerm === "" || 
      lease.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (unitMap.get(lease.unit_id)?.unit_number || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || lease.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-800 border-red-300">Expired</Badge>;
      case "terminated":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Terminated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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

  // Get primary tenant for a lease
  const getPrimaryTenant = (leaseId: string) => {
    const leaseTenant = leaseTenantsData.find(lt => 
      lt.lease_id === leaseId && lt.role === 'primary'
    );
    return leaseTenant ? tenantMap.get(leaseTenant.tenant_id) : null;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Leases</h1>
          <p className="text-muted-foreground">
            Manage lease agreements and tenant relationships
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Lease
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Leases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leases.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Leases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {leases.filter(l => l.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {leases.filter(l => {
                const endDate = new Date(l.end_date);
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                return endDate <= thirtyDaysFromNow && l.status === 'active';
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Rent Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(
                leases
                  .filter(l => l.status === 'active')
                  .reduce((sum, l) => sum + l.rent, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search leases by ID or unit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leases Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Leases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lease ID</TableHead>
                  <TableHead>Primary Tenant</TableHead>
                  <TableHead>Property/Unit</TableHead>
                  <TableHead>Lease Period</TableHead>
                  <TableHead>Monthly Rent</TableHead>
                  <TableHead>Security Deposit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No leases found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeases.map((lease) => {
                    const unit = unitMap.get(lease.unit_id);
                    const property = unit ? propertyMap.get(unit.property_id) : null;
                    const primaryTenant = getPrimaryTenant(lease.id);

                    return (
                      <TableRow key={lease.id}>
                        <TableCell className="font-mono text-sm">
                          {lease.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {primaryTenant ? (
                            <div>
                              <div className="font-medium">
                                {primaryTenant.first_name} {primaryTenant.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {primaryTenant.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No primary tenant</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {property && unit ? (
                            <div>
                              <div className="font-medium">{property.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Unit {unit.unit_number}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{formatDate(lease.start_date)}</div>
                            <div className="text-sm text-muted-foreground">
                              to {formatDate(lease.end_date)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {formatCurrency(lease.rent)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {formatCurrency(lease.security_deposit)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(lease.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <FileText className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
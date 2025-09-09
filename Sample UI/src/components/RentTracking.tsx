import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Search, DollarSign, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { projectId } from '../utils/supabase/info';

interface RentRecord {
  id: string;
  tenantId: string;
  tenant?: string;
  property?: string;
  unit?: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: string;
  method?: string;
}

interface RentTrackingProps {
  accessToken?: string;
}

// Mock data for when backend is not available
const mockRentData: RentRecord[] = [
  {
    id: "1",
    tenantId: "1",
    tenant: "John Smith",
    property: "Sunset Apartments",
    unit: "2A",
    amount: 1550,
    dueDate: "2025-01-01",
    paidDate: "2024-12-30",
    status: "Paid",
    method: "Bank Transfer"
  },
  {
    id: "2",
    tenantId: "2",
    tenant: "Sarah Johnson",
    property: "Oak Street House",
    unit: "Main",
    amount: 2800,
    dueDate: "2025-01-01",
    paidDate: undefined,
    status: "Pending",
    method: undefined
  },
  {
    id: "3",
    tenantId: "3",
    tenant: "Michael Brown",
    property: "Pine View Complex",
    unit: "15B",
    amount: 1300,
    dueDate: "2024-12-01",
    paidDate: undefined,
    status: "Overdue",
    method: undefined
  },
  {
    id: "4",
    tenantId: "4",
    tenant: "Emily Davis",
    property: "Sunset Apartments",
    unit: "4C",
    amount: 1650,
    dueDate: "2025-01-01",
    paidDate: "2024-12-28",
    status: "Paid",
    method: "Check"
  },
  {
    id: "5",
    tenantId: "5",
    tenant: "Robert Wilson",
    property: "Pine View Complex",
    unit: "8A",
    amount: 1400,
    dueDate: "2025-01-01",
    paidDate: undefined,
    status: "Pending",
    method: undefined
  }
];

export function RentTracking({ accessToken }: RentTrackingProps) {
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  useEffect(() => {
    if (accessToken && !accessToken.startsWith('demo-mode')) {
      fetchRentRecords();
    } else {
      // Use mock data for demo mode or when not authenticated
      setRentRecords(mockRentData);
      setBackendAvailable(false);
      setLoading(false);
    }
  }, [accessToken]);

  const fetchRentRecords = async () => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rent`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRentRecords(data.rentRecords || []);
        setBackendAvailable(true);
      } else {
        console.log('Backend not available, using mock data');
        setRentRecords(mockRentData);
        setBackendAvailable(false);
      }
    } catch (error) {
      console.log('Backend not available, using mock data:', error);
      setRentRecords(mockRentData);
      setBackendAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (rentId: string) => {
    if (accessToken && !accessToken.startsWith('demo-mode') && backendAvailable) {
      // Try to update via backend
      try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rent/${rentId.split(':').pop()}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'Paid',
            paidDate: new Date().toISOString().split('T')[0],
            method: 'Cash'
          })
        });

        if (response.ok) {
          const data = await response.json();
          setRentRecords(prev => prev.map(record => 
            record.id === rentId ? data.rentRecord : record
          ));
        } else {
          console.error('Failed to update rent record:', await response.text());
          markPaidLocally(rentId);
        }
      } catch (error) {
        console.error('Error updating rent record:', error);
        markPaidLocally(rentId);
      }
    } else {
      // Update locally for demo mode
      markPaidLocally(rentId);
    }
  };

  const markPaidLocally = (rentId: string) => {
    setRentRecords(prev => prev.map(record => 
      record.id === rentId ? {
        ...record,
        status: 'Paid',
        paidDate: new Date().toISOString().split('T')[0],
        method: 'Cash'
      } : record
    ));
  };

  const filteredRentRecords = rentRecords.filter(rent => {
    const matchesSearch = (rent.tenant?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                         (rent.property?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                         (rent.unit?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || rent.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalExpected = rentRecords.reduce((sum, rent) => sum + rent.amount, 0);
  const totalCollected = rentRecords
    .filter(rent => rent.status === "Paid")
    .reduce((sum, rent) => sum + rent.amount, 0);
  const pendingAmount = rentRecords
    .filter(rent => rent.status === "Pending")
    .reduce((sum, rent) => sum + rent.amount, 0);
  const overdueAmount = rentRecords
    .filter(rent => rent.status === "Overdue")
    .reduce((sum, rent) => sum + rent.amount, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Paid":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "Overdue":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Calendar className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Paid":
        return "default";
      case "Overdue":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (!accessToken) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1>Rent Tracking</h1>
          <p className="text-muted-foreground">Please sign in to track rent payments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1>Rent Tracking</h1>
        <p className="text-muted-foreground">Monitor rent payments and collections</p>
        {!backendAvailable && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              Demo mode: Changes are temporary. Backend integration available with Supabase setup.
            </p>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalExpected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Current month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalCollected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}% collected
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${pendingAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {rentRecords.filter(r => r.status === "Pending").length} payments pending
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${overdueAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {rentRecords.filter(r => r.status === "Overdue").length} payments overdue
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rent records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Rent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <p>Loading rent records...</p>
            </div>
          ) : filteredRentRecords.length === 0 ? (
            <div className="text-center p-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No rent records yet</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "No rent records match your search." : "Rent records will appear here when tenants are added."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentRecords.map((rent) => (
                  <TableRow key={rent.id}>
                    <TableCell className="font-medium">{rent.tenant || "Unknown"}</TableCell>
                    <TableCell>{rent.property || "N/A"}</TableCell>
                    <TableCell>{rent.unit || "N/A"}</TableCell>
                    <TableCell>${rent.amount}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(rent.dueDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rent.paidDate ? new Date(rent.paidDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(rent.status)}
                        <Badge variant={getStatusVariant(rent.status)}>
                          {rent.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{rent.method || "-"}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {rent.status !== "Paid" && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleMarkPaid(rent.id)}
                          >
                            Mark Paid
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
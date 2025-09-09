import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, Search, Wrench, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { projectId } from '../utils/supabase/info';

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  property: string;
  unit: string;
  tenant: string;
  priority: string;
  status: string;
  dateSubmitted: string;
  dateScheduled?: string;
  assignedTo?: string;
}

interface Property {
  id: string;
  name: string;
}

interface MaintenanceProps {
  accessToken?: string;
}

// Mock data for when backend is not available
const mockMaintenanceRequests: MaintenanceRequest[] = [
  {
    id: "1",
    title: "Leaky faucet in kitchen",
    description: "Kitchen faucet has been dripping for 3 days",
    property: "Sunset Apartments",
    unit: "2A",
    tenant: "John Smith",
    priority: "Medium",
    status: "In Progress",
    dateSubmitted: "2025-01-06",
    dateScheduled: "2025-01-08",
    assignedTo: "Mike's Plumbing"
  },
  {
    id: "2",
    title: "Broken air conditioning",
    description: "AC unit not cooling properly, making loud noises",
    property: "Oak Street House",
    unit: "Main",
    tenant: "Sarah Johnson",
    priority: "High",
    status: "Open",
    dateSubmitted: "2025-01-05",
    dateScheduled: undefined,
    assignedTo: undefined
  },
  {
    id: "3",
    title: "Clogged bathroom drain",
    description: "Bathroom sink drains very slowly",
    property: "Pine View Complex",
    unit: "15B",
    tenant: "Michael Brown",
    priority: "Low",
    status: "Completed",
    dateSubmitted: "2025-01-03",
    dateScheduled: "2025-01-04",
    assignedTo: "ABC Maintenance"
  },
  {
    id: "4",
    title: "Smoke detector beeping",
    description: "Smoke detector in bedroom beeping intermittently",
    property: "Sunset Apartments",
    unit: "4C",
    tenant: "Emily Davis",
    priority: "High",
    status: "Open",
    dateSubmitted: "2025-01-07",
    dateScheduled: undefined,
    assignedTo: undefined
  }
];

const mockProperties: Property[] = [
  { id: "1", name: "Sunset Apartments" },
  { id: "2", name: "Oak Street House" },
  { id: "3", name: "Pine View Complex" },
  { id: "4", name: "Elm Street Duplex" }
];

export function Maintenance({ accessToken }: MaintenanceProps) {
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    property: "",
    unit: "",
    tenant: "",
    priority: ""
  });

  useEffect(() => {
    if (accessToken && !accessToken.startsWith('demo-mode')) {
      fetchMaintenanceRequests();
      fetchProperties();
    } else {
      // Use mock data for demo mode or when not authenticated
      setMaintenanceRequests(mockMaintenanceRequests);
      setProperties(mockProperties);
      setBackendAvailable(false);
      setLoading(false);
    }
  }, [accessToken]);

  const fetchMaintenanceRequests = async () => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/maintenance`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMaintenanceRequests(data.maintenanceRequests || []);
        setBackendAvailable(true);
      } else {
        console.log('Backend not available, using mock data');
        setMaintenanceRequests(mockMaintenanceRequests);
        setBackendAvailable(false);
      }
    } catch (error) {
      console.log('Backend not available, using mock data:', error);
      setMaintenanceRequests(mockMaintenanceRequests);
      setBackendAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/properties`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      } else {
        console.log('Backend not available for properties, using mock data');
        setProperties(mockProperties);
      }
    } catch (error) {
      console.log('Backend not available for properties, using mock data:', error);
      setProperties(mockProperties);
    }
  };

  const handleAddRequest = async () => {
    if (!formData.title || !formData.description || !formData.property || !formData.priority) {
      return;
    }

    if (accessToken && !accessToken.startsWith('demo-mode') && backendAvailable) {
      // Try to add via backend
      try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/maintenance`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          const data = await response.json();
          setMaintenanceRequests(prev => [...prev, data.maintenanceRequest]);
        } else {
          console.error('Failed to create maintenance request:', await response.text());
          addRequestLocally();
        }
      } catch (error) {
        console.error('Error creating maintenance request:', error);
        addRequestLocally();
      }
    } else {
      // Add locally for demo mode
      addRequestLocally();
    }

    setFormData({ title: "", description: "", property: "", unit: "", tenant: "", priority: "" });
    setIsAddDialogOpen(false);
  };

  const addRequestLocally = () => {
    const newRequest: MaintenanceRequest = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description,
      property: formData.property,
      unit: formData.unit,
      tenant: formData.tenant,
      priority: formData.priority,
      status: "Open",
      dateSubmitted: new Date().toISOString().split('T')[0],
      dateScheduled: undefined,
      assignedTo: undefined
    };
    setMaintenanceRequests(prev => [...prev, newRequest]);
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    if (accessToken && !accessToken.startsWith('demo-mode') && backendAvailable) {
      // Try to update via backend
      try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/maintenance/${requestId.split(':').pop()}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: newStatus,
            dateScheduled: newStatus === 'In Progress' ? new Date().toISOString().split('T')[0] : undefined
          })
        });

        if (response.ok) {
          const data = await response.json();
          setMaintenanceRequests(prev => prev.map(request => 
            request.id === requestId ? data.maintenanceRequest : request
          ));
        } else {
          console.error('Failed to update maintenance request:', await response.text());
          updateStatusLocally(requestId, newStatus);
        }
      } catch (error) {
        console.error('Error updating maintenance request:', error);
        updateStatusLocally(requestId, newStatus);
      }
    } else {
      // Update locally for demo mode
      updateStatusLocally(requestId, newStatus);
    }
  };

  const updateStatusLocally = (requestId: string, newStatus: string) => {
    setMaintenanceRequests(prev => prev.map(request => 
      request.id === requestId ? {
        ...request,
        status: newStatus,
        dateScheduled: newStatus === 'In Progress' ? new Date().toISOString().split('T')[0] : request.dateScheduled
      } : request
    ));
  };

  const filteredRequests = maintenanceRequests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.tenant.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === "all" || request.priority.toLowerCase() === priorityFilter;
    const matchesStatus = statusFilter === "all" || request.status.toLowerCase().replace(" ", "") === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const openRequests = maintenanceRequests.filter(r => r.status === "Open").length;
  const inProgressRequests = maintenanceRequests.filter(r => r.status === "In Progress").length;
  const completedRequests = maintenanceRequests.filter(r => r.status === "Completed").length;
  const urgentRequests = maintenanceRequests.filter(r => r.priority === "High" && r.status !== "Completed").length;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "High":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "Medium":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Wrench className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "In Progress":
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "High":
        return "destructive";
      case "Medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Completed":
        return "default";
      case "In Progress":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!accessToken) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1>Maintenance Requests</h1>
          <p className="text-muted-foreground">Please sign in to manage maintenance requests</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Maintenance Requests</h1>
          <p className="text-muted-foreground">Track and manage maintenance requests</p>
          {!backendAvailable && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Demo mode: Changes are temporary. Backend integration available with Supabase setup.
              </p>
            </div>
          )}
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Add Maintenance Request</DialogTitle>
              <DialogDescription>
                Create a new maintenance request for a property.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="request-title" className="text-right">
                  Title
                </Label>
                <Input 
                  id="request-title" 
                  className="col-span-3" 
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="request-description" className="text-right pt-2">
                  Description
                </Label>
                <Textarea 
                  id="request-description" 
                  className="col-span-3" 
                  rows={3} 
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="request-property" className="text-right">
                  Property
                </Label>
                <Select value={formData.property} onValueChange={(value) => setFormData(prev => ({ ...prev, property: value }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.name}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="request-unit" className="text-right">
                  Unit
                </Label>
                <Input 
                  id="request-unit" 
                  className="col-span-3" 
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="request-tenant" className="text-right">
                  Tenant
                </Label>
                <Input 
                  id="request-tenant" 
                  className="col-span-3" 
                  value={formData.tenant}
                  onChange={(e) => setFormData(prev => ({ ...prev, tenant: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="request-priority" className="text-right">
                  Priority
                </Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddRequest}>Create Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Requests</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRequests}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting assignment
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressRequests}</div>
            <p className="text-xs text-muted-foreground">
              Currently being worked on
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedRequests}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentRequests}</div>
            <p className="text-xs text-muted-foreground">
              High priority open
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="inprogress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p>Loading maintenance requests...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRequests.length === 0 ? (
            <div className="col-span-full text-center p-8">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No maintenance requests yet</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No requests match your search." : "Create your first maintenance request."}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Request
                </Button>
              )}
            </div>
          ) : (
            filteredRequests.map((request) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{request.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {request.property} - Unit {request.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Tenant: {request.tenant}
                      </p>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        {getPriorityIcon(request.priority)}
                        <Badge variant={getPriorityVariant(request.priority)}>
                          {request.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(request.status)}
                        <Badge variant={getStatusVariant(request.status)}>
                          {request.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{request.description}</p>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div>Submitted: {new Date(request.dateSubmitted).toLocaleDateString()}</div>
                    {request.dateScheduled && (
                      <div>Scheduled: {new Date(request.dateScheduled).toLocaleDateString()}</div>
                    )}
                    {request.assignedTo && (
                      <div>Assigned to: {request.assignedTo}</div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    {request.status === "Open" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleUpdateStatus(request.id, "In Progress")}
                      >
                        Start Work
                      </Button>
                    )}
                    {request.status === "In Progress" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleUpdateStatus(request.id, "Completed")}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
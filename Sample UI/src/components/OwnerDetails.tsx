import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { TaxProfileDialog } from "./TaxProfileDialog";
import { EditOwnerDialog } from "./EditOwnerDialog";
import { 
  ArrowLeft,
  Edit,
  Building2,
  Mail,
  Phone,
  MapPin,
  Star,
  DollarSign,
  Calendar,
  ExternalLink,
  MessageSquare,
  FileText,
  Download,
  Eye,
  Send,
  Plus,
  CheckCircle,
  AlertCircle,
  Settings,
  Copy,
  Upload,
  TrendingUp,
  Users,
  CreditCard,
  Shield,
  Activity,
  Home,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  X,
  Check
} from "lucide-react";

// Mock data for the selected owner
const mockOwnerData = {
  id: "owner-1",
  first_name: "Robert",
  last_name: "Johnson",
  email: "robert.johnson@email.com",
  phone: "(555) 123-4567",
  alternate_email: "robert.j.alt@email.com",
  alternate_phone: "(555) 987-6543",
  address: "123 Oak Street, Suite 400",
  city: "San Francisco",
  state: "CA",
  zip: "94102",
  entity_type: "Individual",
  primary_owner: true,
  tax_id: "***-**-6789",
  date_added: "2023-01-15",
  referral_source: "Property Manager Referral",
  preferred_contact: "Email",
  email_opt_in: true,
  text_opt_in: false,
  status: "Active",
  loyalty_status: "Gold Member",
  total_properties: 2,
  total_units: 20,
  monthly_revenue: 25200,
  account_balance: 45750,
  ytd_disbursements: 185000,
  last_contact: "2024-01-15",
  etf_enabled: true,
  account_type: "Checking",
  account_number: "****1234",
  routing_number: "****5678",
  properties: [
    { 
      id: "prop-1", 
      name: "Sunset Apartments", 
      address: "456 Sunset Blvd, San Francisco, CA", 
      ownership_percentage: 100,
      units: 12,
      monthly_income: 14400,
      property_type: "MultiFamily",
      status: "Active",
      occupancy_rate: 95,
      other_owners: "None"
    },
    { 
      id: "prop-2", 
      name: "Marina Plaza", 
      address: "789 Marina Dr, San Francisco, CA", 
      ownership_percentage: 75,
      units: 8,
      monthly_income: 10800,
      property_type: "CondoTownhome",
      status: "Active",
      occupancy_rate: 88,
      other_owners: "Sarah Chen (25%)"
    }
  ],
  recent_transactions: [
    { id: "tx1", date: "2024-01-15", description: "Monthly Disbursement - Sunset Apartments", amount: 12800, type: "disbursement" },
    { id: "tx2", date: "2024-01-10", description: "Maintenance Reserve Transfer", amount: -1500, type: "reserve" },
    { id: "tx3", date: "2024-01-05", description: "Management Fee - Marina Plaza", amount: -850, type: "fee" },
    { id: "tx4", date: "2024-01-01", description: "Rent Collection - Sunset Apartments", amount: 14400, type: "income" },
    { id: "tx5", date: "2023-12-28", description: "Property Tax Payment", amount: -3200, type: "expense" }
  ],
  communications: [
    { id: "comm1", date: "2024-01-15", type: "email", subject: "Monthly Statement Available", status: "opened" },
    { id: "comm2", date: "2024-01-10", type: "phone", subject: "Maintenance Discussion", status: "completed", duration: "15 min" },
    { id: "comm3", date: "2024-01-05", type: "email", subject: "Quarterly Report", status: "sent" }
  ],
  documents: [
    { id: "doc1", name: "Management Agreement 2024.pdf", type: "Agreement", date: "2024-01-01", size: "2.3 MB" },
    { id: "doc2", name: "W-9 Form.pdf", type: "Tax Document", date: "2023-12-15", size: "145 KB" },
    { id: "doc3", name: "Direct Deposit Form.pdf", type: "Banking", date: "2023-11-20", size: "89 KB" }
  ],
  tasks: [
    { id: "task1", title: "Review 2024 Management Agreement", status: "pending", due_date: "2024-02-01", priority: "high" },
    { id: "task2", title: "Update banking information", status: "completed", due_date: "2024-01-15", priority: "medium" }
  ]
};

interface OwnerDetailsProps {
  ownerId: string;
  onBack: () => void;
}

export function OwnerDetails({ ownerId, onBack }: OwnerDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [ownerData, setOwnerData] = useState(mockOwnerData);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editFormData, setEditFormData] = useState(mockOwnerData);
  const [isEditingTaxProfile, setIsEditingTaxProfile] = useState(false);
  const [taxFormData, setTaxFormData] = useState({
    entity_type: mockOwnerData.entity_type,
    tax_id: mockOwnerData.tax_id,
    date_of_birth: "1993-06-14",
    ssn_last4: "6789"
  });

  // Mock tax completion data
  const taxProfileCompletion = 85;
  const isTaxProfileComplete = taxProfileCompletion >= 80;

  // Handle owner data save
  const handleSaveOwnerData = (updatedData: any) => {
    setOwnerData(updatedData);
    console.log('Owner data updated:', updatedData);
    // Here you would typically make an API call to save the data
  };

  // Handle inline edit save
  const handleInlineEditSave = () => {
    setOwnerData(editFormData);
    setIsEditingInline(false);
    console.log('Owner data updated via inline edit:', editFormData);
    // Here you would typically make an API call to save the data
  };

  // Handle inline edit cancel
  const handleInlineEditCancel = () => {
    setEditFormData(ownerData);
    setIsEditingInline(false);
  };

  // Handle form field changes
  const handleFormFieldChange = (field: string, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200';
  };

  const getPropertyStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-50 text-green-700 border-green-200';
      case 'Inactive': return 'bg-red-50 text-red-700 border-red-200';
      case 'Maintenance': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Sold': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType) {
      case 'Individual': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Corporation': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'LLC': return 'bg-green-50 text-green-700 border-green-200';
      case 'Partnership': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Trust': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simplified Header */}
      <div className="bg-white border-b">
        <div className="w-full px-8 py-4">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={onBack} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="text-sm text-muted-foreground">
              Owners / <span className="text-foreground font-medium">{mockOwnerData.first_name} {mockOwnerData.last_name}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Avatar className="w-16 h-16">
                <AvatarImage src={null} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {mockOwnerData.first_name[0]}{mockOwnerData.last_name[0]}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold">
                    {mockOwnerData.first_name} {mockOwnerData.last_name}
                  </h1>
                  <Badge className={getStatusColor(mockOwnerData.status)}>
                    {mockOwnerData.status}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <Badge className={getEntityTypeColor(mockOwnerData.entity_type)}>
                    {mockOwnerData.entity_type}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>{mockOwnerData.total_properties} Properties • {mockOwnerData.total_units} Units</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span>Last contact {formatDate(mockOwnerData.last_contact)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => setEditDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-8 pt-6 pb-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Financials
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Properties ({mockOwnerData.properties.length})
            </TabsTrigger>
            <TabsTrigger value="communications" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Communications
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Owner Information */}
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  {/* Rental Owner Information Section */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-medium">Rental owner information</h3>
                      {isEditingInline ? (
                        <Button
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-foreground" 
                          onClick={handleInlineEditCancel}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 hover:text-blue-700" 
                          onClick={() => setIsEditingInline(true)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>

                    {isEditingInline ? (
                      /* Inline Edit Form */
                      <div className="space-y-6 border-l-4 border-blue-500 pl-4">
                        {/* Email Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="primary-email" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              PRIMARY EMAIL
                            </Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              <Input
                                id="primary-email"
                                type="email"
                                value={editFormData.email}
                                onChange={(e) => handleFormFieldChange('email', e.target.value)}
                                className="pl-10 bg-input-background"
                                placeholder="Enter primary email"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="alternate-email" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              ALTERNATE EMAIL
                            </Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              <Input
                                id="alternate-email"
                                type="email"
                                value={editFormData.alternate_email}
                                onChange={(e) => handleFormFieldChange('alternate_email', e.target.value)}
                                className="pl-10 bg-input-background"
                                placeholder="Enter alternate email"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Phone Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              PHONE NUMBERS
                            </Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              <Input
                                id="phone"
                                type="tel"
                                value={editFormData.phone}
                                onChange={(e) => handleFormFieldChange('phone', e.target.value)}
                                className="pl-10 bg-input-background"
                                placeholder="(555) 325-4491"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="alternate-phone" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              &nbsp;
                            </Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              <Input
                                id="alternate-phone"
                                type="tel"
                                value={editFormData.alternate_phone}
                                onChange={(e) => handleFormFieldChange('alternate_phone', e.target.value)}
                                className="pl-10 bg-input-background"
                                placeholder="Enter alternate phone"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Additional Phone Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="relative">
                              <Input
                                type="tel"
                                className="pl-10 bg-input-background"
                                placeholder="Enter additional phone"
                              />
                              <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="relative">
                              <Input
                                type="tel"
                                className="pl-10 bg-input-background"
                                placeholder="Enter additional phone"
                              />
                              <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>

                        {/* Street Address */}
                        <div className="space-y-2">
                          <Label htmlFor="street-address" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            STREET ADDRESS
                          </Label>
                          <Input
                            id="street-address"
                            type="text"
                            value={editFormData.address}
                            onChange={(e) => handleFormFieldChange('address', e.target.value)}
                            className="bg-input-background"
                            placeholder="251 East 32nd Street"
                          />
                        </div>

                        {/* Address Line 2 */}
                        <div className="space-y-2">
                          <Input
                            type="text"
                            className="bg-input-background"
                            placeholder="Apartment, suite, etc."
                          />
                        </div>

                        {/* City, State, ZIP */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="city" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              CITY
                            </Label>
                            <Input
                              id="city"
                              type="text"
                              value={editFormData.city}
                              onChange={(e) => handleFormFieldChange('city', e.target.value)}
                              className="bg-input-background"
                              placeholder="New York"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="state" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              STATE
                            </Label>
                            <Input
                              id="state"
                              type="text"
                              value={editFormData.state}
                              onChange={(e) => handleFormFieldChange('state', e.target.value)}
                              className="bg-input-background"
                              placeholder="NY"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="zip" className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              ZIP
                            </Label>
                            <Input
                              id="zip"
                              type="text"
                              value={editFormData.zip}
                              onChange={(e) => handleFormFieldChange('zip', e.target.value)}
                              className="bg-input-background"
                              placeholder="10016"
                            />
                          </div>
                        </div>

                        {/* Save/Cancel Buttons */}
                        <div className="flex items-center gap-3 pt-4">
                          <Button 
                            onClick={handleInlineEditSave}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={handleInlineEditCancel}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {/* EMAIL Section */}
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">EMAIL</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm">{ownerData.email}</span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => copyToClipboard(ownerData.email)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm">{ownerData.alternate_email}</span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => copyToClipboard(ownerData.alternate_email)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="mt-3">
                                <Badge 
                                  variant={ownerData.email_opt_in ? "default" : "secondary"} 
                                  className={`text-xs ${ownerData.email_opt_in ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                >
                                  {ownerData.email_opt_in ? "Opted In" : "Opted Out"}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* PHONE Section */}
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">PHONE</h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span>{ownerData.phone}</span>
                              </div>
                              <div className="mt-3">
                                <Badge 
                                  variant={ownerData.text_opt_in ? "default" : "secondary"} 
                                  className={`text-xs ${ownerData.text_opt_in ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                >
                                  {ownerData.text_opt_in ? "Text Messaging Enabled" : "Text Messaging Disabled"}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* ADDRESS Section */}
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">ADDRESS</h4>
                            <div>
                              <div>{ownerData.address}</div>
                              <div>{ownerData.city}, {ownerData.state} {ownerData.zip}</div>
                            </div>
                          </div>
                        </div>

                        {/* Additional Fields */}
                        <div className="grid grid-cols-1 gap-8 mt-8">
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">DATE OF BIRTH</h4>
                            <div className="text-sm">6/14/1993</div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">COMMENTS</h4>
                            <div className="text-sm">Referred by Kirk.</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Management Agreement Section */}
                  <div className="pt-6 border-t">
                    <h3 className="font-medium mb-4">Management Agreement</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Start Date</div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{formatDate(mockOwnerData.date_added)}</span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">End Date</div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Not set</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-6">Recent Activity</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Edit className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Owner information updated</div>
                        <div className="text-xs text-muted-foreground">August 22, 2025</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Property added</div>
                        <div className="text-xs text-muted-foreground">2 days ago</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Monthly statement generated</div>
                        <div className="text-xs text-muted-foreground">1 week ago</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Banking Information */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  {/* Banking Information Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">Banking Information</h3>
                      <Badge variant={mockOwnerData.etf_enabled ? "default" : "secondary"} className="text-xs bg-green-100 text-green-700 border-green-200">
                        EFT Enabled
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Account Type</div>
                        <div className="text-sm">{mockOwnerData.account_type || "Not set"}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Account Number</div>
                        <div className="text-sm">{mockOwnerData.account_number || "Not set"}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Routing Number</div>
                        <div className="text-sm">{mockOwnerData.routing_number || "Not set"}</div>
                      </div>
                    </div>
                    
                    {/* ETF Requirements Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <h3 className="font-medium mb-4">Tax Profile</h3>
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <div className="text-sm">
                              <span className="text-red-600">Required - </span>
                              <button 
                                className="text-sm text-blue-600 hover:text-blue-700 underline"
                                onClick={() => setTaxDialogOpen(true)}
                              >
                                Complete Now
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {!mockOwnerData.etf_enabled && (
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-red-700">Required for EFT</div>
                            <button className="text-sm text-red-600 hover:text-red-700">Complete Now</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="properties" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Properties</h2>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Property
                  </Button>
                </div>
                
                <div className="border rounded-md">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="h-12">
                        <TableHead className="font-medium w-[20%]">Address</TableHead>
                        <TableHead className="font-medium w-[15%]">Units</TableHead>
                        <TableHead className="font-medium w-[15%]">Status</TableHead>
                        <TableHead className="font-medium w-[15%]">Type</TableHead>
                        <TableHead className="font-medium w-[20%]">Other Owners</TableHead>
                        <TableHead className="font-medium w-[15%]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockOwnerData.properties.map((property) => (
                        <TableRow key={property.id} className="h-16">
                          <TableCell className="font-medium truncate">
                            {property.address}
                          </TableCell>
                          <TableCell>{property.units}</TableCell>
                          <TableCell>
                            <Badge className={getPropertyStatusColor(property.status)}>
                              {property.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{property.property_type}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate">{property.other_owners}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => console.log('View property:', property.id)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => console.log('Edit property:', property.id)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => console.log('Delete property:', property.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-600">
                      Owner draw by check
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Owner draw by EFT
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Request owner contribution
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Record owner contribution
                    </Button>
                  </div>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Statement
                  </Button>
                </div>
                
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-12 bg-gray-50">
                        <TableHead className="font-medium w-[15%]">DATE</TableHead>
                        <TableHead className="font-medium w-[30%]">PROPERTY</TableHead>
                        <TableHead className="font-medium w-[15%]">UNIT</TableHead>
                        <TableHead className="font-medium w-[10%]">NO.</TableHead>
                        <TableHead className="font-medium w-[15%]">MEMO</TableHead>
                        <TableHead className="font-medium w-[15%] text-right">AMOUNT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-b-0">
                        <TableCell colSpan={6} className="text-blue-600 font-medium py-3">
                          Owner Draw
                        </TableCell>
                      </TableRow>
                      <TableRow className="h-14">
                        <TableCell className="text-muted-foreground">5/5/2025</TableCell>
                        <TableCell>208 Cherry Grove Drive</TableCell>
                        <TableCell></TableCell>
                        <TableCell>EFT</TableCell>
                        <TableCell className="text-muted-foreground">Owner Draw</TableCell>
                        <TableCell className="text-right text-red-600 font-medium">($2,720.98)</TableCell>
                      </TableRow>
                      <TableRow className="h-14">
                        <TableCell className="text-muted-foreground">5/24/2025</TableCell>
                        <TableCell>208 Cherry Grove Drive</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-muted-foreground">Owner Draw</TableCell>
                        <TableCell className="text-right text-red-600 font-medium">($2,595.00)</TableCell>
                      </TableRow>
                      <TableRow className="border-t bg-gray-50">
                        <TableCell colSpan={5} className="font-medium">
                          Owner Draw Total
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          ($5,315.98)
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Communication Preferences */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-medium mb-4">Communication Preferences</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Preferred Method</div>
                      <p className="font-medium">{mockOwnerData.preferred_contact}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Email Notifications</span>
                        <Badge variant={mockOwnerData.email_opt_in ? "default" : "secondary"}>
                          {mockOwnerData.email_opt_in ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Text Messages</span>
                        <Badge variant={mockOwnerData.text_opt_in ? "default" : "secondary"}>
                          {mockOwnerData.text_opt_in ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-2" />
                      Update Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Communication */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-medium mb-4">Quick Actions</h3>
                  
                  <div className="space-y-3">
                    <Button className="w-full justify-start" variant="outline">
                      <Mail className="w-4 h-4 mr-2" />
                      Send Monthly Statement
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send Property Update
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Phone className="w-4 h-4 mr-2" />
                      Schedule Call
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <FileText className="w-4 h-4 mr-2" />
                      Request Documents
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Communication History */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Communication History</h3>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Log Communication
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {mockOwnerData.communications.map((comm) => (
                    <div key={comm.id} className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        {comm.type === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{comm.subject}</h4>
                          <span className="text-sm text-muted-foreground">{formatDate(comm.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{comm.type}</Badge>
                          <Badge variant="outline">{comm.status}</Badge>
                          {comm.duration && <span className="text-sm text-muted-foreground">({comm.duration})</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-medium">Documents & Attachments</h3>
                  <div className="flex items-center gap-3">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Upload file
                    </Button>
                    <Button variant="outline" size="sm">
                      Manage categories
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  <select className="border rounded-md px-3 py-2 text-sm bg-white min-w-[150px]">
                    <option>All categories</option>
                    <option>Bill Files</option>
                    <option>Tax Documents</option>
                    <option>Agreements</option>
                    <option>Banking</option>
                  </select>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    Add filter option
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground mb-4">
                  {mockOwnerData.documents.length} match{mockOwnerData.documents.length !== 1 ? 'es' : ''}
                </div>
                
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-12 bg-gray-50">
                        <TableHead className="w-12">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                        </TableHead>
                        <TableHead className="font-medium">TITLE</TableHead>
                        <TableHead className="font-medium">SHARING</TableHead>
                        <TableHead className="font-medium">CATEGORY</TableHead>
                        <TableHead className="font-medium">UPLOADED</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockOwnerData.documents.map((doc) => (
                        <TableRow key={doc.id} className="h-16">
                          <TableCell>
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{doc.name}</div>
                                <div className="text-xs text-muted-foreground">{doc.type}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {doc.type === 'Agreement' ? 'Bill Files' : 
                               doc.type === 'Tax Document' ? 'Tax Documents' : 
                               doc.type === 'Banking' ? 'Banking' : doc.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{formatDate(doc.date)} {new Date(doc.date).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })}</div>
                            <div className="text-xs text-muted-foreground">by {mockOwnerData.first_name} {mockOwnerData.last_name}</div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => console.log('Download file:', doc.id)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => console.log('Share file:', doc.id)}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => console.log('Edit file:', doc.id)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => console.log('Delete file:', doc.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-medium">Notes</h3>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">Initial contact notes</div>
                      <div className="text-xs text-muted-foreground">Jan 15, 2023</div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Owner was referred by Kirk. Very interested in professional property management. 
                      Currently self-managing but wants to focus on other investments.
                    </p>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">Banking setup completed</div>
                      <div className="text-xs text-muted-foreground">Jan 20, 2023</div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      EFT setup completed successfully. Owner prefers monthly statements via email.
                    </p>
                  </div>
                  
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No additional notes yet</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Tax Profile Dialog */}
        <TaxProfileDialog 
          open={taxDialogOpen} 
          onOpenChange={setTaxDialogOpen}
          ownerId={mockOwnerData.id}
          ownerName={`${mockOwnerData.first_name} ${mockOwnerData.last_name}`}
        />

        {/* Edit Owner Dialog */}
        <EditOwnerDialog 
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          ownerData={ownerData}
          onSave={handleSaveOwnerData}
        />
      </div>
    </div>
  );
}
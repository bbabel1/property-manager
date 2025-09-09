import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ArrowLeft, Building2, DollarSign, Home, FileText, Users, Activity, Receipt, AlertTriangle, CheckCircle, Calendar, TrendingUp } from "lucide-react";
import { PropertySummary } from "./PropertySummary";
import { PropertyFinancials } from "./PropertyFinancials";
import { PropertyUnits } from "./PropertyUnits";
import { PropertyFiles } from "./PropertyFiles";
import { PropertyVendors } from "./PropertyVendors";
import { getPropertyById, type Property } from "../utils/mockData";

interface PropertyDetailsProps {
  propertyId: string;
  onBack: () => void;
  onUnitSelect?: (unitId: string, propertyId: string) => void;
}

export function PropertyDetails({ propertyId, onBack, onUnitSelect }: PropertyDetailsProps) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // KPI data for different tabs
  const getKPIsForTab = (tabName: string) => {
    if (!property) return [];

    switch (tabName) {
      case "summary":
        return [
          {
            icon: Home,
            iconColor: "text-blue-600",
            title: "Total Units",
            value: property.totalUnits.toString(),
            subtitle: `${property.occupiedUnits} occupied • ${property.availableUnits} available`
          },
          {
            icon: Users,
            iconColor: "text-green-600",
            title: "Owners",
            value: property.totalOwners.toString(),
            subtitle: property.primaryOwner || "No primary owner"
          },
          {
            icon: Building2,
            iconColor: "text-purple-600",
            title: "Property Type",
            value: property.type,
            subtitle: "Property classification"
          },
          {
            icon: TrendingUp,
            iconColor: "text-orange-600",
            title: "Occupancy Rate",
            value: `${property.totalUnits > 0 ? Math.round((property.occupiedUnits / property.totalUnits) * 100) : 0}%`,
            subtitle: "Current occupancy"
          }
        ];
      case "financials":
        return [
          {
            icon: DollarSign,
            iconColor: "text-green-600",
            title: "Monthly Income",
            value: formatCurrency(15420),
            subtitle: "Total rental income"
          },
          {
            icon: Receipt,
            iconColor: "text-red-600",
            title: "Monthly Expenses",
            value: formatCurrency(4680),
            subtitle: "Operating expenses"
          },
          {
            icon: Activity,
            iconColor: "text-blue-600",
            title: "Net Income",
            value: formatCurrency(10740),
            subtitle: "After all expenses"
          },
          {
            icon: AlertTriangle,
            iconColor: "text-orange-600",
            title: "Outstanding",
            value: formatCurrency(850),
            subtitle: "Past due amounts"
          }
        ];
      case "units":
        return [
          {
            icon: Home,
            iconColor: "text-blue-600",
            title: "Total Units",
            value: property.totalUnits.toString(),
            subtitle: "Property units"
          },
          {
            icon: CheckCircle,
            iconColor: "text-green-600",
            title: "Occupied",
            value: property.occupiedUnits.toString(),
            subtitle: "Active leases"
          },
          {
            icon: DollarSign,
            iconColor: "text-purple-600",
            title: "Available",
            value: property.availableUnits.toString(),
            subtitle: "Ready for rent"
          },
          {
            icon: AlertTriangle,
            iconColor: "text-red-600",
            title: "Maintenance",
            value: "2",
            subtitle: "Units under repair"
          }
        ];
      case "files":
        return [
          {
            icon: FileText,
            iconColor: "text-blue-600",
            title: "Total Documents",
            value: "24",
            subtitle: "All property files"
          },
          {
            icon: CheckCircle,
            iconColor: "text-green-600",
            title: "Leases",
            value: "8",
            subtitle: "Signed agreements"
          },
          {
            icon: Receipt,
            iconColor: "text-purple-600",
            title: "Financial Reports",
            value: "12",
            subtitle: "Monthly statements"
          },
          {
            icon: AlertTriangle,
            iconColor: "text-orange-600",
            title: "Pending Review",
            value: "4",
            subtitle: "Need attention"
          }
        ];
      case "vendors":
        return [
          {
            icon: Users,
            iconColor: "text-blue-600",
            title: "Active Vendors",
            value: "12",
            subtitle: "Service providers"
          },
          {
            icon: CheckCircle,
            iconColor: "text-green-600",
            title: "Preferred",
            value: "5",
            subtitle: "Top rated vendors"
          },
          {
            icon: Activity,
            iconColor: "text-purple-600",
            title: "Active Jobs",
            value: "3",
            subtitle: "In progress"
          },
          {
            icon: Calendar,
            iconColor: "text-orange-600",
            title: "Scheduled",
            value: "7",
            subtitle: "Upcoming work"
          }
        ];
      default:
        return [];
    }
  };

  const currentKPIs = getKPIsForTab(activeTab);

  useEffect(() => {
    if (propertyId) {
      fetchPropertyDetails();
    }
  }, [propertyId]);

  const fetchPropertyDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulate loading delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const propertyData = getPropertyById(propertyId);
      
      if (propertyData) {
        setProperty(propertyData);
      } else {
        setError('Property not found');
      }
    } catch (err: any) {
      console.error('Error fetching property details:', err);
      setError(err.message || 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    console.log('🔄 Retrying property fetch...');
    fetchPropertyDetails();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading property details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Button>
        </div>
        <div className="text-center py-12">
          <h2 className="mb-4">Failed to Load Property</h2>
          <p className="text-destructive mb-4">{error || 'Property not found'}</p>
          <div className="space-y-2">
            <Button onClick={handleRetry} variant="outline">
              Try Again
            </Button>
            <div className="text-sm text-muted-foreground">
              <p>Property ID: {propertyId}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Properties
        </Button>
        <div className="flex-1">
          <h1 className="flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Property Details
          </h1>
          <p className="text-muted-foreground">{property.name} • {property.address}, {property.city}, {property.state} {property.zip}</p>
        </div>
      </div>

      {/* Dynamic KPI Cards Based on Active Tab */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {currentKPIs.map((kpi, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
              <span>{kpi.title}</span>
            </div>
            <p className="text-2xl font-semibold">{kpi.value}</p>
            <p className="text-sm text-muted-foreground">{kpi.subtitle}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="financials" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Units
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Vendors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <PropertySummary property={property} />
        </TabsContent>

        <TabsContent value="financials">
          <PropertyFinancials propertyId={propertyId} />
        </TabsContent>

        <TabsContent value="units">
          <PropertyUnits propertyId={propertyId} onUnitSelect={onUnitSelect} />
        </TabsContent>

        <TabsContent value="files">
          <PropertyFiles propertyId={propertyId} />
        </TabsContent>

        <TabsContent value="vendors">
          <PropertyVendors propertyId={propertyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
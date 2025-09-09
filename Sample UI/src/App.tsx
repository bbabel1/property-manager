import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { Properties } from "./components/Properties";
import { PropertyDetails } from "./components/PropertyDetails";
import { UnitDetails } from "./components/UnitDetails";
import { MonthlyLogDetails } from "./components/MonthlyLogDetails";
import { Units } from "./components/Units";
import { Owners } from "./components/Owners";
import { OwnerDetails } from "./components/OwnerDetails";
import { Settings } from "./components/Settings";
import { Tenants } from "./components/Tenants";
import { LeaseRenewals } from "./components/LeaseRenewals";
import { Leases } from "./components/Leases";

export default function App() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedMonthlyLogId, setSelectedMonthlyLogId] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

  const handleNavigate = (section: string, propertyId?: string) => {
    setActiveSection(section);
    if (propertyId) {
      setSelectedPropertyId(propertyId);
    } else {
      setSelectedPropertyId(null);
    }
    setSelectedUnitId(null);
    setSelectedOwnerId(null);
  };

  const handlePropertySelect = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setActiveSection("property-details");
    setSelectedUnitId(null);
    setSelectedOwnerId(null);
  };

  const handleUnitSelect = (unitId: string, propertyId: string) => {
    setSelectedUnitId(unitId);
    setSelectedPropertyId(propertyId);
    setSelectedMonthlyLogId(null);
    setSelectedOwnerId(null);
    setActiveSection("unit-details");
  };

  const handleOwnerSelect = (ownerId: string) => {
    setSelectedOwnerId(ownerId);
    setActiveSection("owner-details");
    setSelectedPropertyId(null);
    setSelectedUnitId(null);
  };

  const handleMonthlyLogSelect = (monthlyLogId: string) => {
    setSelectedMonthlyLogId(monthlyLogId);
    setActiveSection("monthly-log-details");
  };

  const handleBackToProperties = () => {
    setSelectedPropertyId(null);
    setSelectedUnitId(null);
    setActiveSection("properties");
  };

  const handleBackToProperty = () => {
    setSelectedUnitId(null);
    setSelectedMonthlyLogId(null);
    setActiveSection("property-details");
  };

  const handleBackToUnit = () => {
    setSelectedMonthlyLogId(null);
    setActiveSection("unit-details");
  };

  const handleBackToOwners = () => {
    setSelectedOwnerId(null);
    setActiveSection("owners");
  };

  const renderContent = () => {
    try {
      switch (activeSection) {
        case "properties":
          return (
            <Properties
              onPropertySelect={handlePropertySelect}
              onNavigate={handleNavigate}
            />
          );
        case "units":
          return <Units onUnitSelect={handleUnitSelect} />;
        case "leases":
          return <Leases />;
        case "property-details":
          return selectedPropertyId ? (
            <PropertyDetails
              propertyId={selectedPropertyId}
              onBack={handleBackToProperties}
              onUnitSelect={handleUnitSelect}
            />
          ) : (
            <Properties
              onPropertySelect={handlePropertySelect}
              onNavigate={handleNavigate}
            />
          );
        case "unit-details":
          return selectedUnitId && selectedPropertyId ? (
            <UnitDetails
              unitId={selectedUnitId}
              propertyId={selectedPropertyId}
              onBack={handleBackToProperty}
              onMonthlyLogSelect={handleMonthlyLogSelect}
            />
          ) : (
            <Properties
              onPropertySelect={handlePropertySelect}
              onNavigate={handleNavigate}
            />
          );
        case "monthly-log-details":
          return selectedMonthlyLogId && selectedUnitId && selectedPropertyId ? (
            <MonthlyLogDetails
              monthlyLogId={selectedMonthlyLogId}
              unitId={selectedUnitId}
              propertyId={selectedPropertyId}
              onBack={handleBackToUnit}
            />
          ) : (
            <Properties
              onPropertySelect={handlePropertySelect}
              onNavigate={handleNavigate}
            />
          );
        case "owners":
          return <Owners onOwnerSelect={handleOwnerSelect} />;
        case "owner-details":
          return selectedOwnerId ? (
            <OwnerDetails
              ownerId={selectedOwnerId}
              onBack={handleBackToOwners}
            />
          ) : (
            <Owners onOwnerSelect={handleOwnerSelect} />
          );
        case "tenants":
          return <Tenants />;
        case "lease-renewals":
          return <LeaseRenewals />;
        case "settings":
          return (
            <Settings
              onNavigate={handleNavigate}
            />
          );
        default:
          return (
            <Dashboard
              onNavigate={handleNavigate}
            />
          );
      }
    } catch (error) {
      console.error("Error rendering component:", error);
      return (
        <Dashboard
          onNavigate={handleNavigate}
        />
      );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />
      <main className="flex-1 overflow-auto">
        <div className="w-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
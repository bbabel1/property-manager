import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import { 
  Home, 
  Building, 
  Building2,
  Users, 
  Settings,
  Menu,
  X,
  UserCheck,
  FileText,
  ClipboardList
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "properties", label: "Properties", icon: Building },
  { id: "units", label: "Units", icon: Building2 },
  { id: "leases", label: "Leases", icon: ClipboardList },
  { id: "owners", label: "Owners", icon: UserCheck },
  { id: "tenants", label: "Tenants", icon: Users },
  { id: "lease-renewals", label: "Lease Renewals", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings }
];

export function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </Button>

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-40 h-full w-64 transform bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        isCollapsed ? "-translate-x-full" : "translate-x-0"
      )}>
        <div className="p-6">
          <div className="flex items-center space-x-2 mb-8">
            <Building className="h-8 w-8 text-sidebar-primary" />
            <div>
              <h2 className="text-lg font-semibold text-sidebar-foreground">Ora Property Management</h2>
            </div>
          </div>
          
          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                  )}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsCollapsed(true); // Close mobile menu after navigation
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  );
}
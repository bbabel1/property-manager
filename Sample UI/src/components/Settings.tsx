import { Button } from "./ui/button";
import { Database, Settings as SettingsIcon } from "lucide-react";
import { SETTINGS_SECTIONS, SYSTEM_INFO, DATA_SOURCE_CONFIG, TROUBLESHOOTING_STEPS } from "./SettingsConstants";
import { StaffManagerDebug } from "./StaffManagerDebug";

interface SettingsProps {
  onNavigate: (section: string) => void;
}

export function Settings({ onNavigate }: SettingsProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1>Settings</h1>
        <p className="text-muted-foreground">Application settings and debugging tools</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {SETTINGS_SECTIONS.map((section, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <section.icon className="w-4 h-4" />
                {section.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {section.description}
              </p>
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <Button 
                    key={itemIndex}
                    onClick={() => onNavigate(item.action)}
                    variant={item.variant as "default" | "outline"}
                    className="w-full"
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.title}
                  </Button>
                ))}
              </div>
            </div>
          ))}

          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Data Source
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              This application uses mock data for demonstration
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Mock Data:</span>
                <span className={`${DATA_SOURCE_CONFIG.mockData.color} font-medium`}>
                  {DATA_SOURCE_CONFIG.mockData.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Fallback Data:</span>
                <span className={`${DATA_SOURCE_CONFIG.fallbackData.color} font-medium`}>
                  {DATA_SOURCE_CONFIG.fallbackData.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Data Source:</span>
                <span className={`${DATA_SOURCE_CONFIG.dataSource.color} font-medium`}>
                  {DATA_SOURCE_CONFIG.dataSource.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">System Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Version:</span>
                <span>{SYSTEM_INFO.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Environment:</span>
                <span>{SYSTEM_INFO.environment}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Real Data Mode:</span>
                <span className="text-green-600 font-medium">{SYSTEM_INFO.realDataMode}</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">User Account</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span className="text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Data Source:</span>
                <span className="text-xs font-mono">
                  Mock Data
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
            <h3 className="font-medium mb-2 text-blue-800">Application Issues?</h3>
            <p className="text-sm text-blue-700 mb-3">
              If you're experiencing issues with the application, try these tools:
            </p>
            <div className="space-y-2">
              {TROUBLESHOOTING_STEPS.map((step, index) => (
                <div key={index} className="text-xs text-blue-600">
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Staff Manager Debug Section */}
      <div className="mt-8">
        <StaffManagerDebug accessToken={null} />
      </div>
    </div>
  );
}
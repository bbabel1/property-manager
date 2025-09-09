import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  ChevronDown,
  User,
  Mail,
  Phone,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  Database,
} from "lucide-react";
import { projectId } from "../utils/supabase/info";

interface PropertyManager {
  id: string;
  staffId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title: string;
  status: string;
  fullName: string;
}

interface PropertyManagerSearchProps {
  accessToken?: string;
  selectedManager?: PropertyManager | null;
  onSelectManager: (manager: PropertyManager | null) => void;
  placeholder?: string;
}

export function PropertyManagerSearch({ 
  accessToken, 
  selectedManager, 
  onSelectManager, 
  placeholder = "Select a manager..." 
}: PropertyManagerSearchProps) {
  const [managers, setManagers] = useState<PropertyManager[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [dataSource, setDataSource] = useState<string>('unknown');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  


  useEffect(() => {
    if (accessToken) {
      fetchManagers();
    } else {
      // Show mock state when no authentication
      setManagers([]);
      setDataSource('mock');
      setLoading(false);
    }
  }, [accessToken]);
  
  // Debug the selectedManager prop changes
  useEffect(() => {
    console.log('🔍 PropertyManagerSearch - selectedManager prop changed:', selectedManager);
  }, [selectedManager]);

  const fetchManagers = async () => {
    if (!accessToken) {
      console.log("⚠️ No access token available for fetching managers");
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    try {
      console.log("🔍 Fetching property managers from database...");
      console.log("📡 Endpoint:", `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/staff/managers`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/staff/managers`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("📡 Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Property managers response received:", data);
        
        const managersArray = data.managers || [];
        setManagers(managersArray);
        setDataSource(data.source || 'unknown');
        setDebugInfo(data.debugInfo || null);
        setErrorMessage(data.message || '');
        setSuggestions(data.suggestions || []);
        
        console.log("✅ Set", managersArray.length, "managers in state");
        console.log("📊 Data source:", data.source);
        console.log("💡 Available tables:", data.availableTables);
        
        if (managersArray.length === 0 && data.source === 'no_data') {
          setErrorMessage(data.message || 'No property managers found in database');
        }
      } else {
        console.log("❌ Property managers fetch failed with status:", response.status);
        const errorText = await response.text();
        console.log("❌ Error response body:", errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          setErrorMessage(errorJson.message || errorJson.error || 'Failed to fetch managers');
          console.log("❌ Parsed error:", errorJson);
        } catch (parseError) {
          setErrorMessage('Failed to fetch property managers');
          console.log("❌ Could not parse error as JSON:", parseError);
        }
        
        setManagers([]);
        setDataSource('error');
      }
    } catch (error) {
      console.log("❌ Network/fetch error:", error);
      setErrorMessage('Network error while fetching managers');
      setManagers([]);
      setDataSource('error');
    } finally {
      setLoading(false);
    }
  };



  const handleSelectManager = (manager: PropertyManager) => {
    onSelectManager(manager);
    setSearchOpen(false);
  };

  const clearSelection = () => {
    onSelectManager(null);
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Loading managers from database...
        </div>
      );
    }

    if (dataSource === 'mock') {
      return (
        <div className="py-4 px-4 text-center">
          <div className="flex flex-col items-center space-y-3">
            <Database className="w-8 h-8 text-muted-foreground" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Property Manager Search</p>
              <p className="text-muted-foreground text-xs">
                Property manager selection is available in the full version.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (dataSource === 'no_data') {
      return (
        <div className="py-4 px-4 text-center">
          <div className="flex flex-col items-center space-y-3">
            <Database className="w-8 h-8 text-muted-foreground" />
            <div className="text-sm space-y-1">
              <p className="font-medium">No Property Managers Found</p>
              <p className="text-muted-foreground text-xs">
                No property managers exist in your database yet.
              </p>
            </div>
            {suggestions.length > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                <p className="font-medium mb-1">To add property managers:</p>
                <ul className="text-left space-y-1">
                  {suggestions.slice(0, 2).map((suggestion, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Contact your administrator to add property managers.
            </p>
          </div>
        </div>
      );
    }

    if (dataSource === 'error') {
      return (
        <div className="py-4 px-4 text-center">
          <div className="flex flex-col items-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Database Error</p>
              <p className="text-muted-foreground text-xs mt-1">
                {errorMessage || 'Failed to fetch property managers'}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchManagers}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="py-4 text-center">
        <div className="text-sm text-muted-foreground">
          No managers match your search.
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={searchOpen}
                className="w-full justify-between"
              >
                <span className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  {selectedManager 
                    ? selectedManager.fullName 
                    : placeholder
                  }
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search managers..." 
                  className="border-none outline-none focus:ring-0" 
                />
                <CommandList>
                  <CommandEmpty>
                    {renderEmptyState()}
                  </CommandEmpty>
                  {managers.length > 0 && (
                    <CommandGroup>
                      {managers.map((manager) => (
                        <CommandItem
                          key={manager.staffId}
                          onSelect={() => handleSelectManager(manager)}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{manager.fullName}</div>
                            <div className="text-xs text-muted-foreground">{manager.title}</div>
                            {manager.email && (
                              <div className="text-xs text-muted-foreground">{manager.email}</div>
                            )}
                          </div>
                          {selectedManager?.staffId === manager.staffId && (
                            <Check className="h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        
        {selectedManager && (
          <Button
            variant="outline"
            size="icon"
            onClick={clearSelection}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Data Source Indicator */}
      {dataSource && dataSource !== 'unknown' && dataSource !== 'error' && (
        <div className="text-xs text-muted-foreground">
          <span className="flex items-center">
            <Database className="w-3 h-3 mr-1" />
            Source: {dataSource.replace('_', ' ')} 
            {managers.length > 0 && `(${managers.length} found)`}
          </span>
        </div>
      )}

      {/* Selected Manager Display */}
      {selectedManager && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">{selectedManager.fullName}</div>
                <div className="text-sm text-muted-foreground">{selectedManager.title}</div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {selectedManager.status}
            </Badge>
          </div>
          
          {(selectedManager.email || selectedManager.phone) && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              {selectedManager.email && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="w-3 h-3 mr-1" />
                  {selectedManager.email}
                </div>
              )}
              {selectedManager.phone && (
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <Phone className="w-3 h-3 mr-1" />
                  {selectedManager.phone}
                </div>
              )}
            </div>
          )}
        </div>
      )}


    </div>
  );
}
import { Database, Bug, TestTube, Settings as SettingsIcon } from "lucide-react";

export interface SettingsSection {
  title: string;
  icon: any;
  description: string;
  items: SettingsItem[];
}

export interface SettingsItem {
  title: string;
  icon: any;
  action: string;
  variant?: "default" | "outline";
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: "Data Management",
    icon: Database,
    description: "Mock data configuration and utilities",
    items: [
      {
        title: "Data Overview",
        icon: Database,
        action: "data-overview",
        variant: "default"
      },
      {
        title: "Reset Mock Data", 
        icon: Database,
        action: "reset-data",
        variant: "outline"
      }
    ]
  },
  {
    title: "Debug Tools",
    icon: Bug,
    description: "Tools to debug application issues",
    items: [
      {
        title: "Component Test",
        icon: TestTube,
        action: "component-test",
        variant: "outline"
      },
      {
        title: "Application Debug",
        icon: Bug,
        action: "app-debug",
        variant: "outline"
      }
    ]
  }
];

export const SYSTEM_INFO = {
  version: "1.0.0",
  environment: "Development",
  dataMode: "Mock Data"
};

export const DATA_SOURCE_CONFIG = {
  mockData: { status: "Active", color: "text-green-600" },
  fallbackData: { status: "N/A", color: "text-gray-600" },
  dataSource: { status: "Mock Data Only", color: "text-blue-600" }
};

export const TROUBLESHOOTING_STEPS = [
  "1. Run Component Test to check data flow",
  "2. Use Application Debug for detailed analysis", 
  "3. Check Data Overview for mock data structure"
];
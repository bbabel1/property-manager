'use client'

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building,
  Home,
  Users,
  User,
  Settings,
  Menu,
  X,
  FileText,
  LogOut,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers";
import { RoleRank, type AppRole } from "@/lib/auth/roles";

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "properties", label: "Properties", icon: Building },
  { id: "units", label: "Units", icon: Home },
  { id: "leases", label: "Leases", icon: FileText },
  { id: "owners", label: "Owners", icon: Users },
  { id: "tenants", label: "Tenants", icon: User },
  { id: "settings", label: "Settings", icon: Settings }
];

export function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, signOut } = useAuth();

  const displayName = useMemo(() => {
    const meta: any = user?.user_metadata || {};
    const full = meta.full_name || meta.name || `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim();
    return (full && full.length > 1 ? full : user?.email) || 'Signed in';
  }, [user]);

  const initials = useMemo(() => {
    const src = (displayName || '').trim();
    const parts = src.includes('@') ? [src[0], src.split('@')[0].slice(-1)] : src.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = (parts[1]?.[0]) || (parts[0]?.[1]) || '';
    return (first + (second || '')).toUpperCase();
  }, [displayName]);

  const roleLabel = useMemo(() => {
    const roles = ((user?.app_metadata as any)?.claims?.roles ?? []) as AppRole[];
    if (!roles?.length) return '';
    const highest = roles.sort((a, b) => (RoleRank[b] ?? 0) - (RoleRank[a] ?? 0))[0];
    switch (highest) {
      case 'platform_admin': return 'Platform Admin';
      case 'org_admin': return 'Administrator';
      case 'org_manager': return 'Manager';
      case 'org_staff': return 'Staff';
      case 'owner_portal': return 'Owner';
      case 'tenant_portal': return 'Tenant';
      default: return '';
    }
  }, [user]);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? "Open menu" : "Close menu"}
      >
        {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 transform bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          isCollapsed ? "-translate-x-full" : "translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="p-6">
            <div className="mb-6 flex justify-center">
              <Image
                src="/ora-logo.png"
                alt="Ora Property Management"
                width={320}
                height={320}
                className="w-full max-w-[232px]"
                priority
              />
            </div>

            <div className="text-sm text-muted-foreground mb-3">Navigation</div>
            <nav className="space-y-2.5">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-11 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-[15px]",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                    onClick={() => {
                      onNavigate(item.id);
                      setIsCollapsed(true); // Close mobile menu after navigation
                    }}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-sidebar-border p-6">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-blue-600 text-white text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{displayName}</div>
                {roleLabel ? (
                  <div className="text-xs text-muted-foreground truncate">{roleLabel}</div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
              onClick={async () => {
                await signOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>
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

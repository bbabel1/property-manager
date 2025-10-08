"use client";

import {
  Sidebar as UISidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building,
  Home,
  FileText,
  Users,
  User,
  Handshake,
  Settings,
  LogOut,
} from "lucide-react";
import { ReactNode, useMemo } from "react";
import { Guard } from '@/components/Guard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/components/providers'
import { RoleRank, type AppRole } from '@/lib/auth/roles'

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "properties", label: "Properties", href: "/properties", icon: Building },
  { id: "units", label: "Units", href: "/units", icon: Home },
  { id: "leases", label: "Leases", href: "/leases", icon: FileText },
  { id: "owners", label: "Owners", href: "/owners", icon: Users },
  { id: "vendors", label: "Vendors", href: "/vendors", icon: Handshake },
  { id: "tenants", label: "Tenants", href: "/tenants", icon: User },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebarLayout({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const activeId = useMemo(() => {
    const match = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    return match?.id ?? "dashboard";
  }, [pathname]);

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
    // Pick highest ranked role
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
    <SidebarProvider>
      <div className="min-h-svh w-full">
        <div className="flex w-full">
          <UISidebar collapsible="offcanvas" className="border-sidebar-border">
            <SidebarHeader>
              <div className="px-2 py-2">
                <div className="text-xl font-semibold leading-6">
                  Ora Property
                  <br />
                  Management
                </div>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => {
                    // Restrict Settings to org_admin+ via Guard
                    const btn = (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={item.id === activeId}
                          size="lg"
                          className="rounded-xl text-[15px]"
                          onClick={() => router.push(item.href)}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                    if (item.id === 'settings') {
                      const isProd = process.env.NODE_ENV === 'production'
                      // In production, enforce role; in dev, always show to aid bootstrap
                      return isProd ? (
                        <Guard key={item.id} require={'org_admin'}>
                          {btn}
                        </Guard>
                      ) : (
                        btn
                      )
                    }
                    return btn
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter>
              <div className="px-2 py-2">
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
                    router.push('/auth/signin');
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </button>
              </div>
            </SidebarFooter>
          </UISidebar>
          <SidebarInset>
            <div className="border-b border-border bg-background sticky top-0 z-10">
              <div className="flex items-center gap-2 px-4 py-3">
                <SidebarTrigger />
                <div className="text-sm font-medium text-foreground truncate">
                  {title ?? NAV_ITEMS.find((n) => n.id === activeId)?.label ?? "Dashboard"}
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6">{children}</div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default AppSidebarLayout;

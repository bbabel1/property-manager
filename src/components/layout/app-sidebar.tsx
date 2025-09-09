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
  Home,
  Building,
  Building2,
  ClipboardList,
  Users,
  Settings,
} from "lucide-react";
import { ReactNode, useMemo } from "react";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { id: "properties", label: "Properties", href: "/properties", icon: Building },
  { id: "units", label: "Units", href: "/units", icon: Building2 },
  { id: "leases", label: "Leases", href: "/leases", icon: ClipboardList },
  { id: "owners", label: "Owners", href: "/owners", icon: Users },
  { id: "tenants", label: "Tenants", href: "/tenants", icon: Users },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebarLayout({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const activeId = useMemo(() => {
    const match = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    return match?.id ?? "dashboard";
  }, [pathname]);

  return (
    <SidebarProvider>
      <div className="min-h-svh w-full">
        <div className="flex w-full">
          <UISidebar collapsible="offcanvas" className="border-sidebar-border">
            <SidebarHeader>
              <div className="px-2 py-1">
                <span className="text-sm font-semibold">Ora Property Management</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={item.id === activeId}
                        onClick={() => router.push(item.href)}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter>
              <div className="px-2 text-xs text-muted-foreground">v0.1.0</div>
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


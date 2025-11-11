'use client';

import Image from 'next/image';
import {
  Sidebar as UISidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building,
  Home,
  FileText,
  Files,
  Users,
  User,
  Settings,
  Receipt,
  LogOut,
  Wrench,
  ChevronRight,
} from 'lucide-react';
import { ReactNode, useMemo, useState, useRef, useEffect } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import { Guard } from '@/components/Guard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/components/providers';
import { RoleRank, type AppRole } from '@/lib/auth/roles';
import { cn } from '@/components/ui/utils';

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: { id: string; label: string; href: string }[];
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'properties', label: 'Properties', href: '/properties', icon: Building },
  { id: 'units', label: 'Units', href: '/units', icon: Home },
  { id: 'leases', label: 'Leases', href: '/leases', icon: FileText },
  { id: 'owners', label: 'Owners', href: '/owners', icon: Users },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    children: [
      { id: 'maintenance-tasks', label: 'Tasks', href: '/tasks' },
      { id: 'maintenance-work-orders', label: 'Work orders', href: '/maintenance' },
      { id: 'maintenance-vendors', label: 'Vendors', href: '/vendors' },
    ],
  },
  { id: 'tenants', label: 'Tenants', href: '/tenants', icon: User },
  { id: 'files', label: 'Files', href: '/files', icon: Files },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: Receipt,
    children: [
      {
        id: 'accounting-general-ledger',
        label: 'General ledger',
        href: '/accounting/general-ledger',
      },
      { id: 'accounting-banking', label: 'Banking', href: '/accounting/banking' },
      { id: 'accounting-bills', label: 'Bills', href: '/bills' },
      {
        id: 'accounting-monthly-logs',
        label: 'Monthly logs',
        href: '/monthly-logs',
      },
      {
        id: 'accounting-recurring-transactions',
        label: 'Recurring transactions',
        href: '/accounting/recurring-transactions',
      },
      { id: 'accounting-eft-approvals', label: 'EFT approvals', href: '/accounting/eft-approvals' },
      { id: 'accounting-budgets', label: 'Budgets', href: '/accounting/budgets' },
      {
        id: 'accounting-chart-of-accounts',
        label: 'Chart of accounts',
        href: '/accounting/chart-of-accounts',
      },
      {
        id: 'accounting-company-financials',
        label: 'Company financials',
        href: '/accounting/company-financials',
      },
    ],
  },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebarLayout({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout>();
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOpenItemId(null);
    setSubmenuPosition(null);
  }, [pathname]);

  const matchesPath = (href?: string) =>
    Boolean(href && (pathname === href || pathname.startsWith(`${href}/`)));

  const activeMeta = useMemo(() => {
    for (const item of NAV_ITEMS) {
      if (matchesPath(item.href)) {
        return { item, label: item.label };
      }
      const child = item.children?.find((child) => matchesPath(child.href));
      if (child) {
        return { item, label: child.label };
      }
    }
    const fallback = NAV_ITEMS[0];
    return { item: fallback, label: fallback.label };
  }, [pathname]);

  const activeId = activeMeta.item.id;
  const activeLabel = activeMeta.label;

  const displayName = useMemo(() => {
    const meta: any = user?.user_metadata || {};
    const full =
      meta.full_name || meta.name || `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim();
    return (full && full.length > 1 ? full : user?.email) || 'Signed in';
  }, [user]);

  const initials = useMemo(() => {
    const src = (displayName || '').trim();
    const parts = src.includes('@')
      ? [src[0], src.split('@')[0].slice(-1)]
      : src.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = parts[1]?.[0] || parts[0]?.[1] || '';
    return (first + (second || '')).toUpperCase();
  }, [displayName]);

  const roleLabel = useMemo(() => {
    const roles = ((user?.app_metadata as any)?.claims?.roles ?? []) as AppRole[];
    if (!roles?.length) return '';
    // Pick highest ranked role
    const highest = roles.sort((a, b) => (RoleRank[b] ?? 0) - (RoleRank[a] ?? 0))[0];
    switch (highest) {
      case 'platform_admin':
        return 'Platform Admin';
      case 'org_admin':
        return 'Administrator';
      case 'org_manager':
        return 'Manager';
      case 'org_staff':
        return 'Staff';
      case 'owner_portal':
        return 'Owner';
      case 'tenant_portal':
        return 'Tenant';
      default:
        return '';
    }
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-svh w-full">
        <div className="flex w-full">
          <UISidebar collapsible="offcanvas" className="border-sidebar-border font-sans">
            <SidebarHeader className="border-sidebar-border items-center gap-0 border-b px-4 py-5">
              <Image
                src="/ora-logo-wordmark.svg"
                alt="Ora Property Management"
                width={4000}
                height={630}
                priority
                className="h-10 w-auto object-contain"
              />
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => {
                    const children = item.children ?? [];
                    const hasChildren = children.length > 0;
                    const childMatch = hasChildren
                      ? children.some((child) => matchesPath(child.href))
                      : false;
                    const isActive = item.id === activeId || Boolean(childMatch);
                    const isOpen = openItemId === item.id;

                    const handleButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
                      if (hasChildren) {
                        event.preventDefault();
                        if (closeTimeoutRef.current) {
                          clearTimeout(closeTimeoutRef.current);
                        }

                        if (isOpen) {
                          setOpenItemId(null);
                          setSubmenuPosition(null);
                          return;
                        }

                        const rect = event.currentTarget.getBoundingClientRect();
                        setSubmenuPosition({
                          top: rect.top,
                          left: rect.right + 12,
                        });
                        setOpenItemId(item.id);
                        return;
                      }

                      if (item.href) {
                        router.push(item.href);
                      }
                    };
                    // Restrict Settings to org_admin+ via Guard
                    const btn = (
                      <SidebarMenuItem
                        key={item.id}
                        className="group relative"
                        onMouseEnter={(e) => {
                          if (hasChildren) {
                            // Clear any pending close timeout
                            if (closeTimeoutRef.current) {
                              clearTimeout(closeTimeoutRef.current);
                            }

                            // Calculate position for submenu
                            const rect = e.currentTarget.getBoundingClientRect();
                            setSubmenuPosition({
                              top: rect.top,
                              left: rect.right + 12, // Small gap from sidebar
                            });

                            setOpenItemId(item.id);
                          }
                        }}
                        onMouseLeave={() => {
                          if (!hasChildren) return;
                          // Add a small delay before closing to allow moving to submenu
                          closeTimeoutRef.current = setTimeout(() => {
                            setOpenItemId((prev) => (prev === item.id ? null : prev));
                            setSubmenuPosition(null);
                          }, 150);
                        }}
                        onFocusCapture={() => {
                          if (hasChildren) setOpenItemId(item.id);
                        }}
                        onBlurCapture={(event: FocusEvent<HTMLLIElement>) => {
                          if (!hasChildren) return;
                          const nextTarget = event.relatedTarget as Node | null;
                          if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                            setOpenItemId((prev) => (prev === item.id ? null : prev));
                          }
                        }}
                      >
                        <SidebarMenuButton
                          isActive={isActive}
                          size="default"
                          className="h-9 rounded-none text-base"
                          type="button"
                          onClick={handleButtonClick}
                          aria-haspopup={hasChildren ? 'menu' : undefined}
                          aria-expanded={hasChildren ? isOpen : undefined}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          {hasChildren ? (
                            <ChevronRight
                              aria-hidden="true"
                              className={cn(
                                'ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out',
                                isOpen && 'rotate-90',
                              )}
                            />
                          ) : null}
                        </SidebarMenuButton>
                        {hasChildren ? (
                          <div
                            ref={(el) => {
                              if (el) {
                                el.style.setProperty(
                                  '--submenu-top',
                                  `${submenuPosition?.top || 0}px`,
                                );
                                el.style.setProperty(
                                  '--submenu-left',
                                  `${submenuPosition?.left || 0}px`,
                                );
                              }
                            }}
                            className={cn(
                              'sidebar-submenu border-border bg-popover text-popover-foreground fixed z-[9999] min-w-[15.5rem] rounded-lg border p-3 shadow-md',
                              isOpen
                                ? 'pointer-events-auto visible opacity-100 transition-opacity duration-150'
                                : 'pointer-events-none invisible opacity-0',
                            )}
                            onMouseEnter={() => {
                              if (closeTimeoutRef.current) {
                                clearTimeout(closeTimeoutRef.current);
                              }
                              setOpenItemId(item.id);
                            }}
                            onMouseLeave={() => {
                              closeTimeoutRef.current = setTimeout(() => {
                                setOpenItemId(null);
                                setSubmenuPosition(null);
                              }, 120);
                            }}
                          >
                            <SidebarMenuSub className="mx-0 flex flex-col border-0 p-0">
                              {children.map((child) => {
                                const childActive = matchesPath(child.href);
                                return (
                                  <SidebarMenuSubItem key={child.id}>
                                    <SidebarMenuSubButton
                                      isActive={childActive}
                                      className="flex h-10 w-full items-center gap-2 rounded-none px-4 text-base leading-5 font-normal whitespace-nowrap text-black transition-colors hover:bg-gray-100 hover:text-black data-[active=true]:bg-gray-100 data-[active=true]:text-black"
                                      href={child.href}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        router.push(child.href);
                                        setOpenItemId(null);
                                        setSubmenuPosition(null);
                                      }}
                                    >
                                      {child.label}
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </div>
                        ) : null}
                      </SidebarMenuItem>
                    );
                    if (item.id === 'settings') {
                      const isProd = process.env.NODE_ENV === 'production';
                      // In production, enforce role; in dev, always show to aid bootstrap
                      return isProd ? (
                        <Guard key={item.id} require={'org_admin'}>
                          {btn}
                        </Guard>
                      ) : (
                        btn
                      );
                    }
                    return btn;
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter>
              <div className="px-2 py-2">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-blue-600 text-sm text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{displayName}</div>
                    {roleLabel ? (
                      <div className="text-muted-foreground truncate text-xs">{roleLabel}</div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  className="text-foreground mt-3 inline-flex items-center gap-2 text-sm hover:underline"
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
            <div className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex h-12 items-center gap-2 px-3 sm:px-4 md:px-6">
                <SidebarTrigger />
                <div className="text-foreground truncate text-base font-medium">
                  {title ?? activeLabel}
                </div>
              </div>
            </div>
            <div className="bg-background">{children}</div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default AppSidebarLayout;

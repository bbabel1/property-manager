'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  description?: string
  badge?: string
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Personal',
    items: [
      { label: 'Profile', href: '/settings/profile', description: 'Personal details, role context, and preferences.' },
      { label: 'Notifications', href: '/settings/notifications', description: 'What you get notified about and how.' },
      { label: 'Security', href: '/settings/security', description: 'Password, two-factor, and active devices.' },
      { label: 'Integrations', href: '/settings/integrations/personal', description: 'Gmail and Calendar that follow you.' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Organization', href: '/settings/organization', description: 'Org profile, defaults, and identity.' },
      { label: 'Team & Roles', href: '/settings/users', description: 'Members, roles, invites, and profiles.' },
      { label: 'Integrations (org)', href: '/settings/integrations', description: 'Buildium, Square, and other connections.' },
      { label: 'Billing & Plans', href: '/settings/billing', description: 'Subscription, usage, invoices, and payment method.' },
      { label: 'Templates', href: '/settings/templates', description: 'Email templates for statements and notifications.' },
      { label: 'Services', href: '/settings/services', description: 'Service catalog, pricing, and automation rules.' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Data & Privacy', href: '/settings/privacy', description: 'Exports, audit trail, and data retention.' },
      { label: 'Danger Zone', href: '/settings/danger', description: 'Account deletion and workspace cleanup.' },
      { label: 'Developer Console', href: '/settings/developer-console', description: 'Webhooks, API access, and logs.', badge: 'Tech' },
    ],
  },
]

const pathMatches = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]">
        <aside className="lg:border-r lg:border-border/60">
          <div className="rounded-lg border border-border/60 bg-card shadow-sm lg:sticky lg:top-14 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settings</div>
              <div className="text-sm text-muted-foreground">Personal, workspace, and account controls</div>
            </div>
            <nav className="space-y-6 px-4 py-4">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => {
                      const isActive = pathMatches(pathname, item.href)
                      return (
                        <Link key={item.href} href={item.href} className="block">
                          <div
                            className={cn(
                              'rounded-md border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/60 hover:text-foreground',
                              isActive && 'border-primary/30 bg-primary/10 text-primary shadow-sm',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{item.label}</span>
                              {item.badge ? (
                                <Badge variant={isActive ? 'default' : 'outline'} className="text-[11px]">
                                  {item.badge}
                                </Badge>
                              ) : null}
                            </div>
                            {item.description ? (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            ) : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}

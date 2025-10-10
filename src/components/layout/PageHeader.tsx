"use client"

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
  property: {
    id: string
    name: string
    status?: string | null
    property_type?: string | null
    service_assignment?: string | null
    service_plan?: string | null
    buildium_property_id?: number | null
  }
}

function formatPlan(plan?: string | null) {
  if (!plan) return null
  const p = String(plan)
  if (p.toLowerCase() === 'full') return 'Full Service'
  // Title-case and normalize dashes
  return p
    .replace(/[-_]+/g, ' ')
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function formatAssignment(assign?: string | null) {
  if (!assign) return null
  const a = String(assign)
  return a.charAt(0).toUpperCase() + a.slice(1).toLowerCase()
}

export default function PageHeader({ property }: Props) {
  const seg = useSelectedLayoutSegment() || 'summary'
  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'financials', label: 'Financials' },
    { key: 'units', label: 'Units' },
    { key: 'files', label: 'Files' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'tasks', label: 'Tasks' },
  ]
  const statusActive = String(property.status || '').toLowerCase() === 'active'
  const subtitleParts = [
    property.property_type || undefined,
    formatAssignment(property.service_assignment),
    formatPlan(property.service_plan),
  ].filter(Boolean) as string[]
  return (
    <header className="p-6 pb-2 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded ${statusActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {property.status || '—'}
        </span>
        {property.buildium_property_id ? (
          <Badge variant="secondary" className="text-xs font-medium">
            {property.buildium_property_id}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs font-medium">
            Not in Buildium
          </Badge>
        )}
      </div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        {property.name || 'Property'}
      </h1>
      <p className="text-muted-foreground text-sm">{subtitleParts.length ? subtitleParts.join(' | ') : '—'}</p>

      <div className="border-b border-border mt-2">
        <nav className="flex space-x-8" aria-label="Property sections">
          {tabs.map(t => (
            <Link
              key={t.key}
              href={`/properties/${property.id}/${t.key}`}
              aria-current={seg === t.key ? 'page' : undefined}
              className={`py-4 px-1 border-b-2 text-sm font-medium transition-colors ${seg === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

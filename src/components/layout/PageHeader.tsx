'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { Building2, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Body, Heading, Label } from '@/ui/typography';

type Props = {
  property: {
    id: string;
    publicId?: string | null;
    name: string;
    status?: string | null;
    property_type?: string | null;
    service_assignment?: string | null;
    service_plan?: string | null;
    buildium_property_id?: number | null;
  };
};

function formatPlan(plan?: string | null) {
  if (!plan) return null;
  const p = String(plan);
  if (p.toLowerCase() === 'full') return 'Full Service';
  // Title-case and normalize dashes
  return p
    .replace(/[-_]+/g, ' ')
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatAssignment(assign?: string | null) {
  if (!assign) return null;
  const a = String(assign);
  return a.charAt(0).toUpperCase() + a.slice(1).toLowerCase();
}

export default function PageHeader({ property }: Props) {
  const pathname = usePathname();
  const seg = useSelectedLayoutSegment() || 'summary';
  const [navExpanded, setNavExpanded] = useState(false);
  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'financials', label: 'Financials' },
    { key: 'units', label: 'Units' },
    { key: 'services', label: 'Services' },
    { key: 'files', label: 'Files' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'compliance', label: 'Compliance' },
  ];

  const isUnitDetailsPath =
    typeof pathname === 'string' && /^\/properties\/[^/]+\/units\/[^/]+/i.test(pathname);

  useEffect(() => {
    // Always start collapsed when entering a unit details page
    setNavExpanded(false);
  }, [isUnitDetailsPath, pathname]);

  const shouldCollapseNav = isUnitDetailsPath && !navExpanded;
  const propertyPathId = property.publicId || property.id;

  const handleMouseEnter = () => {
    if (isUnitDetailsPath) setNavExpanded(true);
  };

  const handleMouseLeave = () => {
    if (isUnitDetailsPath) setNavExpanded(false);
  };

  const statusActive = String(property.status || '').toLowerCase() === 'active';
  const subtitleParts = [
    property.property_type || undefined,
    formatAssignment(property.service_assignment),
    formatPlan(property.service_plan),
  ].filter(Boolean) as string[];
  return (
    <header
      className="space-y-3 p-6 pb-2"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center gap-2">
        <span
          className={`status-pill px-2 py-0.5 ${statusActive ? 'status-pill-success' : 'status-pill-danger'}`}
        >
          {property.status || '—'}
        </span>
        {property.buildium_property_id ? (
          <Badge variant="secondary">
            {property.buildium_property_id}
          </Badge>
        ) : (
          <Badge variant="outline">
            Not in Buildium
          </Badge>
        )}
      </div>
      <Heading as="h1" size="h2" className="flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        {property.name || 'Property'}
      </Heading>
      <Body as="p" tone="muted" size="sm" className="flex items-center gap-1">
        {shouldCollapseNav ? (
          <Label as="span" className="inline-flex items-center gap-1">
            Property Details
          <ChevronDown className="h-4 w-4" aria-hidden />
          </Label>
        ) : subtitleParts.length ? (
          subtitleParts.join(' | ')
        ) : (
          '—'
        )}
      </Body>

      <div
        className={`border-border mt-2 border-b transition-[max-height,opacity] duration-200 ease-out ${shouldCollapseNav ? 'invisible max-h-0 overflow-hidden opacity-0 pointer-events-none' : 'visible max-h-16 opacity-100 pointer-events-auto'}`}
        aria-hidden={shouldCollapseNav}
      >
        <nav className="flex space-x-8" aria-label="Property sections" role="navigation">
          {tabs.map((t) => (
            <Label
              key={t.key}
              as={Link}
              href={`/properties/${propertyPathId}/${t.key}`}
              aria-current={seg === t.key ? 'page' : undefined}
              size="sm"
              className={`border-b-2 px-1 py-4 transition-colors ${seg === t.key ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground hover:border-muted-foreground border-transparent'}`}
            >
              {t.label}
            </Label>
          ))}
        </nav>
      </div>
    </header>
  );
}

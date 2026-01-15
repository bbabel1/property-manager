'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Body, Heading, Label } from '@/ui/typography';

type AgencySummary = {
  title: string;
  idLabel?: string;
  idValue?: string | null;
  counts: Array<{ label: string; value: number }>;
  lastEvent?: string | null;
  cta?: { label: string; href?: string; onClick?: () => void };
  showFilings?: boolean;
  onViewFilings?: () => void;
};

function AgencyCard({ summary }: { summary: AgencySummary }) {
  const empty = summary.counts.every((c) => !c.value);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle headingAs="span" headingSize="h4">
          {summary.title}
        </CardTitle>
        {summary.idValue && (
          <Badge variant="outline" className="text-xs">
            {summary.idLabel || 'ID'}: {summary.idValue}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {empty ? (
          <Body tone="muted" size="sm">
            No data synced yet for this agency.
          </Body>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {summary.counts.map((c) => (
              <div key={c.label} className="space-y-1">
                <Label size="xs" tone="muted">
                  {c.label}
                </Label>
                <Heading as="div" size="h5">
                  {c.value}
                </Heading>
              </div>
            ))}
          </div>
        )}
        {summary.lastEvent && (
          <Body tone="muted" size="xs">
            Last event: {new Date(summary.lastEvent).toLocaleDateString()}
          </Body>
        )}
        {summary.cta && summary.cta.href && (
          <a
            className="text-primary text-xs underline"
            href={summary.cta.href}
            target="_blank"
            rel="noreferrer"
          >
            {summary.cta.label}
          </a>
        )}
        {summary.showFilings && summary.onViewFilings && (
          <button
            type="button"
            onClick={summary.onViewFilings}
            className="text-primary text-xs underline"
          >
            Filings
          </button>
        )}
      </CardContent>
    </Card>
  );
}

interface ComplianceAgencyCardsProps {
  hpd: {
    registration_id: string | null;
    building_id: string | null;
    violations: number;
    complaints: number;
    last_event_date: string | null;
  };
  fdny: { open_violations: number; last_event_date: string | null };
  dep: { open_violations: number; last_event_date: string | null };
  onViewHpdFilings?: () => void;
  hasHpdFilings?: boolean;
}

export function ComplianceAgencyCards({
  hpd,
  fdny,
  dep,
  onViewHpdFilings,
  hasHpdFilings,
}: ComplianceAgencyCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <AgencyCard
        summary={{
          title: 'HPD',
          idLabel: 'Reg ID',
          idValue: hpd.registration_id,
          counts: [
            { label: 'Violations', value: hpd.violations || 0 },
            { label: 'Complaints', value: hpd.complaints || 0 },
          ],
          lastEvent: hpd.last_event_date,
          showFilings: Boolean(hasHpdFilings),
          onViewFilings: onViewHpdFilings,
        }}
      />
      <AgencyCard
        summary={{
          title: 'FDNY',
          counts: [{ label: 'Open violations', value: fdny.open_violations || 0 }],
          lastEvent: fdny.last_event_date,
        }}
      />
      <AgencyCard
        summary={{
          title: 'DEP',
          counts: [{ label: 'Open violations', value: dep.open_violations || 0 }],
          lastEvent: dep.last_event_date,
        }}
      />
    </div>
  );
}

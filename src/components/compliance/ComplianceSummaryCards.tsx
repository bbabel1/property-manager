'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { Body, Heading } from '@/ui/typography';

interface ComplianceSummaryCardsProps {
  openViolations: number;
  overdueItems: number;
  itemsDueNext30Days: number;
  averageRiskScore: number | null;
}

export function ComplianceSummaryCards({
  openViolations,
  overdueItems,
  itemsDueNext30Days,
  averageRiskScore,
}: ComplianceSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Body as="div" size="sm" className="font-medium">
            Open Violations
          </Body>
          <AlertTriangle className="text-destructive h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Heading as="div" size="h2" className="font-bold">
            {openViolations}
          </Heading>
          <Body as="p" size="xs" tone="muted">
            Active compliance violations
          </Body>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Body as="div" size="sm" className="font-medium">
            Overdue Items
          </Body>
          <AlertTriangle className="text-destructive h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Heading as="div" size="h2" className="font-bold">
            {overdueItems}
          </Heading>
          <Body as="p" size="xs" tone="muted">
            Past due compliance items
          </Body>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Body as="div" size="sm" className="font-medium">
            Due in Next 30 Days
          </Body>
          <Clock className="text-warning h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Heading as="div" size="h2" className="font-bold">
            {itemsDueNext30Days}
          </Heading>
          <Body as="p" size="xs" tone="muted">
            Upcoming compliance deadlines
          </Body>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Body as="div" size="sm" className="font-medium">
            Average Risk Score
          </Body>
          <TrendingUp className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Heading as="div" size="h2" className="font-bold">
            {averageRiskScore !== null ? Math.round(averageRiskScore) : '—'}
          </Heading>
          <Body as="p" size="xs" tone="muted">
            {averageRiskScore !== null ? 'Portfolio risk level' : 'No data available'}
          </Body>
        </CardContent>
      </Card>
    </div>
  );
}

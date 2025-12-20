'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface PricingHistoryEntry {
  date: string;
  billing_basis: string;
  rate: number | null;
  frequency: string;
}

export default function PricingHistoryTimeline() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing History</CardTitle>
        <CardDescription>History is managed by Service Plans.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Pricing history is unavailable now that service plans control billing.
      </CardContent>
    </Card>
  );
}

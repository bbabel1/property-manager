'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';

type UnitServiceRow = {
  unit_id: string | null;
  unit_number: string | null;
  service_plan: string | null;
  active_services: string[];
  bill_administration: string | null;
  fee_amount: number | null;
  fee_percent: number | null;
  billing_frequency: string | null;
};

const frequencyLabel = (value: string | null | undefined) => {
  const map: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    annually: 'Annually',
    annual: 'Annually',
    one_time: 'One-time',
    'one-time': 'One-time',
    per_event: 'Per event',
    per_job: 'Per job',
  };
  if (!value) return '—';
  return map[value.toLowerCase()] || value;
};

export default function ManagementServiceUnitList({ propertyId }: { propertyId: string }) {
  const [units, setUnits] = useState<UnitServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/management-service/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to load unit services');
      }
      setUnits(Array.isArray(json?.data) ? (json.data as UnitServiceRow[]) : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load unit services';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-sm">Loading unit configurations…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!units.length) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-sm">
            No units found for this property. Add units to configure services.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {units.map((unit, idx) => (
        <Card key={unit.unit_id || unit.unit_number || `unit-${idx}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  Unit {unit.unit_number || unit.unit_id || '—'}
                </CardTitle>
                <CardDescription className="text-xs">
                  Plan: {unit.service_plan || '—'}
                </CardDescription>
              </div>
              {unit.unit_id ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/properties/${propertyId}/units/${unit.unit_id}`}>Open</Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {unit.active_services?.length ? (
                unit.active_services.map((svc) => (
                  <Badge key={svc} variant="secondary">
                    {svc}
                  </Badge>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No services selected</p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Fee Amount</p>
                <p className="text-foreground text-sm font-medium">
                  {unit.fee_amount != null ? `$${unit.fee_amount}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Fee Percent</p>
                <p className="text-foreground text-sm font-medium">
                  {unit.fee_percent != null ? `${unit.fee_percent}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Billing Frequency</p>
                <p className="text-foreground text-sm font-medium">
                  {frequencyLabel(unit.billing_frequency)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Billing Notes</p>
                <p className="text-foreground text-sm font-medium">
                  {unit.bill_administration || '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

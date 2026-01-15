'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Body, Heading, Label } from '@/ui/typography';

type TelemetryEvent = {
  event: string;
  lease_id: string | null;
  org_id: string | null;
  source: string | null;
  duration_ms: number | null;
  created_at: string;
};

type TelemetryResponse = {
  events: TelemetryEvent[];
  summary: {
    successRate: number;
    errorRate: number;
    averageDurationMs: number | null;
  } | null;
};

const chartConfig = {
  total: { label: 'Total', color: 'hsl(var(--primary))' },
  success: { label: 'Success', color: 'hsl(var(--success))' },
  error: { label: 'Error', color: 'hsl(var(--destructive))' },
} satisfies ChartConfig;

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function formatMs(value: number | null | undefined) {
  if (!value) return '—';
  return `${value} ms`;
}

export default function LeasesAnalyticsContent() {
  const totalColor = chartConfig.total.color || 'hsl(var(--primary))';
  const successColor = chartConfig.success.color || 'hsl(var(--success))';
  const errorColor = chartConfig.error.color || 'hsl(var(--destructive))';

  const [state, setState] = useState<{
    loading: boolean;
    data: TelemetryResponse | null;
    error: string | null;
  }>({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch('/api/telemetry/leases', { cache: 'no-store' });
        if (!res.ok) throw new Error('Request failed');
        const payload = (await res.json()) as TelemetryResponse;
        if (!cancelled) setState({ loading: false, data: payload, error: null });
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load telemetry. Please try again later.',
          });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const series = useMemo(() => {
    const byDate: Record<string, { total: number; success: number; error: number }> = {};
    (state.data?.events || []).forEach((evt) => {
      const dateKey = evt.created_at?.slice(0, 10);
      if (!dateKey) return;
      if (!byDate[dateKey]) byDate[dateKey] = { total: 0, success: 0, error: 0 };
      byDate[dateKey].total += 1;
      if (evt.event.includes('success')) byDate[dateKey].success += 1;
      if (evt.event.includes('error')) byDate[dateKey].error += 1;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  }, [state.data?.events]);

  const topSources = useMemo(() => {
    const counts: Record<string, number> = {};
    (state.data?.events || []).forEach((evt) => {
      if (!evt.source) return;
      counts[evt.source] = (counts[evt.source] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));
  }, [state.data?.events]);

  return (
    <div className="bg-background text-foreground min-h-screen w-full px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading as="h1" size="h3">Lease telemetry</Heading>
          <Body tone="muted" size="sm">
            Volume, success/error, and sources.
          </Body>
        </div>
        {state.error ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Error loading
          </Badge>
        ) : null}
      </div>

    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <Label as="span" size="sm" tone="muted">
              Success rate
            </Label>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <Heading as="span" size="h2">
            {formatPct(state.data?.summary?.successRate)}
          </Heading>
          <Label as="span" size="xs" tone="muted">
            last 500 events
          </Label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <Label as="span" size="sm" tone="muted">
              Error rate
            </Label>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <Heading as="span" size="h2">
            {formatPct(state.data?.summary?.errorRate)}
          </Heading>
          <Label as="span" size="xs" tone="muted">
            last 500 events
          </Label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            <Label as="span" size="sm" tone="muted">
              Avg submit duration
            </Label>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <Heading as="span" size="h2">
            {formatMs(state.data?.summary?.averageDurationMs)}
          </Heading>
          <Body as="span" size="xs" tone="muted">
            success/error events
          </Body>
        </CardContent>
      </Card>
    </div>

    {state.data?.summary?.errorRate && state.data.summary.errorRate > 0.2 ? (
      <Body
        as="div"
        size="sm"
        className="mt-3 rounded-md border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900"
      >
        Elevated error rate detected for lease creation. Check validation errors, API failures, or Buildium sync.
      </Body>
    ) : null}

    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Volume & outcomes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <Body as="div" size="sm" tone="muted">
              No telemetry available yet.
            </Body>
          ) : (
              <ChartContainer config={chartConfig}>
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickLine={false} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: 'hsl(var(--border))' }}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={totalColor}
                    fill={totalColor}
                    fillOpacity={0.18}
                  />
                  <Area
                    type="monotone"
                    dataKey="success"
                    stroke={successColor}
                    fill={successColor}
                    fillOpacity={0.16}
                  />
                  <Area
                    type="monotone"
                    dataKey="error"
                    stroke={errorColor}
                    fill={errorColor}
                    fillOpacity={0.12}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Top sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSources.length === 0 ? (
              <Body as="div" size="sm" tone="muted">
                No source data yet.
              </Body>
            ) : (
              topSources.map((item) => (
                <div key={item.source} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Body as="span" size="sm" className="truncate" title={item.source}>
                    {item.source}
                  </Body>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {state.error ? (
        <Body
          as="div"
          size="sm"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive"
        >
          {state.error}
        </Body>
      ) : null}
    </div>
  );
}

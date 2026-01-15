'use client';

import { useState, useTransition } from 'react';
import type { VendorDashboardData } from '@/lib/vendor-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Loader2, PlugZap, ShieldAlert, Sparkles } from 'lucide-react';
import { Body, Heading, Label } from '@/ui/typography';

interface VendorSourcingPanelProps {
  snapshot: VendorDashboardData['aiSnapshot'];
}

interface Recommendation {
  vendorName: string;
  vendorId?: string;
  confidence: number;
  category?: string | null;
  rationale: string;
  complianceStatus?: string;
  buildiumVendorId?: number | null;
  source: 'internal' | 'buildium';
}

interface BuildiumVendorItem {
  Name?: string;
  name?: string;
  Id?: number;
  id?: number;
  Category?: { Name?: string };
  categoryName?: string;
}

export function VendorSourcingPanel({ snapshot }: VendorSourcingPanelProps) {
  const [propertyQuery, setPropertyQuery] = useState('');
  const [jobCategory, setJobCategory] = useState('general');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const runSourcing = () => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          propertyQuery: propertyQuery.trim(),
          jobCategory,
          budget: budget ? Number(budget) : undefined,
          notes,
          snapshot,
        };
        const [internalResponse, buildiumResponse] = await Promise.all([
          fetch('/api/vendors/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
          fetch(`/api/buildium/vendors?name=${encodeURIComponent(propertyQuery || jobCategory)}`),
        ]);

        const internalJson = await internalResponse.json();
        const buildiumJson = buildiumResponse.ok ? await buildiumResponse.json() : null;

        if (!internalResponse.ok) {
          throw new Error(internalJson?.error || 'Failed to generate recommendations');
        }

        const internal: Recommendation[] = internalJson.recommendations ?? [];
        const external: Recommendation[] = Array.isArray(buildiumJson?.data)
          ? (buildiumJson.data as BuildiumVendorItem[]).slice(0, 5).map((item) => ({
              vendorName: item.Name ?? item.name ?? 'Unknown vendor',
              buildiumVendorId: item.Id ?? item.id ?? null,
              category: item.Category?.Name ?? item.categoryName ?? jobCategory,
              confidence: 0.55,
              source: 'buildium' as const,
              rationale: 'Matched from Buildium vendor directory based on search criteria.',
            }))
          : [];

        setRecommendations([...internal, ...external]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected sourcing error';
        setError(message);
      }
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>
              <Heading as="div" size="h5">
                AI vendor sourcing
              </Heading>
            </CardTitle>
            <CardDescription>
              Auto-source internal and Buildium vendors based on property needs.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <PlugZap className="mr-1 h-3.5 w-3.5" /> Integrations live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label as="label" htmlFor="sourcing-property" size="sm">
              Property or location
            </Label>
            <Input
              id="sourcing-property"
              placeholder="e.g., 145 Beacon Street or North Boston"
              value={propertyQuery}
              onChange={(event) => setPropertyQuery(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label as="label" size="sm">
              Job category
            </Label>
            <Select value={jobCategory} onValueChange={setJobCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General maintenance</SelectItem>
                <SelectItem value="plumbing">Plumbing</SelectItem>
                <SelectItem value="electrical">Electrical</SelectItem>
                <SelectItem value="hvac">HVAC</SelectItem>
                <SelectItem value="landscaping">Landscaping</SelectItem>
                <SelectItem value="roofing">Roofing</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label as="label" htmlFor="sourcing-budget" size="sm">
              Budget (optional)
            </Label>
            <Input
              id="sourcing-budget"
              type="number"
              min="0"
              placeholder="Estimated budget"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label as="label" htmlFor="sourcing-notes" size="sm">
              Job notes (optional)
            </Label>
            <Input
              id="sourcing-notes"
              placeholder="Any special requirements"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Body as="div" size="xs" tone="muted">
            Combines Ora vendor history, compliance data, and live Buildium directory.
          </Body>
          <Button type="button" className="gap-2" onClick={runSourcing} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate matches
          </Button>
        </div>
        {error ? (
          <Body as="div" size="xs" className="text-destructive">
            {error}
          </Body>
        ) : null}
        <ScrollArea className="h-[260px] rounded-lg border">
          <div className="space-y-3 p-4">
            {recommendations.length > 0 ? (
              recommendations.map((rec, index) => (
                <div
                  key={`${rec.vendorName}-${index}`}
                  className="border-border/70 bg-card rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Heading as="div" size="h6" className="flex items-center gap-2">
                      {rec.source === 'internal' ? (
                        <Sparkles className="text-primary h-4 w-4" />
                      ) : (
                        <Building2 className="text-muted-foreground h-4 w-4" />
                      )}
                      <span className="font-semibold">{rec.vendorName}</span>
                      {rec.category ? <Badge variant="outline">{rec.category}</Badge> : null}
                    </Heading>
                    <Body as="div" size="xs" tone="muted" className="flex items-center gap-2">
                      <span>
                        {rec.source === 'internal' ? 'Internal intelligence' : 'Buildium directory'}
                      </span>
                      <Badge variant="secondary">
                        Confidence {(rec.confidence * 100).toFixed(0)}%
                      </Badge>
                    </Body>
                  </div>
                  <Body as="p" size="xs" tone="muted" className="mt-1">
                    {rec.rationale}
                  </Body>
                  <Body
                    as="div"
                    size="xs"
                    tone="muted"
                    className="mt-2 flex flex-wrap gap-2"
                  >
                    {rec.complianceStatus ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Compliance: {rec.complianceStatus}
                      </span>
                    ) : null}
                    {rec.buildiumVendorId ? (
                      <span className="inline-flex items-center gap-1">
                        Buildium ID {rec.buildiumVendorId}
                      </span>
                    ) : null}
                  </Body>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary">
                      Invite to quote
                    </Button>
                    <Button size="sm" variant="ghost">
                      Preview outreach
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <Body
                as="div"
                size="sm"
                tone="muted"
                className="flex h-[200px] flex-col items-center justify-center gap-2 text-center"
              >
                <PlugZap className="text-primary h-5 w-5" />
                Run sourcing to pull AI-ranked matches from internal data and Buildium.
              </Body>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default VendorSourcingPanel;

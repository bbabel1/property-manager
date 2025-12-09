'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Settings, Package, DollarSign, Zap } from 'lucide-react';
import { formatCurrency } from '@/lib/format-currency';
import AutomationRulesAdmin from '@/components/settings/AutomationRulesAdmin';

interface ServiceOffering {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  billing_basis: string;
  default_rate: number | null;
  default_freq: string;
  is_active: boolean;
}

interface PlanDefault {
  service_plan: string;
  offering_id: string;
  offering_name: string;
  billing_basis: string;
  default_rate: number | null;
  plan_fee_percent: number | null;
  min_monthly_fee: number | null;
}

export default function ServiceCatalogAdmin() {
  const [activeTab, setActiveTab] = useState<'offerings' | 'plans' | 'automation'>('offerings');
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [planDefaults, setPlanDefaults] = useState<PlanDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch service offerings
      const offeringsResponse = await fetch('/api/services/catalog');
      if (!offeringsResponse.ok) {
        throw new Error('Failed to load service catalog');
      }
      const offeringsData = await offeringsResponse.json();
      setOfferings(offeringsData.data || []);

      // Fetch plan defaults
      const plansResponse = await fetch('/api/services/plan-defaults');
      if (!plansResponse.ok) {
        throw new Error('Failed to load plan defaults');
      }
      const plansData = await plansResponse.json();
      setPlanDefaults(plansData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const offeringsByCategory = offerings.reduce(
    (acc, offering) => {
      const category = offering.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(offering);
      return acc;
    },
    {} as Record<string, ServiceOffering[]>,
  );

  const planDefaultsByPlan = planDefaults.reduce(
    (acc, default_) => {
      const plan = default_.service_plan;
      if (!acc[plan]) acc[plan] = [];
      acc[plan].push(default_);
      return acc;
    },
    {} as Record<string, PlanDefault[]>,
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center">
          Loading service catalog...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-destructive text-center">{error}</div>
          <div className="mt-4 text-center">
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="offerings" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Service Offerings
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Plan Defaults
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automation Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="offerings" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Service Offerings Catalog</CardTitle>
                  <CardDescription>
                    View and manage all available service offerings. {offerings.length} total
                    offerings.
                  </CardDescription>
                </div>
                <Button variant="outline" disabled title="Adding services will be available soon">
                  Add Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(offeringsByCategory).map(([category, categoryOfferings]) => (
                  <div key={category}>
                    <h3 className="text-foreground mb-3 text-lg font-semibold">{category}</h3>
                    <div className="border-border overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Billing Basis</TableHead>
                            <TableHead>Default Rate</TableHead>
                            <TableHead>Frequency</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryOfferings.map((offering) => (
                            <TableRow key={offering.id}>
                              <TableCell className="font-mono text-sm">{offering.code}</TableCell>
                              <TableCell className="font-medium">{offering.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{offering.billing_basis}</Badge>
                              </TableCell>
                              <TableCell>
                                {offering.default_rate != null
                                  ? formatCurrency(offering.default_rate)
                                  : '—'}
                              </TableCell>
                              <TableCell>{offering.default_freq}</TableCell>
                              <TableCell>
                                <Badge variant={offering.is_active ? 'default' : 'secondary'}>
                                  {offering.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plan Default Pricing</CardTitle>
                  <CardDescription>
                    Configure default pricing for Basic, Full, and other service plans.
                  </CardDescription>
                </div>
                <Button variant="outline" disabled title="Plan configuration coming soon">
                  Configure Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['Full', 'Basic', 'A-la-carte', 'Custom'].map((plan) => {
                  const defaults = planDefaultsByPlan[plan] || [];
                  return (
                    <div key={plan}>
                      <h3 className="text-foreground mb-3 text-lg font-semibold">{plan} Plan</h3>
                      {defaults.length === 0 ? (
                        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                          No default pricing configured for {plan} plan.
                        </div>
                      ) : (
                        <div className="border-border overflow-hidden rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Service</TableHead>
                                <TableHead>Billing Basis</TableHead>
                                <TableHead>Default Rate</TableHead>
                                <TableHead>Plan Fee %</TableHead>
                                <TableHead>Min Monthly Fee</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {defaults.map((default_) => (
                                <TableRow key={`${plan}-${default_.offering_id}`}>
                                  <TableCell className="font-medium">
                                    {default_.offering_name}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{default_.billing_basis}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {default_.default_rate != null
                                      ? formatCurrency(default_.default_rate)
                                      : '—'}
                                  </TableCell>
                                  <TableCell>
                                    {default_.plan_fee_percent != null
                                      ? `${default_.plan_fee_percent}%`
                                      : '—'}
                                  </TableCell>
                                  <TableCell>
                                    {default_.min_monthly_fee != null
                                      ? formatCurrency(default_.min_monthly_fee)
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-6">
          <AutomationRulesAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

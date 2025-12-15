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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Package, DollarSign, Zap, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
  min_amount?: number | null;
  max_amount?: number | null;
  applies_to?: string;
  bill_on?: string;
  default_rent_basis?: string | null;
  markup_pct?: number | null;
  markup_pct_cap?: number | null;
  hourly_rate?: number | null;
  hourly_min_hours?: number | null;
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
  default_freq?: string;
  bill_on?: string;
  rent_basis?: string | null;
  min_amount?: number | null;
  max_amount?: number | null;
  markup_pct?: number | null;
  markup_pct_cap?: number | null;
  hourly_rate?: number | null;
  hourly_min_hours?: number | null;
  is_included?: boolean;
  is_required?: boolean;
}

const PLAN_NAMES = ['Full', 'Basic', 'A-la-carte', 'Custom'];
const BILLING_BASIS_OPTIONS = [
  { value: 'per_property', label: 'Per Property' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'percent_rent', label: 'Percent of Rent' },
  { value: 'job_cost', label: 'Job Cost Markup' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'one_time', label: 'One Time' },
];
const BILLING_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'per_event', label: 'Per Event' },
  { value: 'per_job', label: 'Per Job' },
  { value: 'one_time', label: 'One Time' },
];
const APPLIES_TO_OPTIONS = [
  { value: 'property', label: 'Property' },
  { value: 'unit', label: 'Unit' },
  { value: 'owner', label: 'Owner' },
  { value: 'building', label: 'Building' },
];
const BILL_ON_OPTIONS = [
  { value: 'calendar_day', label: 'Calendar Day' },
  { value: 'event', label: 'Event' },
  { value: 'job_close', label: 'Job Close' },
  { value: 'lease_event', label: 'Lease Event' },
  { value: 'time_log', label: 'Time Log' },
];
const RENT_BASIS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'billed', label: 'Billed' },
  { value: 'collected', label: 'Collected' },
];

const numberOrNull = (value: string | number | null | undefined) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function ServiceCatalogAdmin() {
  const [activeTab, setActiveTab] = useState<'offerings' | 'plans' | 'automation'>('offerings');
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [planDefaults, setPlanDefaults] = useState<PlanDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfferingDialogOpen, setIsOfferingDialogOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<ServiceOffering | null>(null);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [planDialogState, setPlanDialogState] = useState<{
    plan: string;
    defaultRow: PlanDefault | null;
  }>({
    plan: PLAN_NAMES[0],
    defaultRow: null,
  });
  const [deletingOfferingId, setDeletingOfferingId] = useState<string | null>(null);

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

  const handleSaveOffering = async (payload: Partial<ServiceOffering>) => {
    const method = payload.id ? 'PUT' : 'POST';
    const url = payload.id ? `/api/services/catalog/${payload.id}` : '/api/services/catalog';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.error?.message || result?.error || 'Failed to save service offering';
      throw new Error(message);
    }

    toast.success(payload.id ? 'Service offering updated' : 'Service offering created');
    setIsOfferingDialogOpen(false);
    setEditingOffering(null);
    await loadData();
  };

  const handleDeleteOffering = async (offering: ServiceOffering) => {
    setDeletingOfferingId(offering.id);
    try {
      const response = await fetch(`/api/services/catalog/${offering.id}`, {
        method: 'DELETE',
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = result?.error?.message || result?.error || 'Failed to delete service offering';
        throw new Error(message);
      }

      toast.success('Service offering deleted');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete service offering';
      toast.error(message);
    } finally {
      setDeletingOfferingId(null);
    }
  };

  const handleSavePlanDefault = async (
    payload: Partial<PlanDefault> & { service_plan: string; offering_id: string },
    isUpdate: boolean,
  ) => {
    const method = isUpdate ? 'PUT' : 'POST';
    const response = await fetch('/api/services/plan-defaults', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.error?.message || result?.error || 'Failed to save plan default';
      throw new Error(message);
    }

    toast.success(isUpdate ? 'Plan default updated' : 'Plan default saved');
    setPlanDialogState({ plan: PLAN_NAMES[0], defaultRow: null });
    setIsPlanDialogOpen(false);
    await loadData();
  };

  const openNewOfferingDialog = () => {
    setEditingOffering(null);
    setIsOfferingDialogOpen(true);
  };

  const openEditOfferingDialog = (offering: ServiceOffering) => {
    setEditingOffering(offering);
    setIsOfferingDialogOpen(true);
  };

  const openCreatePlanDefault = (plan: string) => {
    setPlanDialogState({ plan, defaultRow: null });
    setIsPlanDialogOpen(true);
  };

  const openEditPlanDefault = (plan: string, defaultRow: PlanDefault) => {
    setPlanDialogState({ plan, defaultRow });
    setIsPlanDialogOpen(true);
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
                <Button variant="outline" onClick={openNewOfferingDialog}>
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
                            <TableHead className="text-right">Actions</TableHead>
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
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditOfferingDialog(offering)}
                                  >
                                    <Edit className="mr-1 h-4 w-4" />
                                    Edit
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        disabled={deletingOfferingId === offering.id}
                                        aria-label="Delete service offering"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Delete {offering.name}?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will remove the service from the catalog and any related plan defaults. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel
                                          disabled={deletingOfferingId === offering.id}
                                        >
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteOffering(offering)}
                                          disabled={deletingOfferingId === offering.id}
                                        >
                                          {deletingOfferingId === offering.id
                                            ? 'Deleting...'
                                            : 'Delete'}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
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
                <Button
                  variant="outline"
                  onClick={() => openCreatePlanDefault(planDialogState.plan)}
                >
                  Configure Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {PLAN_NAMES.map((plan) => {
                  const defaults = planDefaultsByPlan[plan] || [];
                  return (
                    <div key={plan}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-foreground text-lg font-semibold">{plan} Plan</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreatePlanDefault(plan)}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add pricing
                        </Button>
                      </div>
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
                                <TableHead className="text-right">Actions</TableHead>
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
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditPlanDefault(plan, default_)}
                                    >
                                      <Edit className="mr-1 h-4 w-4" />
                                      Edit
                                    </Button>
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

      <Dialog
        open={isOfferingDialogOpen}
        onOpenChange={(open) => {
          setIsOfferingDialogOpen(open);
          if (!open) setEditingOffering(null);
        }}
      >
        <DialogContent className="w-[680px] max-w-[680px]">
          <DialogHeader>
            <DialogTitle>
              {editingOffering ? 'Edit Service Offering' : 'Add Service Offering'}
            </DialogTitle>
            <DialogDescription>
              {editingOffering
                ? 'Update catalog details and default pricing for this service.'
                : 'Create a new service offering in the catalog.'}
            </DialogDescription>
          </DialogHeader>
          <ServiceOfferingForm
            offering={editingOffering}
            onSave={handleSaveOffering}
            onCancel={() => {
              setIsOfferingDialogOpen(false);
              setEditingOffering(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPlanDialogOpen}
        onOpenChange={(open) => {
          setIsPlanDialogOpen(open);
          if (!open) setPlanDialogState({ plan: PLAN_NAMES[0], defaultRow: null });
        }}
      >
        <DialogContent className="w-[680px] max-w-[680px]">
          <DialogHeader>
            <DialogTitle>
              {planDialogState.defaultRow ? 'Edit Plan Default' : 'Configure Plan Pricing'}
            </DialogTitle>
            <DialogDescription>
              Set default pricing for services included in each plan. These values are used when new
              properties are assigned to the plan.
            </DialogDescription>
          </DialogHeader>
          <PlanDefaultForm
            plan={planDialogState.plan}
            defaultRow={planDialogState.defaultRow}
            offerings={offerings}
            onSave={handleSavePlanDefault}
            onCancel={() => {
              setIsPlanDialogOpen(false);
              setPlanDialogState({ plan: PLAN_NAMES[0], defaultRow: null });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ServiceOfferingFormProps {
  offering: ServiceOffering | null;
  onSave: (payload: Partial<ServiceOffering>) => Promise<void>;
  onCancel: () => void;
}

function ServiceOfferingForm({ offering, onSave, onCancel }: ServiceOfferingFormProps) {
  const [code, setCode] = useState(offering?.code ?? '');
  const [name, setName] = useState(offering?.name ?? '');
  const [category, setCategory] = useState(offering?.category ?? 'Financial Management');
  const [billingBasis, setBillingBasis] = useState(offering?.billing_basis ?? 'per_property');
  const [defaultRate, setDefaultRate] = useState(
    offering?.default_rate != null ? String(offering.default_rate) : '',
  );
  const [defaultFreq, setDefaultFreq] = useState(offering?.default_freq ?? 'monthly');
  const [appliesTo, setAppliesTo] = useState(offering?.applies_to ?? 'property');
  const [billOn, setBillOn] = useState(offering?.bill_on ?? 'calendar_day');
  const [defaultRentBasis, setDefaultRentBasis] = useState(
    offering?.default_rent_basis ?? 'scheduled',
  );
  const [minAmount, setMinAmount] = useState(
    offering?.min_amount != null ? String(offering.min_amount) : '',
  );
  const [maxAmount, setMaxAmount] = useState(
    offering?.max_amount != null ? String(offering.max_amount) : '',
  );
  const [markupPct, setMarkupPct] = useState(
    offering?.markup_pct != null ? String(offering.markup_pct) : '',
  );
  const [markupPctCap, setMarkupPctCap] = useState(
    offering?.markup_pct_cap != null ? String(offering.markup_pct_cap) : '',
  );
  const [hourlyRate, setHourlyRate] = useState(
    offering?.hourly_rate != null ? String(offering.hourly_rate) : '',
  );
  const [hourlyMinHours, setHourlyMinHours] = useState(
    offering?.hourly_min_hours != null ? String(offering.hourly_min_hours) : '',
  );
  const [description, setDescription] = useState(offering?.description ?? '');
  const [isActive, setIsActive] = useState(offering?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCode(offering?.code ?? '');
    setName(offering?.name ?? '');
    setCategory(offering?.category ?? 'Financial Management');
    setBillingBasis(offering?.billing_basis ?? 'per_property');
    setDefaultRate(offering?.default_rate != null ? String(offering.default_rate) : '');
    setDefaultFreq(offering?.default_freq ?? 'monthly');
    setAppliesTo(offering?.applies_to ?? 'property');
    setBillOn(offering?.bill_on ?? 'calendar_day');
    setDefaultRentBasis(offering?.default_rent_basis ?? 'scheduled');
    setMinAmount(offering?.min_amount != null ? String(offering.min_amount) : '');
    setMaxAmount(offering?.max_amount != null ? String(offering.max_amount) : '');
    setMarkupPct(offering?.markup_pct != null ? String(offering.markup_pct) : '');
    setMarkupPctCap(offering?.markup_pct_cap != null ? String(offering.markup_pct_cap) : '');
    setHourlyRate(offering?.hourly_rate != null ? String(offering.hourly_rate) : '');
    setHourlyMinHours(offering?.hourly_min_hours != null ? String(offering.hourly_min_hours) : '');
    setDescription(offering?.description ?? '');
    setIsActive(offering?.is_active ?? true);
    setFormError(null);
  }, [offering]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim() || !name.trim()) {
      setFormError('Code and Name are required.');
      return;
    }

    if (billingBasis === 'percent_rent' && numberOrNull(defaultRate) === null) {
      setFormError('Default rate is required for percent-of-rent services.');
      return;
    }

    if (billingBasis === 'job_cost' && numberOrNull(markupPct) === null) {
      setFormError('Markup % is required for job-cost services.');
      return;
    }

    if (
      billingBasis === 'hourly' &&
      (numberOrNull(hourlyRate) === null || numberOrNull(hourlyMinHours) === null)
    ) {
      setFormError('Hourly rate and minimum hours are required for hourly services.');
      return;
    }

    const payload: Partial<ServiceOffering> = {
      id: offering?.id,
      code: code.trim(),
      name: name.trim(),
      category,
      description: description.trim() || null,
      billing_basis: billingBasis,
      default_rate: numberOrNull(defaultRate),
      default_freq: defaultFreq,
      min_amount: numberOrNull(minAmount),
      max_amount: numberOrNull(maxAmount),
      applies_to: appliesTo,
      bill_on: billOn,
      default_rent_basis: billingBasis === 'percent_rent' ? defaultRentBasis : undefined,
      markup_pct: billingBasis === 'job_cost' ? numberOrNull(markupPct) : undefined,
      markup_pct_cap: billingBasis === 'job_cost' ? numberOrNull(markupPctCap) : undefined,
      hourly_rate: billingBasis === 'hourly' ? numberOrNull(hourlyRate) : undefined,
      hourly_min_hours: billingBasis === 'hourly' ? numberOrNull(hourlyMinHours) : undefined,
      is_active: isActive,
    };

    setSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save service offering';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service-code">Code</Label>
          <Input
            id="service-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="RENT_COLLECTION"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="service-name">Name</Label>
          <Input
            id="service-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rent Collection"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Financial Management">Financial Management</SelectItem>
              <SelectItem value="Property Care">Property Care</SelectItem>
              <SelectItem value="Resident Services">Resident Services</SelectItem>
              <SelectItem value="Compliance & Legal">Compliance & Legal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-basis">Billing Basis</Label>
          <Select value={billingBasis} onValueChange={setBillingBasis}>
            <SelectTrigger id="billing-basis">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_BASIS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="default-rate">
            Default Rate{' '}
            {billingBasis === 'percent_rent'
              ? '(%)'
              : billingBasis === 'job_cost'
                ? '(%)'
                : '(USD)'}
          </Label>
          <Input
            id="default-rate"
            type="number"
            step="0.01"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="0.00"
            disabled={billingBasis === 'job_cost'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-freq">Billing Frequency</Label>
          <Select value={defaultFreq} onValueChange={setDefaultFreq}>
            <SelectTrigger id="default-freq">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill-on">Bill On</Label>
          <Select value={billOn} onValueChange={setBillOn}>
            <SelectTrigger id="bill-on">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILL_ON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="applies-to">Applies To</Label>
          <Select value={appliesTo} onValueChange={setAppliesTo}>
            <SelectTrigger id="applies-to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLIES_TO_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-amount">Min Amount</Label>
          <Input
            id="min-amount"
            type="number"
            step="0.01"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-amount">Max Amount</Label>
          <Input
            id="max-amount"
            type="number"
            step="0.01"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      {billingBasis === 'percent_rent' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rent-basis">Rent Basis</Label>
            <Select value={defaultRentBasis} onValueChange={setDefaultRentBasis}>
              <SelectTrigger id="rent-basis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RENT_BASIS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Plan Fee % (set per plan)</Label>
            <Input value="Configured per plan" disabled />
          </div>
        </div>
      )}

      {billingBasis === 'job_cost' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="markup-pct">Markup %</Label>
            <Input
              id="markup-pct"
              type="number"
              step="0.01"
              value={markupPct}
              onChange={(e) => setMarkupPct(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="markup-cap">Markup Cap % (optional)</Label>
            <Input
              id="markup-cap"
              type="number"
              step="0.01"
              value={markupPctCap}
              onChange={(e) => setMarkupPctCap(e.target.value)}
            />
          </div>
        </div>
      )}

      {billingBasis === 'hourly' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="hourly-rate">Hourly Rate</Label>
            <Input
              id="hourly-rate"
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min-hours">Minimum Hours</Label>
            <Input
              id="min-hours"
              type="number"
              step="0.25"
              value={hourlyMinHours}
              onChange={(e) => setHourlyMinHours(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description || ''}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this service includes..."
          rows={4}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="is-active">Active</Label>
      </div>

      {formError && <div className="text-destructive text-sm">{formError}</div>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : offering ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  );
}

interface PlanDefaultFormProps {
  plan: string;
  defaultRow: PlanDefault | null;
  offerings: ServiceOffering[];
  onSave: (
    payload: Partial<PlanDefault> & { service_plan: string; offering_id: string },
    isUpdate: boolean,
  ) => Promise<void>;
  onCancel: () => void;
}

function PlanDefaultForm({ plan, defaultRow, offerings, onSave, onCancel }: PlanDefaultFormProps) {
  const [servicePlan, setServicePlan] = useState(plan);
  const [offeringId, setOfferingId] = useState(defaultRow?.offering_id ?? '');
  const [billingBasis, setBillingBasis] = useState(
    defaultRow?.billing_basis || offerings.find((o) => o.id === offeringId)?.billing_basis || '',
  );
  const [defaultRate, setDefaultRate] = useState(
    defaultRow?.default_rate != null
      ? String(defaultRow.default_rate)
      : offerings.find((o) => o.id === offeringId)?.default_rate != null
        ? String(offerings.find((o) => o.id === offeringId)?.default_rate)
        : '',
  );
  const [planFeePercent, setPlanFeePercent] = useState(
    defaultRow?.plan_fee_percent != null ? String(defaultRow.plan_fee_percent) : '',
  );
  const [minMonthlyFee, setMinMonthlyFee] = useState(
    defaultRow?.min_monthly_fee != null ? String(defaultRow.min_monthly_fee) : '',
  );
  const [defaultFreq, setDefaultFreq] = useState(
    defaultRow?.default_freq ||
      offerings.find((o) => o.id === offeringId)?.default_freq ||
      'monthly',
  );
  const [billOn, setBillOn] = useState(
    defaultRow?.bill_on || offerings.find((o) => o.id === offeringId)?.bill_on || 'calendar_day',
  );
  const [rentBasis, setRentBasis] = useState(
    defaultRow?.rent_basis ||
      offerings.find((o) => o.id === offeringId)?.default_rent_basis ||
      'scheduled',
  );
  const [minAmount, setMinAmount] = useState(
    defaultRow?.min_amount != null
      ? String(defaultRow.min_amount)
      : offerings.find((o) => o.id === offeringId)?.min_amount != null
        ? String(offerings.find((o) => o.id === offeringId)?.min_amount)
        : '',
  );
  const [maxAmount, setMaxAmount] = useState(
    defaultRow?.max_amount != null
      ? String(defaultRow.max_amount)
      : offerings.find((o) => o.id === offeringId)?.max_amount != null
        ? String(offerings.find((o) => o.id === offeringId)?.max_amount)
        : '',
  );
  const [isIncluded, setIsIncluded] = useState(defaultRow?.is_included ?? true);
  const [isRequired, setIsRequired] = useState(defaultRow?.is_required ?? false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedOffering = offerings.find((o) => o.id === offeringId);
  const isEdit = Boolean(defaultRow);

  useEffect(() => {
    setServicePlan(plan);
  }, [plan]);

  useEffect(() => {
    if (isEdit && defaultRow) {
      setOfferingId(defaultRow.offering_id);
      setBillingBasis(defaultRow.billing_basis);
      setDefaultRate(defaultRow.default_rate != null ? String(defaultRow.default_rate) : '');
      setPlanFeePercent(
        defaultRow.plan_fee_percent != null ? String(defaultRow.plan_fee_percent) : '',
      );
      setMinMonthlyFee(
        defaultRow.min_monthly_fee != null ? String(defaultRow.min_monthly_fee) : '',
      );
      setDefaultFreq(defaultRow.default_freq || selectedOffering?.default_freq || 'monthly');
      setBillOn(defaultRow.bill_on || selectedOffering?.bill_on || 'calendar_day');
      setRentBasis(
        defaultRow.rent_basis || selectedOffering?.default_rent_basis || rentBasis || 'scheduled',
      );
      setMinAmount(defaultRow.min_amount != null ? String(defaultRow.min_amount) : '');
      setMaxAmount(defaultRow.max_amount != null ? String(defaultRow.max_amount) : '');
      setIsIncluded(defaultRow.is_included ?? true);
      setIsRequired(defaultRow.is_required ?? false);
      setFormError(null);
    }
  }, [defaultRow, isEdit, selectedOffering, rentBasis]);

  useEffect(() => {
    if (!isEdit && selectedOffering) {
      setBillingBasis(selectedOffering.billing_basis);
      setDefaultFreq(selectedOffering.default_freq);
      setBillOn(selectedOffering.bill_on || 'calendar_day');
      if (!defaultRate) {
        setDefaultRate(
          selectedOffering.default_rate != null ? String(selectedOffering.default_rate) : '',
        );
      }
      setRentBasis(selectedOffering.default_rent_basis || 'scheduled');
      if (!minAmount) {
        setMinAmount(
          selectedOffering.min_amount != null ? String(selectedOffering.min_amount) : '',
        );
      }
      if (!maxAmount) {
        setMaxAmount(
          selectedOffering.max_amount != null ? String(selectedOffering.max_amount) : '',
        );
      }
    }
  }, [isEdit, selectedOffering, defaultRate, minAmount, maxAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!servicePlan || !offeringId) {
      setFormError('Plan and service are required.');
      return;
    }

    const basis = billingBasis || selectedOffering?.billing_basis;

    if (!basis) {
      setFormError('Billing basis is required.');
      return;
    }

    if (
      basis === 'percent_rent' &&
      (servicePlan === 'Basic' || servicePlan === 'Full') &&
      numberOrNull(planFeePercent) === null
    ) {
      setFormError('Plan fee % is required for rent-based Basic/Full plans.');
      return;
    }

    const payload: Partial<PlanDefault> & { service_plan: string; offering_id: string } = {
      service_plan: servicePlan,
      offering_id: offeringId,
      billing_basis: basis,
      default_rate: numberOrNull(defaultRate),
      plan_fee_percent: numberOrNull(planFeePercent),
      min_monthly_fee: numberOrNull(minMonthlyFee),
      default_freq: defaultFreq,
      bill_on: billOn,
      rent_basis: basis === 'percent_rent' ? rentBasis : null,
      min_amount: numberOrNull(minAmount),
      max_amount: numberOrNull(maxAmount),
      is_included: isIncluded,
      is_required: isRequired,
    };

    if (selectedOffering?.markup_pct !== undefined) {
      payload.markup_pct = selectedOffering.markup_pct ?? undefined;
      payload.markup_pct_cap = selectedOffering.markup_pct_cap ?? undefined;
    }
    if (selectedOffering?.hourly_rate !== undefined) {
      payload.hourly_rate = selectedOffering.hourly_rate ?? undefined;
      payload.hourly_min_hours = selectedOffering.hourly_min_hours ?? undefined;
    }

    setSaving(true);
    try {
      await onSave(payload, isEdit);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save plan default';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plan">Plan</Label>
          <Select value={servicePlan} onValueChange={setServicePlan} disabled={isEdit}>
            <SelectTrigger id="plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_NAMES.map((planName) => (
                <SelectItem key={planName} value={planName}>
                  {planName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-offering">Service</Label>
          <Select value={offeringId} onValueChange={setOfferingId} disabled={isEdit}>
            <SelectTrigger id="plan-offering">
              <SelectValue placeholder="Select service offering" />
            </SelectTrigger>
            <SelectContent>
              {offerings.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Billing Basis</Label>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{billingBasis || '—'}</Badge>
            {selectedOffering?.default_freq && (
              <span className="text-muted-foreground text-xs">
                {selectedOffering.default_freq} · {selectedOffering.applies_to}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-default-freq">Billing Frequency</Label>
          <Select value={defaultFreq} onValueChange={setDefaultFreq}>
            <SelectTrigger id="plan-default-freq">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="plan-default-rate">
            Default Rate{' '}
            {billingBasis === 'percent_rent' || billingBasis === 'job_cost' ? '(%)' : '(USD)'}
          </Label>
          <Input
            id="plan-default-rate"
            type="number"
            step="0.01"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-fee">Plan Fee %</Label>
          <Input
            id="plan-fee"
            type="number"
            step="0.01"
            value={planFeePercent}
            onChange={(e) => setPlanFeePercent(e.target.value)}
            placeholder="e.g. 4"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-monthly-fee">Min Monthly Fee</Label>
          <Input
            id="min-monthly-fee"
            type="number"
            step="0.01"
            value={minMonthlyFee}
            onChange={(e) => setMinMonthlyFee(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="plan-bill-on">Bill On</Label>
          <Select value={billOn} onValueChange={setBillOn}>
            <SelectTrigger id="plan-bill-on">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILL_ON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-min-amount">Min Amount</Label>
          <Input
            id="plan-min-amount"
            type="number"
            step="0.01"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-max-amount">Max Amount</Label>
          <Input
            id="plan-max-amount"
            type="number"
            step="0.01"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      {billingBasis === 'percent_rent' && (
        <div className="space-y-2">
          <Label htmlFor="plan-rent-basis">Rent Basis</Label>
          <Select value={rentBasis} onValueChange={setRentBasis}>
            <SelectTrigger id="plan-rent-basis">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RENT_BASIS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch id="is-included" checked={isIncluded} onCheckedChange={setIsIncluded} />
          <Label htmlFor="is-included">Included</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="is-required" checked={isRequired} onCheckedChange={setIsRequired} />
          <Label htmlFor="is-required">Required</Label>
        </div>
      </div>

      {formError && <div className="text-destructive text-sm">{formError}</div>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Update Plan Default' : 'Save Plan Default'}
        </Button>
      </div>
    </form>
  );
}

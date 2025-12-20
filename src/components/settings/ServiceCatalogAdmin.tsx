'use client';

import { useEffect, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Package, Zap, Edit, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format-currency';
import AutomationRulesAdmin from '@/components/settings/AutomationRulesAdmin';

type FeeType = 'Percentage' | 'Flat Rate';
const GL_UNASSIGNED_VALUE = '__UNASSIGNED__';
const DEFAULT_PLAN_AMOUNT_TYPE = 'flat';
const DEFAULT_PLAN_PERCENT_BASIS = 'lease_rent_amount';

export interface ServiceOffering {
  id: string;
  name: string;
  category: string;
  description: string | null;
  default_rate: number | null;
  default_freq: string;
  billing_basis?: string | null;
  default_rent_basis?: string | null;
  fee_type?: FeeType | null;
  markup_pct?: number | null;
  markup_pct_cap?: number | null;
  hourly_rate?: number | null;
  hourly_min_hours?: number | null;
  is_active: boolean;
}

export default function ServiceCatalogAdmin() {
  const [activeTab, setActiveTab] = useState<'offerings' | 'plans' | 'automation'>('offerings');
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [plans, setPlans] = useState<
    Array<{
      id: string;
      name: string;
      gl_account_id?: string | null;
      amount_type?: string | null;
      percent_basis?: string | null;
      is_active?: boolean | null;
      default_fee_amount?: number | null;
      default_fee_percent?: number | null;
      offering_ids?: string[];
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfferingDialogOpen, setIsOfferingDialogOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<ServiceOffering | null>(null);
  const [deletingOfferingId, setDeletingOfferingId] = useState<string | null>(null);
  const [glAccounts, setGlAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [loadingPlanDetails, setLoadingPlanDetails] = useState(false);
  const [isALaCartePlan, setIsALaCartePlan] = useState(false);
  const [planForm, setPlanForm] = useState<{
    name: string;
    amount_type: string;
    percent_basis: string;
    is_active: boolean;
    gl_account_id: string;
    default_fee_amount: string;
    default_fee_percent: string;
  }>({
    name: '',
    amount_type: DEFAULT_PLAN_AMOUNT_TYPE,
    percent_basis: DEFAULT_PLAN_PERCENT_BASIS,
    is_active: true,
    gl_account_id: GL_UNASSIGNED_VALUE,
    default_fee_amount: '',
    default_fee_percent: '',
  });
  const [planAssignedOfferingIds, setPlanAssignedOfferingIds] = useState<Set<string>>(new Set());
  const [selectedUnassignedOfferingIds, setSelectedUnassignedOfferingIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAssignedOfferingIds, setSelectedAssignedOfferingIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const offeringsResponse = await fetch('/api/services/catalog');
      if (!offeringsResponse.ok) {
        throw new Error('Failed to load service catalog');
      }
      const offeringsData = await offeringsResponse.json();
      const offeringRows = Array.isArray(offeringsData?.data)
        ? offeringsData.data.map((o: ServiceOffering) => o)
        : [];
      setOfferings(offeringRows);

      // Fetch service plans (with GL account)
      const plansRes = await fetch('/api/services/plans');
      const plansJson = await plansRes.json().catch(() => ({}));
      if (!plansRes.ok) {
        throw new Error('Failed to load service plans');
      }
      const planRows: Array<{
        id: string;
        name: string;
        gl_account_id?: string | null;
        amount_type?: string | null;
        percent_basis?: string | null;
        is_active?: boolean | null;
        default_fee_amount?: number | null;
        default_fee_percent?: number | null;
        offering_ids?: string[];
      }> = Array.isArray(plansJson?.data)
        ? plansJson.data.map(
            (p: {
              id: string;
              name?: string;
              gl_account_id?: string | null;
              amount_type?: string | null;
              percent_basis?: string | null;
              is_active?: boolean | null;
              default_fee_amount?: number | null;
              default_fee_percent?: number | null;
              offering_ids?: unknown;
            }) => ({
              id: String(p.id),
              name: p.name || '',
              gl_account_id: p.gl_account_id ?? null,
              amount_type: p.amount_type ?? null,
              percent_basis: p.percent_basis ?? null,
              is_active: p.is_active ?? null,
              default_fee_amount: p.default_fee_amount ?? null,
              default_fee_percent: p.default_fee_percent ?? null,
              offering_ids: Array.isArray(p.offering_ids)
                ? p.offering_ids.map((id: any) => String(id))
                : undefined,
            }),
          )
        : [];
      setPlans(planRows);

      // Fetch GL accounts (fallback to settings query if endpoint missing)
      try {
        const glAccountsRes = await fetch('/api/gl-accounts');
        if (glAccountsRes.ok) {
          const glAccountsJson = await glAccountsRes.json().catch(() => ({}));
          if (Array.isArray(glAccountsJson?.data)) {
            const items = glAccountsJson.data.map(
              (a: { id?: string | number; name?: string }) => ({
                id: String(a.id),
                name: a.name || 'GL',
              }),
            );
            setGlAccounts(items);
          }
        } else {
          throw new Error('missing');
        }
      } catch {
        // fallback: try settings_gl_accounts to at least show AR/known mappings
        const settingsRes = await fetch('/api/settings/gl-accounts').catch(() => null);
        const settingsJson = await settingsRes?.json().catch(() => ({}));
        if (settingsRes?.ok && settingsJson) {
          const items: Array<{ id: string; name: string }> = [];
          const push = (id: string | number | null | undefined, name: string) => {
            if (id) items.push({ id: String(id), name });
          };
          push(settingsJson.ar_lease, 'AR Lease');
          push(settingsJson.management_fee_income, 'Management Fee Income');
          push(settingsJson.rent_income, 'Rent Income');
          setGlAccounts(items);
        }
      }
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
      setIsOfferingDialogOpen(false);
      setEditingOffering(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete service offering';
      toast.error(message);
    } finally {
      setDeletingOfferingId(null);
    }
  };

  const openNewOfferingDialog = () => {
    setEditingOffering(null);
    setIsOfferingDialogOpen(true);
  };

  const openEditOfferingDialog = (offering: ServiceOffering) => {
    setEditingOffering(offering);
    setIsOfferingDialogOpen(true);
  };

  const openNewPlanDialog = () => {
    setEditingPlanId(null);
    setIsALaCartePlan(false);
    setPlanForm({
      name: '',
      amount_type: DEFAULT_PLAN_AMOUNT_TYPE,
      percent_basis: DEFAULT_PLAN_PERCENT_BASIS,
      is_active: true,
      gl_account_id: GL_UNASSIGNED_VALUE,
      default_fee_amount: '',
      default_fee_percent: '',
    });
    setPlanAssignedOfferingIds(new Set());
    setSelectedAssignedOfferingIds(new Set());
    setSelectedUnassignedOfferingIds(new Set());
    setIsPlanDialogOpen(true);
  };

  const openEditPlanDialog = async (plan: {
    id: string;
    name: string;
    gl_account_id?: string | null;
    amount_type?: string | null;
    percent_basis?: string | null;
    is_active?: boolean | null;
    default_fee_amount?: number | null;
    default_fee_percent?: number | null;
    offering_ids?: string[];
  }) => {
    setEditingPlanId(plan.id);
    const nextIsALaCarte = (plan.name || '').trim() === 'A-la-carte';
    setIsALaCartePlan(nextIsALaCarte);
    setPlanForm({
      name: plan.name || '',
      amount_type: plan.amount_type || DEFAULT_PLAN_AMOUNT_TYPE,
      percent_basis: plan.percent_basis || DEFAULT_PLAN_PERCENT_BASIS,
      is_active: plan.is_active ?? true,
      gl_account_id: plan.gl_account_id ?? GL_UNASSIGNED_VALUE,
      default_fee_amount: plan.default_fee_amount != null ? String(plan.default_fee_amount) : '',
      default_fee_percent: plan.default_fee_percent != null ? String(plan.default_fee_percent) : '',
    });
    const initialOfferingIds = Array.isArray(plan.offering_ids) ? plan.offering_ids : null;
    setPlanAssignedOfferingIds(new Set(initialOfferingIds ?? []));
    setSelectedAssignedOfferingIds(new Set());
    setSelectedUnassignedOfferingIds(new Set());
    setIsPlanDialogOpen(true);

    if (initialOfferingIds != null) {
      setLoadingPlanDetails(false);
      return;
    }

    setLoadingPlanDetails(true);
    try {
      const res = await fetch(`/api/services/plans?id=${encodeURIComponent(plan.id)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to load plan details');
      }
      const planData = json?.data;
      if (planData) {
        const isAlacarte = String(planData.name || '').trim() === 'A-la-carte';
        setIsALaCartePlan(isAlacarte);
        setPlanForm((prev) => ({
          ...prev,
          name: String(planData.name || ''),
          amount_type: String(planData.amount_type || DEFAULT_PLAN_AMOUNT_TYPE),
          percent_basis: planData.percent_basis ? String(planData.percent_basis) : DEFAULT_PLAN_PERCENT_BASIS,
          is_active: planData.is_active ?? true,
          gl_account_id: planData.gl_account_id ?? GL_UNASSIGNED_VALUE,
          default_fee_amount:
            planData.default_fee_amount != null ? String(planData.default_fee_amount) : '',
          default_fee_percent:
            planData.default_fee_percent != null ? String(planData.default_fee_percent) : '',
        }));
      }
      const offeringIds = Array.isArray(json?.offering_ids) ? json.offering_ids : [];
      setPlanAssignedOfferingIds(new Set(offeringIds.map((id: any) => String(id))));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load plan details';
      toast.error(message);
    } finally {
      setLoadingPlanDetails(false);
    }
  };

  const toggleSetValue = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const assignSelectedOfferings = () => {
    if (!selectedUnassignedOfferingIds.size) return;
    setPlanAssignedOfferingIds((prev) => {
      const next = new Set(prev);
      selectedUnassignedOfferingIds.forEach((id) => next.add(id));
      return next;
    });
    setSelectedUnassignedOfferingIds(new Set());
  };

  const unassignSelectedOfferings = () => {
    if (!selectedAssignedOfferingIds.size) return;
    setPlanAssignedOfferingIds((prev) => {
      const next = new Set(prev);
      selectedAssignedOfferingIds.forEach((id) => next.delete(id));
      return next;
    });
    setSelectedAssignedOfferingIds(new Set());
  };

  const handleSavePlan = async () => {
    const name = planForm.name.trim();
    if (!name) {
      toast.error('Plan name is required');
      return;
    }

    const savingAlacarte = name === 'A-la-carte' || isALaCartePlan;
    if (!savingAlacarte) {
      if (planForm.amount_type === 'flat' && !planForm.default_fee_amount.trim()) {
        toast.error('Flat amount is required');
        return;
      }
      if (planForm.amount_type === 'percent') {
        if (!planForm.percent_basis) {
          toast.error('Percent basis is required');
          return;
        }
        if (!planForm.default_fee_percent.trim()) {
          toast.error('Percent value is required');
          return;
        }
      }
    }

    const payload = {
      id: editingPlanId ?? undefined,
      name,
      amount_type: savingAlacarte ? 'flat' : planForm.amount_type,
      percent_basis: savingAlacarte
        ? null
        : planForm.amount_type === 'percent'
          ? planForm.percent_basis
          : null,
      is_active: planForm.is_active,
      gl_account_id: savingAlacarte
        ? null
        : planForm.gl_account_id === GL_UNASSIGNED_VALUE
          ? null
          : planForm.gl_account_id,
      default_fee_amount: savingAlacarte
        ? null
        : planForm.amount_type === 'flat'
          ? planForm.default_fee_amount
          : '',
      default_fee_percent: savingAlacarte
        ? null
        : planForm.amount_type === 'percent'
          ? planForm.default_fee_percent
          : '',
      offering_ids: savingAlacarte ? [] : Array.from(planAssignedOfferingIds),
    };

    setSavingPlan(true);
    try {
      const res = await fetch('/api/services/plans', {
        method: editingPlanId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to save plan');
      }
      toast.success(editingPlanId ? 'Plan updated' : 'Plan created');
      setIsPlanDialogOpen(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save plan';
      toast.error(message);
    } finally {
      setSavingPlan(false);
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

  const offeringColumnClasses = {
    name: 'w-[45%]',
    defaultRate: 'w-[20%]',
    status: 'w-[15%]',
    actions: 'w-[20%]',
  };

  const renderStatusPill = (isActive: boolean) => {
    const className = isActive
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';
    return (
      <Badge variant="outline" className={`${className} text-xs`}>
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  const formatPercentValue = (value: number) =>
    `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)}%`;

  const renderDefaultRate = (offering: ServiceOffering) => {
    if (offering.default_rate == null) return '—';
    if (offering.fee_type === 'Percentage') {
      return formatPercentValue(offering.default_rate);
    }
    return formatCurrency(offering.default_rate);
  };

  const activeOfferings = offerings.filter((o) => o.is_active);
  const unassignedOfferings = activeOfferings
    .filter((o) => !planAssignedOfferingIds.has(o.id))
    .sort(
      (a, b) =>
        (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name),
    );
  const assignedOfferings = activeOfferings
    .filter((o) => planAssignedOfferingIds.has(o.id))
    .sort(
      (a, b) =>
        (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name),
    );

  const toggleOfferingStatus = async (offering: ServiceOffering) => {
    const nextStatus = !offering.is_active;
    setTogglingStatusId(offering.id);
    try {
      const response = await fetch(`/api/services/catalog/${offering.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error?.message || result?.error || 'Failed to update status');
      }
      setOfferings((prev) =>
        prev.map((o) => (o.id === offering.id ? { ...o, is_active: nextStatus } : o)),
      );
      toast.success(`Service marked as ${nextStatus ? 'Active' : 'Inactive'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(message);
    } finally {
      setTogglingStatusId(null);
    }
  };

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
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value === 'automation' ? 'automation' : value === 'plans' ? 'plans' : 'offerings')
        }
      >
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="offerings" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Service Offerings
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Plans &amp; GL
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
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className={offeringColumnClasses.name}>Name</TableHead>
                            <TableHead className={offeringColumnClasses.defaultRate}>
                              Default Rate
                            </TableHead>
                            <TableHead className={offeringColumnClasses.status}>Status</TableHead>
                            <TableHead className={`${offeringColumnClasses.actions} text-right`}>
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryOfferings.map((offering) => (
                            <TableRow key={offering.id}>
                              <TableCell className={`font-medium ${offeringColumnClasses.name}`}>
                                {offering.name}
                              </TableCell>
                            <TableCell className={offeringColumnClasses.defaultRate}>
                              {renderDefaultRate(offering)}
                            </TableCell>
                            <TableCell className={offeringColumnClasses.status}>
                                <div className="flex items-center justify-start gap-3">
                                  {renderStatusPill(offering.is_active)}
                                  <Switch
                                    checked={offering.is_active}
                                    onCheckedChange={() => toggleOfferingStatus(offering)}
                                    disabled={togglingStatusId === offering.id}
                                    aria-label={`Set ${offering.name} ${
                                      offering.is_active ? 'inactive' : 'active'
                                    }`}
                                  />
                                </div>
                            </TableCell>
                            <TableCell
                              className={`${offeringColumnClasses.actions} text-right`}
                            >
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditOfferingDialog(offering)}
                                  >
                                    <Edit className="mr-1 h-4 w-4" />
                                    Edit
                                  </Button>
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
                  <CardTitle>Service Plans</CardTitle>
                  <CardDescription>Create and edit your service plans.</CardDescription>
                </div>
                <Button onClick={openNewPlanDialog}>Add Plan</Button>
              </div>
            </CardHeader>
            <CardContent>
              {plans.length === 0 ? (
                <p className="text-muted-foreground text-sm">No plans available.</p>
              ) : (
                <div className="border-border overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{plan.name}</span>
                              {plan.is_active === false ? (
                                <Badge variant="outline" className="text-xs">
                                  Inactive
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditPlanDialog(plan)}
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
            onDelete={editingOffering ? handleDeleteOffering : undefined}
            deletingOfferingId={deletingOfferingId}
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
          if (!open) {
            setEditingPlanId(null);
            setIsALaCartePlan(false);
            setSelectedAssignedOfferingIds(new Set());
            setSelectedUnassignedOfferingIds(new Set());
          }
        }}
      >
        <DialogContent className="w-[980px] max-w-[980px]">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? 'Edit Service Plan' : 'Add Service Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlanId
                ? 'Update plan details and assigned services.'
                : 'Create a new service plan and assign services.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan Name</Label>
                <Input
                  id="plan-name"
                  value={planForm.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPlanForm((prev) => ({ ...prev, name: value }));
                    setIsALaCartePlan(value.trim() === 'A-la-carte');
                  }}
                  placeholder="e.g. Full"
                  disabled={Boolean(editingPlanId) && isALaCartePlan}
                />
              </div>

              {isALaCartePlan ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  A-la-carte plans have no plan-level fee and no pre-assigned services. Services are
                  selected and priced per property/unit.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Amount Type</Label>
                      <Select
                        value={planForm.amount_type}
                        onValueChange={(value) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            amount_type: value,
                            percent_basis:
                              value === 'percent'
                                ? prev.percent_basis || DEFAULT_PLAN_PERCENT_BASIS
                                : prev.percent_basis,
                            default_fee_amount: value === 'flat' ? prev.default_fee_amount : '',
                            default_fee_percent: value === 'percent' ? prev.default_fee_percent : '',
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat</SelectItem>
                          <SelectItem value="percent">Percent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {planForm.amount_type === 'flat' ? (
                      <div className="space-y-2">
                        <Label>Flat Amount</Label>
                        <Input
                          inputMode="decimal"
                          value={planForm.default_fee_amount}
                          onChange={(e) =>
                            setPlanForm((prev) => ({ ...prev, default_fee_amount: e.target.value }))
                          }
                          placeholder="e.g. 100.00"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Percent Basis</Label>
                        <Select
                          value={planForm.percent_basis}
                          onValueChange={(value) =>
                            setPlanForm((prev) => ({ ...prev, percent_basis: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lease_rent_amount">Lease rent amount</SelectItem>
                            <SelectItem value="collected_rent">Collected rent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {planForm.amount_type === 'percent' ? (
                    <div className="space-y-2">
                      <Label>Percent</Label>
                      <Input
                        inputMode="decimal"
                        value={planForm.default_fee_percent}
                        onChange={(e) =>
                          setPlanForm((prev) => ({ ...prev, default_fee_percent: e.target.value }))
                        }
                        placeholder="e.g. 8.5"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>GL Account</Label>
                    <Select
                      value={planForm.gl_account_id}
                      onValueChange={(value) =>
                        setPlanForm((prev) => ({ ...prev, gl_account_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select GL account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={GL_UNASSIGNED_VALUE}>Unassigned</SelectItem>
                        {glAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-muted-foreground text-xs">
                    Inactive plans may be hidden in some views.
                  </p>
                </div>
                <Switch
                  checked={planForm.is_active}
                  onCheckedChange={(checked) =>
                    setPlanForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
            </div>

            {isALaCartePlan ? null : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Assign Services</p>
                  <p className="text-muted-foreground text-xs">
                    Move offerings between Unassigned and Assigned.
                  </p>
                </div>

                {loadingPlanDetails ? (
                  <div className="text-muted-foreground rounded-lg border px-3 py-2 text-sm">
                    Loading assigned services…
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                  <div className="overflow-hidden rounded-lg border">
                    <div className="bg-muted/30 flex items-center justify-between px-3 py-2">
                      <span className="text-xs font-semibold tracking-wide uppercase">
                        Unassigned
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {unassignedOfferings.length}
                      </span>
                    </div>
                    <div className="max-h-[340px] overflow-auto">
                      <Table>
                        <TableBody>
                          {unassignedOfferings.map((o) => {
                            const selected = selectedUnassignedOfferingIds.has(o.id);
                            return (
                              <TableRow
                                key={o.id}
                                className={`cursor-pointer ${
                                  selected ? 'bg-primary/10 hover:bg-primary/10' : ''
                                }`}
                                onClick={() =>
                                  setSelectedUnassignedOfferingIds((prev) =>
                                    toggleSetValue(prev, o.id),
                                  )
                                }
                                role="button"
                                tabIndex={0}
                              >
                                <TableCell className="font-medium">{o.name}</TableCell>
                              </TableRow>
                            );
                          })}
                          {unassignedOfferings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={1} className="text-muted-foreground text-sm">
                                No unassigned services.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={assignSelectedOfferings}
                      disabled={!selectedUnassignedOfferingIds.size || loadingPlanDetails}
                      aria-label="Assign selected services"
                    >
                      &gt;
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={unassignSelectedOfferings}
                      disabled={!selectedAssignedOfferingIds.size || loadingPlanDetails}
                      aria-label="Unassign selected services"
                    >
                      &lt;
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-lg border">
                    <div className="bg-muted/30 flex items-center justify-between px-3 py-2">
                      <span className="text-xs font-semibold tracking-wide uppercase">
                        Assigned
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {assignedOfferings.length}
                      </span>
                    </div>
                    <div className="max-h-[340px] overflow-auto">
                      <Table>
                        <TableBody>
                          {assignedOfferings.map((o) => {
                            const selected = selectedAssignedOfferingIds.has(o.id);
                            return (
                              <TableRow
                                key={o.id}
                                className={`cursor-pointer ${
                                  selected ? 'bg-primary/10 hover:bg-primary/10' : ''
                                }`}
                                onClick={() =>
                                  setSelectedAssignedOfferingIds((prev) =>
                                    toggleSetValue(prev, o.id),
                                  )
                                }
                                role="button"
                                tabIndex={0}
                              >
                                <TableCell className="font-medium">{o.name}</TableCell>
                              </TableRow>
                            );
                          })}
                          {assignedOfferings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={1} className="text-muted-foreground text-sm">
                                No assigned services.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPlanDialogOpen(false)}
                    disabled={savingPlan}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSavePlan} disabled={savingPlan || loadingPlanDetails}>
                    {savingPlan ? 'Saving…' : editingPlanId ? 'Save Changes' : 'Create Plan'}
                  </Button>
                </div>
              </div>
            )}

            {isALaCartePlan ? (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPlanDialogOpen(false)}
                  disabled={savingPlan}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSavePlan} disabled={savingPlan || loadingPlanDetails}>
                  {savingPlan ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ServiceOfferingFormProps {
  offering: ServiceOffering | null;
  onSave: (payload: Partial<ServiceOffering>) => Promise<void>;
  onDelete?: (offering: ServiceOffering) => Promise<void>;
  deletingOfferingId?: string | null;
  onCancel: () => void;
}

function ServiceOfferingForm({
  offering,
  onSave,
  onDelete,
  deletingOfferingId,
  onCancel,
}: ServiceOfferingFormProps) {
  const [name, setName] = useState(offering?.name ?? '');
  const [category, setCategory] = useState(offering?.category ?? 'Financial Management');
  const [feeType, setFeeType] = useState<FeeType>(offering?.fee_type ?? 'Flat Rate');
  const [rate, setRate] = useState(
    offering?.default_rate != null ? String(offering.default_rate) : '',
  );
  const [description, setDescription] = useState(offering?.description ?? '');
  const [isActive, setIsActive] = useState(offering?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const defaultFreq = offering?.default_freq ?? 'monthly';
  const isDeleting = offering?.id != null && deletingOfferingId === offering.id;

  useEffect(() => {
    setName(offering?.name ?? '');
    setCategory(offering?.category ?? 'Financial Management');
    setFeeType(offering?.fee_type ?? 'Flat Rate');
    setRate(offering?.default_rate != null ? String(offering.default_rate) : '');
    setDescription(offering?.description ?? '');
    setIsActive(offering?.is_active ?? true);
    setFormError(null);
  }, [offering]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }

    if (rate === '' || Number.isNaN(Number(rate))) {
      setFormError('Rate is required.');
      return;
    }

    const payload: Partial<ServiceOffering> = {
      id: offering?.id,
      name: name.trim(),
      category,
      description: description.trim() || null,
      default_rate: Number(rate),
      default_freq: defaultFreq,
      fee_type: feeType,
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
      <div className="space-y-4">
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
          <Label htmlFor="fee-type">Fee Type</Label>
          <Select
            value={feeType}
            onValueChange={(val) => {
              setFeeType(val as FeeType);
              setRate('');
            }}
          >
            <SelectTrigger id="fee-type">
              <SelectValue placeholder="Select fee type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Flat Rate">Flat Rate</SelectItem>
              <SelectItem value="Percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate">Rate</Label>
          <div className="relative">
            {feeType === 'Flat Rate' ? (
              <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                $
              </span>
            ) : null}
            <Input
              id="rate"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={feeType === 'Percentage' ? 'e.g., 10 for 10%' : 'e.g., 100.00'}
              className={feeType === 'Flat Rate' ? 'pl-7' : 'pr-10'}
            />
            {feeType === 'Percentage' ? (
              <span className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                %
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            {feeType === 'Percentage'
              ? 'Saved as a percentage (e.g., 10 = 10%).'
              : 'Saved as a flat dollar amount.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the service and how it is billed."
          />
        </div>
      </div>

      {formError ? (
        <p className="text-destructive text-sm font-medium" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {offering && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(offering)}
            disabled={isDeleting || saving}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

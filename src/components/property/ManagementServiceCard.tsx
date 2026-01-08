'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type ManagementServiceConfig = {
  service_plan: string | null;
  active_services: string[];
  bill_administration: string | null;
  source: 'property' | 'unit';
  fee_amount: number | null;
  fee_percent: number | null;
  billing_frequency: string | null;
};

type PlanOption = { id: string; name: string; offering_ids?: string[] };
type ServiceOption = { id: string; name: string; is_active: boolean; category?: string | null };

function isAlaCarte(planName: string | null | undefined) {
  return (
    String(planName || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '') === 'alacarte'
  );
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export default function ManagementServiceCard({
  propertyId,
  unitId,
  title = 'Management Services',
  subtitle,
  readOnly = false,
  onUpdated,
}: {
  propertyId: string;
  unitId?: string | null;
  title?: string;
  subtitle?: string;
  readOnly?: boolean;
  onUpdated?: (config: ManagementServiceConfig) => void;
}) {
  const [config, setConfig] = useState<ManagementServiceConfig | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [billNotes, setBillNotes] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feePercent, setFeePercent] = useState('');
  const [feeFrequency, setFeeFrequency] = useState('monthly');

  const alaCarte = useMemo(() => isAlaCarte(planName), [planName]);

  const normalizePlanKey = useCallback(
    (name: string | null | undefined) =>
      String(name || '')
        .trim()
        .toLowerCase(),
    [],
  );

  const plansByName = useMemo(() => {
    const map = new Map<string, PlanOption>();
    plans.forEach((p) => map.set(normalizePlanKey(p.name), p));
    return map;
  }, [plans, normalizePlanKey]);

  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((svc) => map.set(svc.id, svc.name));
    return map;
  }, [services]);

  const applyPlanDefaults = useCallback(
    (nextPlanName: string, preserveWhenNoDefaults = false) => {
      const plan = plansByName.get(normalizePlanKey(nextPlanName));
      const offeringIds = plan?.offering_ids || [];
      const defaults = offeringIds
        .map((id) => serviceNameById.get(id))
        .filter((name): name is string => Boolean(name));
      if (defaults.length) {
        setSelectedServices(new Set(defaults));
      } else if (!preserveWhenNoDefaults) {
        setSelectedServices(new Set());
      }
    },
    [plansByName, serviceNameById, normalizePlanKey],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ propertyId });
      if (unitId) params.set('unitId', unitId);
      const [configRes, plansRes, servicesRes] = await Promise.all([
        fetch(`/api/management-service/config?${params.toString()}`),
        fetch('/api/services/plans'),
        fetch('/api/services/catalog'),
      ]);

      const cfgJson = await configRes.json().catch(() => ({}));
      const plansJson = await plansRes.json().catch(() => ({}));
      const servicesJson = await servicesRes.json().catch(() => ({}));
      if (!configRes.ok) {
        throw new Error(cfgJson?.error?.message || cfgJson?.error || 'Failed to load configuration');
      }
      const cfg = (cfgJson?.data || {}) as ManagementServiceConfig;
      setConfig(cfg);
      setPlanName(cfg.service_plan || '');
      const plansRows: PlanOption[] = plansJson?.data
        ? (plansJson.data as any[]).map((p: any) => ({
            id: String(p.id),
            name: String(p.name || ''),
            offering_ids: Array.isArray(p.offering_ids)
              ? p.offering_ids.map((id: any) => String(id)).filter(Boolean)
              : [],
          }))
        : [];
      const serviceRows: ServiceOption[] = servicesJson?.data
        ? servicesJson.data.map((row: any) => ({
            id: String(row.id),
            name: String(row.name || ''),
            category: row.category || '',
            is_active: row.is_active === undefined ? true : Boolean(row.is_active),
          }))
        : [];
      const nameById = new Map<string, string>();
      serviceRows.forEach((s) => nameById.set(s.id, s.name));
      const configServices = new Set(
        Array.isArray(cfg.active_services) ? cfg.active_services : [],
      );
      if (!configServices.size && cfg.service_plan) {
        const plan = plansRows.find(
          (p) => normalizePlanKey(p.name) === normalizePlanKey(cfg.service_plan),
        );
        if (plan?.offering_ids?.length) {
          plan.offering_ids.forEach((id) => {
            const name = nameById.get(id);
            if (name) configServices.add(name);
          });
        }
      }
      setSelectedServices(configServices);
      setBillNotes(cfg.bill_administration || '');
      setFeeAmount(cfg.fee_amount != null ? String(cfg.fee_amount) : '');
      setFeePercent(cfg.fee_percent != null ? String(cfg.fee_percent) : '');
      setFeeFrequency((cfg.billing_frequency || 'monthly').toLowerCase());

      setPlans(plansRows.filter((p) => p.name));
      setServices(serviceRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load management services';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [normalizePlanKey, propertyId, unitId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleService = (name: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handlePlanChange = (value: string) => {
    setPlanName(value);
    applyPlanDefaults(value);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const params = new URLSearchParams({ propertyId });
      if (unitId) params.set('unitId', unitId);
      const body = {
        service_plan: planName,
        active_services: Array.from(selectedServices),
        bill_administration: billNotes,
        plan_fee_amount: parseNumber(feeAmount),
        plan_fee_percent: parseNumber(feePercent),
        plan_fee_frequency: feeFrequency || null,
      };

      const res = await fetch(`/api/management-service/config?${params.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to save configuration');
      }
      const updated = json?.data as ManagementServiceConfig;
      setConfig(updated);
      setPlanName(updated.service_plan || '');
      setSelectedServices(
        new Set(Array.isArray(updated.active_services) ? updated.active_services : []),
      );
      setBillNotes(updated.bill_administration || '');
      setFeeAmount(updated.fee_amount != null ? String(updated.fee_amount) : '');
      setFeePercent(updated.fee_percent != null ? String(updated.fee_percent) : '');
      setFeeFrequency((updated.billing_frequency || 'monthly').toLowerCase());
      onUpdated?.(updated);
      toast.success('Management services updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const sortedServices = useMemo(() => {
    return services
      .filter((s) => s.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

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

  const feeSummary = useMemo(() => {
    const parts: string[] = [];
    if (feeAmount && parseNumber(feeAmount)) parts.push(`$${parseNumber(feeAmount)}`);
    if (feePercent && parseNumber(feePercent)) parts.push(`${parseNumber(feePercent)}%`);
    if (feeFrequency) parts.push(frequencyLabel(feeFrequency));
    return parts.length ? parts.join(' • ') : 'Not set';
  }, [feeAmount, feePercent, feeFrequency]);

  const readOnlyContent = (
    <div className="space-y-3">
      <div>
        <p className="text-muted-foreground text-sm">Service Plan</p>
        <p className="text-foreground text-base font-medium">{config?.service_plan || '—'}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Active Services</p>
        {config?.active_services?.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {config.active_services.map((svc) => (
              <Badge key={svc} variant="secondary">
                {svc}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">None</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-sm">Fee Amount</p>
          <p className="text-foreground text-base font-medium">
            {config?.fee_amount != null ? `$${config.fee_amount}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Fee Percent</p>
          <p className="text-foreground text-base font-medium">
            {config?.fee_percent != null ? `${config.fee_percent}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Billing Frequency</p>
          <p className="text-foreground text-base font-medium">
            {frequencyLabel(config?.billing_frequency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Billing Notes</p>
          <p className="text-foreground text-base font-medium">
            {config?.bill_administration || '—'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{subtitle || 'Configure plan, services, and billing notes.'}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
        {error ? (
          <p className="text-destructive text-sm font-medium">{error}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading management services…</p>
        ) : !config ? (
          <p className="text-destructive text-sm">Unable to load configuration.</p>
        ) : readOnly ? (
          readOnlyContent
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Service Plan</Label>
                <Select value={planName} onValueChange={handlePlanChange}>
                  <SelectTrigger aria-label="Service Plan">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.name}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing Frequency</Label>
                <Select value={feeFrequency} onValueChange={setFeeFrequency}>
                  <SelectTrigger aria-label="Billing Frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="per_job">Per job</SelectItem>
                    <SelectItem value="per_event">Per event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fee Amount ($)</Label>
                <Input
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="e.g., 150"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label>Fee Percent (%)</Label>
                <Input
                  value={feePercent}
                  onChange={(e) => setFeePercent(e.target.value)}
                  placeholder="e.g., 3"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="rounded-md border border-dashed p-3">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Fee Summary
              </p>
              <p className="text-foreground text-sm font-medium">{feeSummary}</p>
            </div>

              <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Active Services {alaCarte ? '(A-la-carte)' : ''}</Label>
                <span className="text-muted-foreground text-xs">
                  {alaCarte
                    ? 'Select services for this plan.'
                    : 'Plan services are pre-selected; uncheck to override.'}
                </span>
              </div>
              {alaCarte && selectedServices.size === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Select at least one service to include for this A-la-carte plan.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {sortedServices.map((svc) => (
                  <label key={svc.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedServices.has(svc.name)}
                      onCheckedChange={() => toggleService(svc.name)}
                    />
                    <span>{svc.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Billing Notes</Label>
              <Textarea
                value={billNotes}
                onChange={(e) => setBillNotes(e.target.value)}
                placeholder="Optional billing administration notes"
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !planName.trim()}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* eslint-disable @typescript-eslint/ban-ts-comment */

'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ComplianceSummaryHeader } from '@/components/compliance/ComplianceSummaryHeader';
import { ComplianceAgencyCards } from '@/components/compliance/ComplianceAgencyCards';
import { ComplianceChecklistTable } from '@/components/compliance/ComplianceChecklistTable';
import { ViolationsList } from '@/components/compliance/ViolationsList';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  LargeDialogContent,
} from '@/components/ui/dialog';
import { PageBody, Stack } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Loader2, RefreshCw, XCircle, Circle } from 'lucide-react';
import type {
  ComplianceItemWithRelations,
  ComplianceViolationWithRelations,
  ComplianceAsset,
  ComplianceProgram,
} from '@/types/compliance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ComplianceDevicesTable } from '@/components/compliance/ComplianceDevicesTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PropertyProgramsManager } from '@/components/compliance/PropertyProgramsManager';

interface PropertyComplianceData {
  property: {
    id: string;
    name: string;
    address_line1: string;
    borough: string | null;
    bin: string | null;
    building_id?: string | null;
    total_units?: number | null;
  };
  building?: {
    id: string;
    occupancy_group: string | null;
    occupancy_description: string | null;
    is_one_two_family: boolean | null;
    is_private_residence_building: boolean | null;
    residential_units: number | null;
    hpd_registration?: Record<string, unknown> | null;
  } | null;
  items: ComplianceItemWithRelations[];
  violations: ComplianceViolationWithRelations[];
  filings: Array<{
    id: string;
    source: string;
    dataset_id: string;
    job_filing_number: string;
    work_permit?: string | null;
    sequence_number?: string | null;
    work_type?: string | null;
    permit_status?: string | null;
    job_description?: string | null;
    approved_date?: string | null;
    issued_date?: string | null;
    bin?: string | null;
    block?: string | null;
    lot?: string | null;
    bbl?: string | null;
    house_no?: string | null;
    street_name?: string | null;
    borough?: string | null;
    metadata: Record<string, unknown>;
  }>;
  assets: (ComplianceAsset & {
    device_category?: string | null;
    device_technology?: string | null;
    device_subtype?: string | null;
    is_private_residence?: boolean | null;
    next_due?: string | null;
    last_inspection_at?: string | null;
  })[];
  programs: Array<ComplianceProgram>;
  events: Array<{
    id: string;
    asset_id?: string | null;
    item_id?: string | null;
    inspection_date: string | null;
    filed_date: string | null;
    event_type: string;
    inspection_type: string | null;
    compliance_status: string | null;
    external_tracking_number?: string | null;
    created_at: string;
  }>;
  kpis?: {
    devices: number;
    open_violations: number;
    next_due: string | null;
    last_sync: string | null;
    status_chip: 'on_track' | 'at_risk' | 'non_compliant';
  };
  agencies?: {
    hpd: {
      registration_id: string | null;
      building_id: string | null;
      violations: number;
      complaints: number;
      last_event_date: string | null;
    };
    fdny: { open_violations: number; last_event_date: string | null };
    dep: { open_violations: number; last_event_date: string | null };
  };
  timeline?: Array<{
    type: 'event' | 'violation';
    date: string;
    title: string | null;
    status?: string | null;
    agency?: string | null;
  }>;
  summary: {
    open_violations: number;
    overdue_items: number;
    items_due_next_30_days: number;
  };
}

function HPDRegistrationCard({
  registration,
}: {
  registration: Record<string, unknown> | null | undefined;
}) {
  return null;
}

type PropertyCompliancePageProps = {
  propertyIdOverride?: string;
};

export default function PropertyCompliancePage({ propertyIdOverride }: PropertyCompliancePageProps = {}) {
  const params = useParams();
  const propertyId = (propertyIdOverride || (params.id as string)) ?? '';
  const wrapWithPageBody = !propertyIdOverride;
  const wrap = (node: ReactNode) => (wrapWithPageBody ? <PageBody>{node}</PageBody> : <>{node}</>);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PropertyComplianceData | null>(null);
  const [programsDialogOpen, setProgramsDialogOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [hpdFilingsOpen, setHpdFilingsOpen] = useState(false);
  const [filingsOpen, setFilingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'checklist' | 'violations' | 'filings'>('checklist');
  const [violationAssetFilter, setViolationAssetFilter] = useState<string | null>(null);
  const [violationFilterLabel, setViolationFilterLabel] = useState<string | null>(null);
  const [violationStatusFilter, setViolationStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedFiling, setSelectedFiling] = useState<PropertyComplianceData['filings'][number] | null>(null);
  const [selectedViolation, setSelectedViolation] =
    useState<ComplianceViolationWithRelations | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncingFilings, setSyncingFilings] = useState(false);
  type StepStatus = 'pending' | 'running' | 'success' | 'error';
  const baseFilingSteps = [
    { id: 'dob_now_build_approved_permits', label: 'DOB NOW: Approved Permits' },
    { id: 'dob_permit_issuance_old', label: 'DOB Permit Issuance (BIS)' },
    { id: 'dob_job_applications', label: 'DOB Job Applications (BIS)' },
    { id: 'dob_elevator_permit_applications', label: 'DOB NOW: Elevator Permit Applications' },
    { id: 'dep_water_sewer_permits', label: 'DEP Water & Sewer' },
    { id: 'dep_water_sewer_permits_old', label: 'DEP Water & Sewer (OLD)' },
    { id: 'hpd_registrations', label: 'HPD Registrations' },
    { id: 'dob_now_safety_facade', label: 'DOB NOW: Safety – Facade Filings' },
  ] as const;
  type FilingStep = {
    id: (typeof baseFilingSteps)[number]['id'];
    label: string;
    status: StepStatus;
    count: number;
    error: string | null;
  };
  const [filingSteps, setFilingSteps] = useState<FilingStep[]>(
    baseFilingSteps.map((step) => ({
      ...step,
      status: 'pending',
      count: 0,
      error: null,
    })),
  );
  const baseViolationSteps = [
    { id: 'dob_safety_violations', label: 'DOB Safety Violations' },
    { id: 'dob_violations', label: 'DOB Violations (Legacy)' },
    { id: 'dob_active_violations', label: 'DOB Active Violations' },
    { id: 'dob_ecb_violations', label: 'DOB ECB Violations' },
    { id: 'hpd_violations', label: 'HPD Violations' },
    { id: 'hpd_complaints', label: 'HPD Complaints' },
    { id: 'fdny_violations', label: 'FDNY Violations' },
    { id: 'asbestos_violations', label: 'Asbestos Violations' },
    { id: 'backflow_prevention_violations', label: 'Backflow Prevention Violations' },
    { id: 'sidewalk_violations', label: 'Sidewalk Violations' },
    { id: 'indoor_environmental_complaints', label: 'DOHMH Indoor Environmental Complaints' },
  ] as const;
  type ViolationStep = {
    id: (typeof baseViolationSteps)[number]['id'];
    label: string;
    status: StepStatus;
    count: number;
    error: string | null;
  };
  const [violationSteps, setViolationSteps] = useState<ViolationStep[]>(
    baseViolationSteps.map((step) => ({
      ...step,
      status: 'pending',
      count: 0,
      error: null,
    })),
  );
  const [violationSyncModalOpen, setViolationSyncModalOpen] = useState(false);
  const [syncingViolations, setSyncingViolations] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/compliance/properties/${propertyId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch compliance data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch property compliance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) {
      fetchData();
    }
  }, [propertyId]);

  const handleViewItem = (itemId: string) => {
    // TODO: Open compliance item detail modal
    console.log('View item:', itemId);
  };

  const handleViewViolationsForDevice = (payload: { assetId: string; label: string }) => {
    setViolationAssetFilter(payload.assetId);
    setViolationFilterLabel(payload.label);
    setActiveTab('violations');
  };

  useEffect(() => {
    setFilingSteps(
      baseFilingSteps.map((step) => ({
        ...step,
        status: 'pending' as const,
        count: 0,
        error: null,
      })),
    );
    setViolationSteps(
      baseViolationSteps.map((step) => ({
        ...step,
        status: 'pending' as const,
        count: 0,
        error: null,
      })),
    );
    setSelectedViolation(null);
  }, [propertyId]);

  const updateFilingStep = (
    id: (typeof baseFilingSteps)[number]['id'],
    patch: Partial<{ status: StepStatus; count: number; error: string | null }>,
  ) => {
    setFilingSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    );
  };

  const updateViolationStep = (
    id: (typeof baseViolationSteps)[number]['id'],
    patch: Partial<{ status: StepStatus; count: number; error: string | null }>,
  ) => {
    setViolationSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    );
  };

  const handleFilingsRefresh = async () => {
    if (!propertyId || syncingFilings) return;

    setSyncModalOpen(true);
    setSyncingFilings(true);
    setFilingSteps(
      baseFilingSteps.map((step) => ({
        ...step,
        status: 'pending' as const,
        count: 0,
        error: null,
      })),
    );

    for (const step of baseFilingSteps) {
      updateFilingStep(step.id, { status: 'running', error: null });
      try {
        const response = await fetch(
          `/api/compliance/properties/${propertyId}/filings/sync`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources: [step.id] }),
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          updateFilingStep(step.id, {
            status: 'error',
            error: errText || 'Request failed',
          });
          continue;
        }

        const result = await response.json();
        const stats = Array.isArray(result?.data) ? result.data[0] : null;
        const totalProcessed =
          (stats?.inserted || 0) + (stats?.updated || 0) + (stats?.skipped || 0);

        updateFilingStep(step.id, {
          status: stats?.errors?.length ? 'error' : 'success',
          count: totalProcessed,
          error: stats?.errors?.[0] || null,
        });
      } catch (error) {
        updateFilingStep(step.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    setSyncingFilings(false);
    await fetchData();
  };

  const handleViolationsRefresh = async () => {
    if (!propertyId || syncingViolations) return;
    setViolationSyncModalOpen(true);
    setSyncingViolations(true);
    setViolationSteps(
      baseViolationSteps.map((step) => ({
        ...step,
        status: 'pending' as const,
        count: 0,
        error: null,
      })),
    );

    for (const step of baseViolationSteps) {
      updateViolationStep(step.id, { status: 'running', error: null });
      try {
        const response = await fetch(
          `/api/compliance/properties/${propertyId}/violations/sync`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources: [step.id] }),
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          updateViolationStep(step.id, {
            status: 'error',
            error: errText || 'Request failed',
          });
          continue;
        }

        const result = await response.json();
        const stats = Array.isArray(result?.data) ? result.data[0] : null;
        updateViolationStep(step.id, {
          status: stats?.errors?.length ? 'error' : 'success',
          count: stats?.processed || 0,
          error: stats?.errors?.[0] || null,
        });
      } catch (error) {
        updateViolationStep(step.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    setSyncingViolations(false);
    await fetchData();
  };

  type PropertyProgram = PropertyComplianceData['programs'][number];

  const displayProgramName = (program: { code?: string | null; name?: string | null }) => {
    const code = program.code || '';
    if (code === 'NYC_ELV_CAT1') return 'Elevator (CAT1)';
    if (code === 'NYC_ELV_CAT5') return 'Elevator (CAT5)';
    return program.name || code || 'Program';
  };

  const formatProgramFrequency = (program: PropertyProgram) => {
    const months = program.frequency_months;
    if (months === 12) return 'Annual';
    if (months === 60) return 'Every 5 years';
    if (months <= 0) return 'Per defect / ad-hoc';
    if (months % 12 === 0) {
      const years = months / 12;
      return `Every ${years} year${years === 1 ? '' : 's'}`;
    }
    return `${months}-month cycle`;
  };

  const formatProgramDue = (program: PropertyProgram) => {
    if (program.code === 'NYC_ELV_PERIODIC') {
      return 'Inspect Jan 1–Dec 31; file within 14 days';
    }
    if (program.code === 'NYC_ELV_CAT1') {
      return 'Test Jan 1–Dec 31; file within 21 days';
    }
    if (program.code === 'NYC_ELV_CAT5') {
      return 'Within 5 years of last CAT5; file within 21 days';
    }
    return `Lead time ${program.lead_time_days} day(s) before period end`;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  };

  if (loading) {
    return wrap(
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>,
    );
  }

  if (error || !data) {
    return wrap(
      <div className="border-destructive bg-destructive/10 rounded-lg border p-4">
        <p className="text-destructive text-sm">Error: {error || 'Failed to load compliance data'}</p>
        <Button onClick={fetchData} variant="outline" size="sm" className="mt-2">
          Retry
        </Button>
      </div>,
    );
  }

  // Derived UI data
  const assetMap = new Map<string, ComplianceAsset>();
  data?.assets.forEach((a) => {
    if (a.id) assetMap.set(a.id, a);
  });

  const deriveDeviceStatus = (meta?: Record<string, any> | null) => {
    if (!meta) return undefined;
    const raw =
      (meta.device_status as string | null | undefined) ||
      (meta.status as string | null | undefined) ||
      (meta.report_status as string | null | undefined) ||
      (meta.compliance_status as string | null | undefined) ||
      (meta.current_status as string | null | undefined) ||
      (meta.filing_status as string | null | undefined);
    return raw ? String(raw) : undefined;
  };

  const devices = (data?.assets || []).map((a) => {
    const meta = (a as any)?.metadata as Record<string, any> | null;
    return {
      id: a.id,
      name: a.name || a.external_source_id || 'Device',
      external_source_id: a.external_source_id || null,
      asset_type: a.asset_type || (meta?.device_type as string | null) || 'Device',
      device_category:
        (a as any).device_category || (meta?.device_category as string | null) || null,
      device_technology:
        (a as any).device_technology || (meta?.device_technology as string | null) || null,
      device_subtype: (a as any).device_subtype || (meta?.device_subtype as string | null) || null,
      external_source: a.external_source || (meta?.external_source as string | null) || null,
      location_notes: (a as any).location_notes || null,
      metadata: meta,
      status: deriveDeviceStatus(meta),
      pressure_type: (a as any).pressure_type || (meta?.pressure_type as string | null) || null,
      last_inspection:
        ((a as any).last_inspection_at as string | null) ||
        (meta?.periodic_latest_inspection as string | null) ||
        null,
      next_due: ((a as any).next_due as string | null) || (meta?.next_due as string | null) || null,
      open_violations: (meta?.open_violations as number | null) ?? 0,
      upcoming_inspections: (a as any).upcoming_inspections ?? 0,
    };
  });

  const deviceCount = devices.length;

  const deviceById: Record<string, any> = {};
  devices.forEach((d) => {
    deviceById[d.id] = d;
  });

  const programMatchesAssetType = (programCode?: string | null, assetType?: string | null) => {
    if (!programCode || !assetType) return true;
    const t = assetType.toLowerCase();
    if (programCode.startsWith('NYC_ELV')) return t === 'elevator';
    if (programCode.startsWith('NYC_BOILER')) return t === 'boiler';
    if (programCode.startsWith('NYC_GAS')) return t === 'gas_piping';
    if (programCode.startsWith('NYC_SPRINKLER')) return t === 'sprinkler';
    if (programCode.startsWith('NYC_FACADE')) return t === 'facade';
    return true;
  };

  const toMillis = (value?: string | null) => {
    if (!value) return null;
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  };

  const chooseLatestDate = (current: string | null, candidate: string | null) => {
    const candidateTs = toMillis(candidate);
    if (candidateTs === null) return current;
    const currentTs = toMillis(current);
    if (currentTs === null || candidateTs > currentTs) {
      return candidate;
    }
    return current;
  };

  const eventsByItemId = new Map<string, PropertyComplianceData['events'][number]>();
  const getEventTimestamp = (event?: PropertyComplianceData['events'][number] | null) => {
    if (!event) return null;
    return (
      toMillis(event.inspection_date) ??
      toMillis(event.filed_date) ??
      toMillis(event.created_at)
    );
  };

  data?.events.forEach((event) => {
    if (!event.item_id) return;
    const ts = getEventTimestamp(event);
    if (ts === null) return;
    const existing = eventsByItemId.get(event.item_id);
    const existingTs = getEventTimestamp(existing);
    if (!existing || existingTs === null || ts > existingTs) {
      eventsByItemId.set(event.item_id, event);
    }
  });

  // Filter compliance items to only those whose asset is in the displayed devices list (or property-scoped items with no asset)
  const filteredItems = (data.items || []).filter((item) => {
    if (!item.asset_id) return true;
    const asset = assetMap.get(item.asset_id);
    if (!asset) return false;
    const assetType = (asset as any)?.asset_type || deviceById[item.asset_id]?.asset_type || null;
    if (!programMatchesAssetType(item.program?.code, assetType)) return false;
    return Boolean(deviceById[item.asset_id]);
  });

  // Deduplicate so each program appears only once per asset/property (keep the soonest due)
  const itemsForDisplay = Array.from(
    filteredItems
      .reduce((acc, item) => {
        const key = `${item.program_id}-${item.asset_id || 'property'}`;
        const existing = acc.get(key);
        if (!existing) {
          acc.set(key, item);
        } else {
          const existingDue = new Date(existing.due_date).getTime();
          const incomingDue = new Date(item.due_date).getTime();
          if (
            !Number.isNaN(incomingDue) &&
            (Number.isNaN(existingDue) || incomingDue < existingDue)
          ) {
            acc.set(key, item);
          }
        }
        return acc;
      }, new Map<string, (typeof filteredItems)[number]>())
      .values(),
  ).map((item) => {
    const device = item.asset_id ? deviceById[item.asset_id] : null;
    const meta = device?.metadata || {};
    const lastRegistrationDate = (data?.building as any)?.hpd_registration?.lastregistrationdate as
      | string
      | null;
    const asset = item.asset || (item.asset_id ? assetMap.get(item.asset_id) || null : null);
    const latestItemEvent = eventsByItemId.get(item.id);
    const latestItemEventDate =
      latestItemEvent?.inspection_date ||
      latestItemEvent?.filed_date ||
      latestItemEvent?.created_at ||
      null;

    const deviceIdentifier =
      device?.external_source_id ||
      (meta.device_number as string | null | undefined) ||
      (meta.device_id as string | null | undefined) ||
      (asset as any)?.external_source_id ||
      ((asset as any)?.metadata as Record<string, any> | null | undefined)?.device_number ||
      ((asset as any)?.metadata as Record<string, any> | null | undefined)?.device_id ||
      null;

    const typedAsset: ComplianceAsset | null | undefined = asset ?? null;
    const baseAssetName =
      typedAsset?.name ||
      (typedAsset as { asset_type?: string } | null | undefined)?.asset_type ||
      'Asset';
    const assetDisplayName =
      deviceIdentifier &&
      !baseAssetName.toLowerCase().includes(String(deviceIdentifier).toLowerCase())
        ? `${baseAssetName} ${deviceIdentifier}`
        : baseAssetName;
    const assetWithDisplayName = asset ? { ...asset, name: assetDisplayName } : asset;

    let lastEventDate: string | null = latestItemEventDate;
    if (item.program?.code === 'NYC_ELV_CAT1') {
      const cat1MetaDate =
        (meta.cat1_latest_report_filed as string | null | undefined) ||
        (meta.cat1_report_year ? String(meta.cat1_report_year) : null);
      lastEventDate = chooseLatestDate(lastEventDate, cat1MetaDate);
      lastEventDate = chooseLatestDate(lastEventDate, device?.last_inspection || null);
    } else if (item.program?.code === 'NYC_ELV_CAT5') {
      lastEventDate = chooseLatestDate(
        lastEventDate,
        (meta.cat5_latest_report_filed as string | null | undefined) || null,
      );
      lastEventDate = chooseLatestDate(lastEventDate, device?.last_inspection || null);
    } else if (item.program?.code === 'NYC_HPD_REGISTRATION') {
      lastEventDate = chooseLatestDate(lastEventDate, lastRegistrationDate || null);
    } else {
      lastEventDate = chooseLatestDate(lastEventDate, device?.last_inspection || null);
    }

    const programForDisplay: { code?: string | null; name?: string | null } =
      item.program ?? {
        code: item.program_id ?? null,
        name: null,
      };

    return {
      ...item,
      asset: assetWithDisplayName || undefined,
      programDisplayName: displayProgramName(programForDisplay),
      computedLastInspection: lastEventDate,
      computedLastEventType:
        item.program?.code === 'NYC_ELV_CAT1'
          ? 'CAT1'
          : item.program?.code === 'NYC_ELV_CAT5'
            ? 'CAT5'
            : item.program?.code === 'NYC_HPD_REGISTRATION'
              ? latestItemEvent?.inspection_type || 'Last Registration'
              : latestItemEvent?.inspection_type ||
                latestItemEvent?.event_type ||
                item.events?.[0]?.inspection_type ||
                item.events?.[0]?.event_type ||
                null,
    };
  });

  // Map events to update device last_inspection for summary table
  data?.events.forEach((e) => {
    if (e.asset_id && deviceById[e.asset_id] && e.inspection_date) {
      const existing = deviceById[e.asset_id].last_inspection;
      if (!existing || new Date(e.inspection_date) > new Date(existing)) {
        deviceById[e.asset_id].last_inspection = e.inspection_date;
      }
    }
  });

  const violationsPanel =
    data?.violations.map((v) => {
      const device = v.asset_id
        ? deviceById[v.asset_id]?.name || deviceById[v.asset_id]?.external_source_id
        : null;
      if (
        v.asset_id &&
        deviceById[v.asset_id] &&
        (v.status === 'open' || v.status === 'in_progress')
      ) {
        deviceById[v.asset_id].open_violations = (deviceById[v.asset_id].open_violations || 0) + 1;
      }
      return {
        id: v.id,
        violation_number: v.violation_number,
        agency: v.agency || 'DOB',
        device,
        issue_date: v.issue_date,
        status: v.status,
        description: v.description,
      };
    }) || [];

  const kpis = data?.kpis || {
    devices: deviceCount || 0,
    open_violations: data?.summary.open_violations || 0,
    next_due: null,
    last_sync: null,
    status_chip: 'on_track' as const,
  };

  return wrap(
    <>
      <Stack gap="lg">
        <Dialog open={programsDialogOpen} onOpenChange={setProgramsDialogOpen}>
          <ComplianceSummaryHeader
            propertyName={data.property.name}
            addressLine1={data.property.address_line1}
            jurisdiction="NYC – DOB / HPD / FDNY"
            status={kpis.status_chip}
            kpis={[
              { label: 'Devices', value: String(kpis.devices) },
              { label: 'Open Violations', value: String(kpis.open_violations) },
              {
                label: 'Next Due',
                value: kpis.next_due ? new Date(kpis.next_due).toLocaleDateString() : '—',
              },
              {
                label: 'Last Sync',
                value: kpis.last_sync ? new Date(kpis.last_sync).toLocaleString() : '—',
              },
            ]}
            actions={
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Programs
                </Button>
              </DialogTrigger>
            }
          />

          {(!data.building ||
            data.building.residential_units === null ||
            data.building.residential_units === undefined) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Residential unit count is missing for this building. If PLUTO did not return UnitsRes,
              enter the total residential units on the building record to ensure programs like HPD
              registrations apply correctly.
            </div>
          )}

          <LargeDialogContent>
            <div className="p-6">
              <PropertyProgramsManager
                propertyId={propertyId}
                propertyName={data.property.name}
                initialPrograms={data.programs as any}
                onChange={fetchData}
              />
            </div>
          </LargeDialogContent>
        </Dialog>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <ComplianceDevicesTable
              devices={devices}
              propertyId={propertyId}
              onViewViolations={handleViewViolationsForDevice}
            />

            <Tabs
              value={activeTab}
              onValueChange={(val) =>
                setActiveTab(val as 'checklist' | 'violations' | 'filings')
              }
              className="space-y-4"
            >
              <TabsList>
                <TabsTrigger value="checklist">Compliance Checklist</TabsTrigger>
                <TabsTrigger value="violations">Violations</TabsTrigger>
                <TabsTrigger value="filings">Filings</TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="space-y-4">
                <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Compliance Items</h3>
                  </div>
                  <CollapsibleContent className="pt-2">
                    <ComplianceChecklistTable items={itemsForDisplay} onViewItem={handleViewItem} />
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              <TabsContent value="violations" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Violations</h3>
                  <Button onClick={handleViolationsRefresh} variant="outline" size="sm" disabled={syncingViolations}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                <ViolationsList
                  violations={data.violations}
                  assetFilter={violationAssetFilter}
                  filterLabel={violationFilterLabel || undefined}
                  statusFilter={violationStatusFilter}
                  onStatusChange={(val) => setViolationStatusFilter(val as 'all' | 'open' | 'closed')}
                  onView={(violation) => setSelectedViolation(violation)}
                  onClearFilter={() => {
                    setViolationAssetFilter(null);
                    setViolationFilterLabel(null);
                  }}
                />
              </TabsContent>

              <TabsContent value="filings" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Filings</h3>
                  <Button onClick={handleFilingsRefresh} variant="outline" size="sm" disabled={syncingFilings}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job #</TableHead>
                        <TableHead>Permit #</TableHead>
                        <TableHead>Work Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead className="text-right">Source</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.filings || []).length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            No filings imported for this property yet.
                          </TableCell>
                        </TableRow>
                      )}
                      {(data.filings || []).map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.job_filing_number}</TableCell>
                          <TableCell>{f.work_permit || f.sequence_number || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {f.work_type || '—'}
                          </TableCell>
                          <TableCell>{f.permit_status || '—'}</TableCell>
                          <TableCell className="text-sm">
                            {(() => {
                              const parts = [f.house_no, f.street_name, f.borough]
                                .filter(Boolean)
                                .map(String);
                              return parts.length ? parts.join(', ') : '—';
                            })()}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(f.approved_date)}</TableCell>
                          <TableCell className="text-sm">{formatDate(f.issued_date)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {f.source}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFiling(f)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <ComplianceAgencyCards
              hpd={
                data.agencies?.hpd || {
                  registration_id: null,
                  building_id: null,
                  violations: 0,
                  complaints: 0,
                  last_event_date: null,
                }
              }
              fdny={data.agencies?.fdny || { open_violations: 0, last_event_date: null }}
              dep={data.agencies?.dep || { open_violations: 0, last_event_date: null }}
              hasHpdFilings={Boolean((data.building as any)?.hpd_registration)}
              onViewHpdFilings={() => setHpdFilingsOpen(true)}
            />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Filings</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setFilingsOpen(true)}>
                  View filings
                </Button>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {(data.filings || []).length
                  ? `${data.filings.length} filing${data.filings.length === 1 ? '' : 's'} imported`
                  : 'No filings imported for this property yet.'}
              </CardContent>
            </Card>
          </div>
        </div>
      </Stack>

      <Dialog
        open={syncModalOpen}
        onOpenChange={(open) => {
          if (!syncingFilings) setSyncModalOpen(open);
        }}
      >
        <LargeDialogContent>
          <div className="space-y-4 p-6">
            <DialogHeader>
              <DialogTitle>Refreshing filings</DialogTitle>
              <DialogDescription>Tracking dataset fetches for this property.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {filingSteps.map((step) => {
                const status = step.status;
                const isRunning = status === 'running';
                const isSuccess = status === 'success';
                const isError = status === 'error';
                const icon = isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isError ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                );

                const description =
                  status === 'pending'
                    ? 'Waiting to start'
                    : status === 'running'
                      ? 'Fetching…'
                      : step.error
                        ? step.error
                        : `${step.count || 0} record(s) processed`;

                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      {icon}
                      <div>
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {status === 'running' ? '—' : `${step.count || 0} rows`}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSyncModalOpen(false)} disabled={syncingFilings}>
                Close
              </Button>
            </div>
          </div>
        </LargeDialogContent>
      </Dialog>

      <Dialog
        open={violationSyncModalOpen}
        onOpenChange={(open) => {
          if (!syncingViolations) setViolationSyncModalOpen(open);
        }}
      >
        <LargeDialogContent>
          <div className="space-y-4 p-6">
            <DialogHeader>
              <DialogTitle>Refreshing violations</DialogTitle>
              <DialogDescription>Tracking datasets being queried for this property.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {violationSteps.map((step) => {
                const status = step.status;
                const isRunning = status === 'running';
                const isSuccess = status === 'success';
                const isError = status === 'error';
                const icon = isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isError ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                );

                const description =
                  status === 'pending'
                    ? 'Waiting to start'
                    : status === 'running'
                      ? 'Fetching…'
                      : step.error
                        ? step.error
                        : `${step.count || 0} record(s) processed`;

                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      {icon}
                      <div>
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {status === 'running' ? '—' : `${step.count || 0} rows`}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setViolationSyncModalOpen(false)}
                disabled={syncingViolations}
              >
                Close
              </Button>
            </div>
          </div>
        </LargeDialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedFiling)} onOpenChange={(open) => !open && setSelectedFiling(null)}>
        <LargeDialogContent>
          <div className="space-y-4 p-6">
            <DialogHeader>
              <DialogTitle>Filing details</DialogTitle>
              <DialogDescription>
                {selectedFiling?.source || 'Unknown source'} •{' '}
                {selectedFiling?.job_filing_number || selectedFiling?.work_permit || 'N/A'}
              </DialogDescription>
            </DialogHeader>
            {selectedFiling && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {[
                    ['Job #', selectedFiling.job_filing_number],
                    ['Permit #', selectedFiling.work_permit || selectedFiling.sequence_number],
                    ['Work type', selectedFiling.work_type],
                    ['Status', selectedFiling.permit_status],
                    [
                      'Address',
                      [selectedFiling.house_no, selectedFiling.street_name, selectedFiling.borough]
                        .filter(Boolean)
                        .join(', ') || null,
                    ],
                    ['Approved', selectedFiling.approved_date],
                    ['Issued', selectedFiling.issued_date],
                    ['Dataset', selectedFiling.dataset_id],
                    ['Source', selectedFiling.source],
                    ['BIN', selectedFiling.bin],
                    ['BBL', selectedFiling.bbl],
                    ['Block', selectedFiling.block],
                    ['Lot', selectedFiling.lot],
                  ]
                    .filter(([, value]) => value !== undefined)
                    .map(([label, value]) => (
                      <div key={label} className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-xs uppercase text-muted-foreground">{label}</p>
                        <p className="text-sm break-words">
                          {value && String(value).trim().length ? String(value) : '—'}
                        </p>
                      </div>
                    ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Raw data</p>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(selectedFiling.metadata || selectedFiling, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSelectedFiling(null)}>
                Close
              </Button>
            </div>
          </div>
        </LargeDialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedViolation)} onOpenChange={(open) => !open && setSelectedViolation(null)}>
        <LargeDialogContent>
          <div className="space-y-4 p-6">
            <DialogHeader>
              <DialogTitle>Violation details</DialogTitle>
              <DialogDescription>
                {selectedViolation?.agency || 'Violation'} •{' '}
                {selectedViolation?.violation_number || 'N/A'}
              </DialogDescription>
            </DialogHeader>

            {selectedViolation && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {[
                    ['Violation #', selectedViolation.violation_number],
                    ['Agency', selectedViolation.agency],
                    ['Category', selectedViolation.category],
                    ['Status', selectedViolation.status],
                    ['Issue date', selectedViolation.issue_date],
                    ['Cure by', selectedViolation.cure_by_date],
                    [
                      'Asset',
                      selectedViolation.asset?.name ||
                        selectedViolation.asset?.external_source_id ||
                        selectedViolation.asset_id,
                    ],
                  ]
                    .filter(([, value]) => value !== undefined)
                    .map(([label, value]) => (
                      <div key={label} className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-xs uppercase text-muted-foreground">{label}</p>
                        <p className="text-sm break-words">
                          {value && String(value).trim().length ? String(value) : '—'}
                        </p>
                      </div>
                    ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Description</p>
                  <p className="text-sm leading-snug">{selectedViolation.description || '—'}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Raw data</p>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(selectedViolation.metadata || selectedViolation, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSelectedViolation(null)}>
                Close
              </Button>
            </div>
          </div>
        </LargeDialogContent>
      </Dialog>

      <Dialog open={hpdFilingsOpen} onOpenChange={setHpdFilingsOpen}>
        <LargeDialogContent>
          <div className="space-y-4 p-6">
            <DialogHeader>
              <DialogTitle>HPD Filings</DialogTitle>
              <DialogDescription>
                HPD registrations associated with this property.
              </DialogDescription>
            </DialogHeader>
            {data.building?.hpd_registration ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration ID</TableHead>
                    <TableHead>Building ID</TableHead>
                    <TableHead>BIN</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Last Registration</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Community Board</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      {(data.building.hpd_registration as any)?.registrationid || '—'}
                    </TableCell>
                    <TableCell>
                      {(data.building.hpd_registration as any)?.buildingid || '—'}
                    </TableCell>
                    <TableCell>{(data.building.hpd_registration as any)?.bin || '—'}</TableCell>
                    <TableCell>
                      {(() => {
                        const reg = data.building?.hpd_registration as any;
                        if (!reg) return '—';
                        const parts = [reg.housenumber, reg.streetname, reg.boro, reg.zip].filter(
                          Boolean,
                        );
                        return parts.length ? parts.join(', ') : '—';
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const date = (data.building?.hpd_registration as any)?.lastregistrationdate;
                        if (!date) return '—';
                        const d = new Date(String(date));
                        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const date = (data.building?.hpd_registration as any)?.registrationenddate;
                        if (!date) return '—';
                        const d = new Date(String(date));
                        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
                      })()}
                    </TableCell>
                    <TableCell>
                      {(data.building.hpd_registration as any)?.communityboard || '—'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">
                No HPD filings found for this property.
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setHpdFilingsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </LargeDialogContent>
      </Dialog>

      <Dialog open={filingsOpen} onOpenChange={setFilingsOpen}>
        <LargeDialogContent>
          <div className="space-y-4 p-6">
            <DialogHeader>
              <DialogTitle>Property Filings</DialogTitle>
              <DialogDescription>Job/permit filings imported for this property.</DialogDescription>
            </DialogHeader>
            {(data.filings || []).length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Work Type</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.filings.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.job_filing_number}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{f.source}</TableCell>
                      <TableCell>{f.permit_status || '—'}</TableCell>
                      <TableCell>{f.work_type || '—'}</TableCell>
                      <TableCell>
                        {(() => {
                          const parts = [f.house_no, f.street_name, f.borough].filter(Boolean);
                          return parts.length ? parts.join(', ') : '—';
                        })()}
                      </TableCell>
                      <TableCell>{f.approved_date || '—'}</TableCell>
                      <TableCell>{f.issued_date || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">No filings found.</p>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setFilingsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </LargeDialogContent>
      </Dialog>
    </>,
  );
}

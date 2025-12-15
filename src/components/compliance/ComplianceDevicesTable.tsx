'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActionButton from '@/components/ui/ActionButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Eye, Pencil } from 'lucide-react';

type Device = {
  id: string;
  name: string;
  external_source_id: string | null;
  asset_type?: string | null;
  device_category?: string | null;
  device_technology?: string | null;
  device_subtype?: string | null;
  external_source?: string | null;
  location_notes?: string | null;
  metadata?: Record<string, any> | null;
  active?: boolean | null;
  status?: string | null;
  open_violations?: number | null;
  upcoming_inspections?: number | null;
  pressure_type?: string | null;
  last_inspection?: string | null;
  next_due?: string | null;
};

function OpenViolationsCell({
  device,
  onViewViolations,
}: {
  device: Device;
  onViewViolations?: (payload: { assetId: string; label: string }) => void;
}) {
  const count = device.open_violations ?? device.metadata?.open_violations ?? 0;
  const label = device.external_source_id || device.name || 'Device';

  if (!count || count <= 0) {
    return <span>{count ?? 0}</span>;
  }

  if (!onViewViolations) {
    return <span className="text-primary font-semibold">{count}</span>;
  }

  return (
    <button
      type="button"
      className="text-primary underline underline-offset-2 font-medium"
      onClick={(e) => {
        e.stopPropagation();
        onViewViolations({ assetId: device.id, label });
      }}
    >
      {count}
    </button>
  );
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  out_of_service: {
    label: 'Out of service',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  retired: { label: 'Retired', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  removed: { label: 'Retired', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function StatusPill({ value }: { value?: string | null }) {
  if (!value) return null;
  const key = value.toLowerCase();
  const info = statusLabels[key] || {
    label: value,
    className: 'bg-muted text-foreground border-muted-foreground/20',
  };
  return (
    <Badge variant="outline" className={info.className + ' text-xs'}>
      {info.label}
    </Badge>
  );
}

type ComplianceDevicesTableProps = {
  devices: Device[];
  propertyId?: string;
  onViewViolations?: (payload: { assetId: string; label: string }) => void;
};

type DeviceColumn = {
  header: string;
  className?: string;
  render: (device: Device) => React.ReactNode;
};

export function ComplianceDevicesTable({ devices, propertyId, onViewViolations }: ComplianceDevicesTableProps) {
  const [activeType, setActiveType] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const normalizedTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach((d) => {
      const t = (d.asset_type || 'Device').toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (activeType === 'all') return devices.filter((d) => d.active !== false);
    return devices.filter(
      (d) => d.active !== false && (d.asset_type || '').toLowerCase() === activeType,
    );
  }, [devices, activeType]);

  const formatType = (value?: string | null) => {
    if (!value) return 'Device';
    const str = String(value);
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatDate = (value: any) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  };

  const boilerColumns: DeviceColumn[] = [
    {
      header: 'DEVICE ID',
      render: (device) => device.external_source_id || device.name || 'Device',
    },
    { header: 'Type', render: (device) => formatType(device.asset_type || 'Boiler') },
    {
      header: 'Pressure Type',
      render: (device) => device.pressure_type || device.metadata?.pressure_type || '—',
    },
    {
      header: 'Make',
      render: (device) =>
        device.metadata?.manufacturer ||
        device.metadata?.make ||
        device.metadata?.brand ||
        device.metadata?.model ||
        '—',
    },
    {
      header: 'Last Inspection',
      render: (device) =>
        formatDate(
          device.last_inspection ||
            device.metadata?.latest_inspection_date ||
            device.metadata?.periodic_latest_inspection,
        ),
    },
    {
      header: 'Next Due',
      render: (device) => formatDate(device.next_due || device.metadata?.next_due),
    },
    {
      header: 'Upcoming Inspections',
      className: 'text-sm w-[140px] text-right',
      render: (device) => device.upcoming_inspections ?? 0,
    },
    {
      header: 'Open Violations',
      className: 'text-sm w-[140px] text-right',
      render: (device) => (
        <OpenViolationsCell device={device} onViewViolations={onViewViolations} />
      ),
    },
  ];

  const elevatorColumns: DeviceColumn[] = [
    {
      header: 'DEVICE ID',
      render: (device) => device.external_source_id || device.name || 'Device',
    },
    { header: 'Type', render: (device) => formatType(device.asset_type || 'Device') },
    {
      header: 'CAT1 Latest Report Filed',
      render: (device) => formatDate(device.metadata?.cat1_latest_report_filed),
    },
    {
      header: 'CAT5 Latest Report Filed',
      render: (device) => formatDate(device.metadata?.cat5_latest_report_filed),
    },
    {
      header: 'Periodic Latest Inspection',
      render: (device) => formatDate(device.metadata?.periodic_latest_inspection),
    },
    {
      header: 'Upcoming Inspections',
      className: 'text-sm w-[140px] text-right',
      render: (device) => device.upcoming_inspections ?? 0,
    },
    {
      header: 'Open Violations',
      className: 'text-sm w-[140px] text-right',
      render: (device) => (
        <OpenViolationsCell device={device} onViewViolations={onViewViolations} />
      ),
    },
    {
      header: 'Status',
      render: (device) => <StatusPill value={device.status} />,
    },
  ];

  const defaultColumns: DeviceColumn[] = [
    {
      header: 'DEVICE ID',
      render: (device) => device.external_source_id || device.name || 'Device',
    },
    { header: 'Type', render: (device) => formatType(device.asset_type || 'Device') },
    {
      header: 'Upcoming Inspections',
      className: 'text-sm w-[140px] text-right',
      render: (device) => device.upcoming_inspections ?? 0,
    },
    {
      header: 'Open Violations',
      className: 'text-sm w-[140px] text-right',
      render: (device) => (
        <OpenViolationsCell device={device} onViewViolations={onViewViolations} />
      ),
    },
    {
      header: 'Status',
      render: (device) => <StatusPill value={device.status} />,
    },
  ];

  const columns =
    activeType === 'boiler'
      ? boilerColumns
      : activeType === 'elevator'
        ? elevatorColumns
        : activeType === 'all'
          ? defaultColumns
          : defaultColumns;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Devices</h3>
      </div>
      <div className="space-y-3">
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList>
            <TabsTrigger value="all">All ({devices.length})</TabsTrigger>
            {Object.entries(normalizedTypes).map(([type, count]) => (
              <TabsTrigger key={type} value={type}>
                {type} ({count})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeType} className="mt-3">
            <div className="rounded-md border shadow-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.header} className={col.className}>
                        {col.header}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 1}
                        className="text-muted-foreground py-6 text-center text-sm"
                      >
                        No devices found for this selection.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredDevices.map((device) => {
                    return (
                      <TableRow
                        key={device.id}
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => setSelectedDevice(device)}
                      >
                        {columns.map((col) => (
                          <TableCell key={col.header} className={col.className}>
                            {col.render(device)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <ActionButton
                              asChild
                              aria-label="View device"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                href={
                                  propertyId
                                    ? `/properties/${propertyId}/compliance/devices/${device.id}`
                                    : '#'
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </ActionButton>
                            <ActionButton
                              asChild
                              aria-label="Edit device"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                href={
                                  propertyId
                                    ? `/properties/${propertyId}/compliance/devices/${device.id}`
                                    : '#'
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </ActionButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DeviceInfoDialog
        key={selectedDevice?.id || 'no-device'}
        device={selectedDevice}
        onOpenChange={(open) => !open && setSelectedDevice(null)}
      />
    </div>
  );
}

function DeviceInfoDialog({
  device,
  onOpenChange,
}: {
  device: Device | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!device) return null;
  const meta = device.metadata || {};
  const hiddenMetadataKeys = new Set([
    'device_number',
    'device_id',
    'device_type',
    'device_category',
    'device_technology',
    'device_subtype',
    'pressure_type',
    'external_source',
    'device_status',
    'status',
    'periodic_latest_inspection',
    'last_inspection',
    'next_due',
    'open_violations',
  ]);

  const CATEGORY_RULES = [
    { label: 'Applicant & License', keywords: ['applicant', 'license', 'owner'] },
    { label: 'Inspection', keywords: ['inspection', 'inspector', 'visit'] },
    {
      label: 'Filing & Fees',
      keywords: ['filing', 'fee', 'permit', 'application', 'registration'],
    },
    {
      label: 'Device Specs',
      keywords: [
        'boiler',
        'device',
        'make',
        'model',
        'manufacturer',
        'serial',
        'capacity',
        'pressure',
        'hp',
      ],
    },
    {
      label: 'Location & Building',
      keywords: ['bin', 'borough', 'block', 'lot', 'address', 'location', 'unit', 'floor', 'room'],
    },
    {
      label: 'Status & Compliance',
      keywords: [
        'status',
        'violation',
        'defect',
        'certificate',
        'expiration',
        'expiry',
        'due',
        'active',
      ],
    },
    {
      label: 'Source & Sync',
      keywords: ['source', 'sync', 'external', 'dob', 'hpd', 'dep', 'import'],
    },
  ];

  const displayName =
    device.external_source_id || meta.device_number || meta.device_id || device.name || device.id;

  const baseDetails = [
    { label: 'Device ID', value: displayName },
    { label: 'Asset type', value: device.asset_type || meta.device_type || null },
    { label: 'Category', value: device.device_category || meta.device_category || null },
    { label: 'Technology', value: device.device_technology || meta.device_technology || null },
    { label: 'Subtype', value: device.device_subtype || meta.device_subtype || null },
    { label: 'Pressure type', value: device.pressure_type || meta.pressure_type || null },
    { label: 'External source', value: device.external_source || meta.external_source || null },
    { label: 'Status', value: device.status || meta.device_status || meta.status || null },
    {
      label: 'Last inspection',
      value:
        device.last_inspection || meta.periodic_latest_inspection || meta.last_inspection || null,
    },
    { label: 'Next due', value: device.next_due || meta.next_due || null },
    { label: 'Open violations', value: device.open_violations ?? meta.open_violations ?? null },
    { label: 'Location notes', value: device.location_notes || null },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

  const metadataEntries = Object.entries(meta || {})
    .filter(
      ([key, value]) =>
        value !== null && value !== undefined && value !== '' && !hiddenMetadataKeys.has(key),
    )
    .sort(([a], [b]) => a.localeCompare(b));

  type MetaEntry = { key: string; label: string; value: any };

  const formatLabel = (key: string) =>
    key.replace(/[_\s]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formatVal = (val: any): string => {
    if (val === null || val === undefined || val === '') return '—';

    if (typeof val === 'string') {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        return d.toLocaleDateString();
      }
      return val;
    }

    if (typeof val === 'number') return val.toLocaleString();
    if (val instanceof Date) return val.toLocaleDateString();
    if (Array.isArray(val)) {
      return val.length ? val.map((v) => formatVal(v)).join(', ') : '—';
    }
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch (e) {
        return String(val);
      }
    }
    return String(val);
  };

  const DetailRow = ({ label, value }: { label: string; value: any }) => (
    <div className="rounded-md p-3">
      <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm break-words whitespace-pre-wrap">{formatVal(value)}</div>
    </div>
  );

  const groupMetadata = (entries: MetaEntry[]) => {
    const groups = new Map<string, MetaEntry[]>();

    entries.forEach((entry) => {
      const lowerKey = entry.key.toLowerCase();
      const rule = CATEGORY_RULES.find((category) =>
        category.keywords.some((keyword) => lowerKey.includes(keyword)),
      );
      const section = rule?.label || 'Other details';
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section)!.push(entry);
    });

    return groups;
  };

  const metadataFields: MetaEntry[] = metadataEntries.map(([key, value]) => ({
    key,
    label: formatLabel(key),
    value,
  }));

  const groupedMetadata = groupMetadata(metadataFields);
  const categoryOrder = CATEGORY_RULES.map((c) => c.label);
  const sortedSections = Array.from(groupedMetadata.keys()).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <Dialog open={Boolean(device)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[680px] max-w-[680px] sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Device details</DialogTitle>
          <DialogDescription>
            Metadata stored for this device from the Devices table.
          </DialogDescription>
        </DialogHeader>
        <div className="grid space-y-6">
          {baseDetails.length > 0 && (
            <div className="grid gap-y-3">
              <div className="text-muted-foreground text-sm font-semibold">Overview</div>
              <div
                className="grid grid-cols-2 gap-3"
                style={{
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gridTemplateRows: 'repeat(3, 1fr)',
                }}
              >
                {baseDetails.map((f) => (
                  <DetailRow key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            </div>
          )}

          {metadataFields.length > 0 ? (
            <div className="space-y-5">
              {sortedSections.map((section) => (
                <div key={section} className="grid gap-y-3">
                  <div className="text-muted-foreground text-sm font-semibold">{section}</div>
                  <div
                    className="grid grid-cols-2 gap-3"
                    style={{
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gridTemplateRows: 'repeat(3, 1fr)',
                    }}
                  >
                    {groupedMetadata.get(section)!.map((entry) => (
                      <DetailRow key={entry.key} label={entry.label} value={entry.value} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No additional metadata stored for this device yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

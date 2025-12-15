'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, RefreshCw, Plus, Trash2, ChevronDown } from 'lucide-react';
import { PageShell, PageHeader, PageBody, Stack } from '@/components/layout/page-shell';
import { Separator } from '@/components/ui/separator';

type ProgramCriteria = {
  scope_override?: 'property' | 'asset' | 'both';
  property_filters?: {
    boroughs?: string[];
    require_bin?: boolean;
    min_dwelling_units?: number;
  };
  asset_filters?: {
    asset_types?: string[];
    external_source?: string | null;
    active_only?: boolean;
    pressure_type?: string;
  };
};

type Program = {
  id: string;
  org_id: string;
  template_id: string | null;
  code: string;
  name: string;
  jurisdiction: string;
  frequency_months: number;
  lead_time_days: number;
  applies_to: 'property' | 'asset' | 'both';
  severity_score: number;
  is_enabled: boolean;
  criteria?: ProgramCriteria | null;
  notes: string | null;
  override_fields?: Record<string, unknown> | null;
  template?: {
    code: string;
    name: string;
    jurisdiction: string;
    frequency_months: number;
    lead_time_days: number;
    applies_to: 'property' | 'asset' | 'both';
    severity_score: number;
  };
};

type ProgramDraft = {
  name: string;
  jurisdiction: string;
  applies_to: Program['applies_to'];
  frequency_months: number;
  lead_time_days: number;
  notes: string;
  is_enabled: boolean;
  frequency_text: string;
  due_date_value: string | null;
  due_date_description: string;
  applicability_notes: string;
  nyc_dataset_name: string;
  nyc_dataset_id: string;
  nyc_datasource_id: string;
};

type CriteriaTable = 'building' | 'property' | 'unit' | 'asset';
type CriteriaOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_set'
  | 'is_not_set'
  | 'between';
type LogicalConnector = 'AND' | 'OR';

type CriteriaRowConfig = {
  id: string;
  table: CriteriaTable;
  field: string;
  operator: CriteriaOperator;
  compareType: 'value';
  compareValue?: string;
  compareField?: string;
  compareValueMin?: string;
  compareValueMax?: string;
  negate?: boolean;
  connector?: LogicalConnector;
};

const JURISDICTION_LABEL: Record<string, string> = {
  NYC_DOB: 'DOB',
  NYC_HPD: 'HPD',
  FDNY: 'FDNY',
  NYC_DEP: 'DEP',
  OTHER: 'Other',
};

const JURISDICTION_FULL_LABEL: Record<string, string> = {
  NYC_DOB: 'Department of Buildings',
  NYC_HPD: 'Department of Housing Preservation and Development',
  FDNY: 'Fire Department of New York',
  NYC_DEP: 'Department of Environmental Protection',
  OTHER: 'Other',
};

const ELEVATOR_DUE_BY_CODE: Record<string, string> = {
  NYC_ELV_PERIODIC: 'Inspection Jan 1–Dec 31; file within 14 days (late after Jan 14).',
  NYC_ELV_CAT1: 'Test Jan 1–Dec 31; file within 21 days (late after Jan 21).',
  NYC_ELV_CAT5:
    'Within 5 years of prior CAT5/new C of C; file within 21 days and by 21st of month after anniversary.',
};

const ELEVATOR_FREQUENCY_BY_CODE: Record<string, string> = {
  NYC_ELV_PERIODIC: 'Annual visual inspection by approved elevator agency',
  NYC_ELV_CAT1: 'Annual (no-load) safety test',
  NYC_ELV_CAT5: 'Every 5 years full-load safety test',
};

const FIXED_DUE_DATE_YEAR = 2000; // Arbitrary anchor year since UI only collects month/day

const PRESSURE_TYPE_PROGRAM_CODES = new Set([
  'NYC_BOILER_ANNUAL',
  'NYC_BOILER_HP_ANNUAL',
  'NYC_BOILER_LP_ANNUAL',
]);

type DataSourceRow = {
  id: string;
  key: string;
  dataset_id: string;
  title: string | null;
  description: string | null;
  is_enabled: boolean;
};

const TABLE_FIELD_OPTIONS: Record<
  CriteriaTable,
  Array<{ value: string; label: string; type?: 'string' | 'number' | 'date' }>
> = {
  building: [
    { value: 'raw_address', label: 'Raw Address' },
    { value: 'house_number', label: 'House Number' },
    { value: 'street_name', label: 'Street Name' },
    { value: 'street_name_normalized', label: 'Street Name (Normalized)' },
    { value: 'borough', label: 'Borough' },
    { value: 'borough_code', label: 'Borough Code' },
    { value: 'city', label: 'City' },
    { value: 'state', label: 'State' },
    { value: 'zip_code', label: 'ZIP Code' },
    { value: 'country', label: 'Country' },
    { value: 'latitude', label: 'Latitude', type: 'number' },
    { value: 'longitude', label: 'Longitude', type: 'number' },
    { value: 'bbl', label: 'BBL' },
    { value: 'bin', label: 'BIN' },
    { value: 'parid', label: 'PARID' },
    { value: 'ease_digit', label: 'Ease Digit' },
    { value: 'condo_num', label: 'Condo Number' },
    { value: 'coop_num', label: 'Co-op Number' },
    { value: 'tax_block', label: 'Tax Block' },
    { value: 'tax_lot', label: 'Tax Lot' },
    { value: 'tax_map', label: 'Tax Map' },
    { value: 'tax_section', label: 'Tax Section' },
    { value: 'tax_volume', label: 'Tax Volume' },
    { value: 'neighborhood', label: 'Neighborhood' },
    { value: 'nta_name', label: 'NTA Name' },
    { value: 'nta_code', label: 'NTA Code' },
    { value: 'block', label: 'Block' },
    { value: 'lot', label: 'Lot' },
    { value: 'occupancy_group', label: 'Occupancy Group' },
    { value: 'occupancy_description', label: 'Occupancy Description' },
    { value: 'is_one_two_family', label: '1–2 Family?', type: 'string' },
    {
      value: 'is_private_residence_building',
      label: 'Private Residence Building?',
      type: 'string',
    },
    { value: 'residential_units', label: 'Residential Units', type: 'number' },
    { value: 'heat_sensor_program', label: 'Heat Sensor Program?', type: 'string' },
    { value: 'geoservice_response_at', label: 'Geoservice Response At', type: 'date' },
    { value: 'pluto_response_at', label: 'PLUTO Response At', type: 'date' },
    { value: 'hpd_response_at', label: 'HPD Response At', type: 'date' },
    { value: 'hpd_registration_response_at', label: 'HPD Registration Response At', type: 'date' },
    { value: 'nta_response_at', label: 'NTA Response At', type: 'date' },
    { value: 'geoservice', label: 'Geoservice JSON' },
    { value: 'pluto', label: 'PLUTO JSON' },
    { value: 'hpd_building', label: 'HPD Building JSON' },
    { value: 'hpd_registration', label: 'HPD Registration JSON' },
    { value: 'nta', label: 'NTA JSON' },
    { value: 'enrichment_errors', label: 'Enrichment Errors JSON' },
    { value: 'has_open_violations', label: 'Open Violations?', type: 'string' },
  ],
  property: [
    { value: 'borough', label: 'Borough' },
    { value: 'bin', label: 'BIN' },
    { value: 'block', label: 'Block' },
    { value: 'lot', label: 'Lot' },
    { value: 'occupancy_group', label: 'Occupancy Group' },
    { value: 'residential_units', label: 'Residential Units', type: 'number' },
    { value: 'has_open_violations', label: 'Open Violations?', type: 'string' },
  ],
  asset: [
    { value: 'asset_type', label: 'Asset Type' },
    { value: 'device_category', label: 'Device Category' },
    { value: 'device_technology', label: 'Device Technology' },
    { value: 'pressure_type', label: 'Pressure Type' },
    { value: 'status', label: 'Status' },
    { value: 'last_inspection', label: 'Last Inspection', type: 'date' },
    { value: 'next_due', label: 'Next Due Date', type: 'date' },
    { value: 'open_violations', label: 'Open Violations', type: 'number' },
  ],
  unit: [
    { value: 'unit_number', label: 'Unit Number' },
    { value: 'floor', label: 'Floor' },
    { value: 'status', label: 'Status' },
    { value: 'bedrooms', label: 'Bedrooms', type: 'number' },
    { value: 'bathrooms', label: 'Bathrooms', type: 'number' },
    { value: 'lease_end', label: 'Lease End', type: 'date' },
  ],
};

const OPERATOR_OPTIONS: Array<{ value: CriteriaOperator; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'is_set', label: 'Is present' },
  { value: 'is_not_set', label: 'Is missing' },
  { value: 'between', label: 'Between (number)' },
];

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createDefaultCriteriaRow = (): CriteriaRowConfig => ({
  id: randomId(),
  table: 'building',
  field: TABLE_FIELD_OPTIONS.building[0]?.value || 'borough',
  operator: 'equals',
  compareType: 'value',
  compareValue: '',
  negate: false,
});

const createBlankProgramDraft = (): ProgramDraft => ({
  name: '',
  jurisdiction: 'NYC_DOB',
  applies_to: 'asset',
  frequency_months: 12,
  lead_time_days: 30,
  notes: '',
  is_enabled: true,
  frequency_text: '',
  due_date_value: null,
  due_date_description: '',
  applicability_notes: '',
  nyc_dataset_name: '',
  nyc_dataset_id: '',
  nyc_datasource_id: '',
});

const normalizeCriteriaRows = (input: unknown): CriteriaRowConfig[] => {
  if (!Array.isArray(input)) return [createDefaultCriteriaRow()];

  const rows = input
    .slice(0, 10)
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const source = row as Record<string, unknown>;
      const rawTable = String(source.table);
      const normalizedTable = rawTable === 'device' ? 'asset' : rawTable;
      const table: CriteriaTable =
        ['building', 'property', 'unit', 'asset'].includes(normalizedTable)
          ? (normalizedTable as CriteriaTable)
          : 'building';
      const fields = TABLE_FIELD_OPTIONS[table] || TABLE_FIELD_OPTIONS.building;
      const field =
        typeof source.field === 'string' && fields.some((f) => f.value === source.field)
          ? source.field
          : fields[0]?.value || 'borough';
      const operator: CriteriaOperator = OPERATOR_OPTIONS.some(
        (opt) => opt.value === source.operator,
      )
        ? (source.operator as CriteriaOperator)
        : 'equals';
      const compareType: CriteriaRowConfig['compareType'] = 'value';
      const compareValue = typeof source.compareValue === 'string' ? source.compareValue : '';
      const compareValueMin =
        typeof source.compareValueMin === 'string' ? source.compareValueMin : compareValue;
      const compareValueMax =
        typeof source.compareValueMax === 'string' ? source.compareValueMax : '';
      const compareField = typeof source.compareField === 'string' ? source.compareField : '';
      const negate = Boolean(source.negate);
      const connector: LogicalConnector | undefined =
        index < input.length - 1 && (source.connector === 'OR' || source.connector === 'AND')
          ? (source.connector as LogicalConnector)
          : index < input.length - 1
            ? 'AND'
            : undefined;

      return {
        id: typeof source.id === 'string' ? source.id : randomId(),
        table,
        field,
        operator,
        compareType,
        compareValue,
        compareValueMin,
        compareValueMax,
        compareField,
        negate,
        connector,
      };
    })
    .filter(Boolean) as CriteriaRowConfig[];

  return rows.length ? rows : [createDefaultCriteriaRow()];
};

const getFieldOptions = (table: CriteriaTable) =>
  TABLE_FIELD_OPTIONS[table] || TABLE_FIELD_OPTIONS.building;

const normalizeIsoDateString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed.slice(0, 10);
};

const parseMonthDayFromIso = (value?: string | null) => {
  const iso = normalizeIsoDateString(value);
  if (!iso) return { month: '', day: '' };
  const [, month = '', day = ''] = iso.split('-');
  return { month, day };
};

const clampDayForMonth = (month: string, day: string) => {
  if (!month || !day) return day;
  const numericMonth = Number(month);
  if (!Number.isFinite(numericMonth) || numericMonth < 1 || numericMonth > 12) return '';
  const maxDay = new Date(FIXED_DUE_DATE_YEAR, numericMonth, 0).getDate();
  const numericDay = Number(day);
  if (!Number.isFinite(numericDay)) return '';
  const clamped = Math.min(Math.max(1, numericDay), maxDay);
  return String(clamped).padStart(2, '0');
};

const buildIsoFromMonthDay = (month: string, day: string) => {
  const safeMonth = month ? month.padStart(2, '0') : '';
  const safeDay = clampDayForMonth(safeMonth, day ? day.padStart(2, '0') : '');
  if (!safeMonth || !safeDay) return null;
  return `${FIXED_DUE_DATE_YEAR}-${safeMonth}-${safeDay}`;
};

const getDayOptionsForMonth = (month: string) => {
  const numericMonth = Number(month);
  if (!Number.isFinite(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    return Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  }
  const maxDay = new Date(FIXED_DUE_DATE_YEAR, numericMonth, 0).getDate();
  return Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'));
};

export default function ComplianceProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceRow[]>([]);
  const [dataSourcesLoading, setDataSourcesLoading] = useState(false);
  const [editorProgram, setEditorProgram] = useState<Program | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'create' | null>(null);
  const [criteriaDraft, setCriteriaDraft] = useState<ProgramCriteria>({});
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    matched_properties: number;
    matched_assets: number;
  } | null>(null);
  const [, setPreviewLoading] = useState(false);
  const [generatePreview, setGeneratePreview] = useState<{
    program: Program | null;
    result: {
      matched_properties: number;
      matched_assets: number;
      total_properties: number;
      total_assets: number;
    } | null;
  }>({ program: null, result: null });
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [programDraft, setProgramDraft] = useState<ProgramDraft | null>(null);
  const [criteriaRows, setCriteriaRows] = useState<CriteriaRowConfig[]>([
    createDefaultCriteriaRow(),
  ]);
  const [dueMonthState, setDueMonthState] = useState<string>('');
  const [dueDayState, setDueDayState] = useState<string>('');
  const [reassigningProgramId, setReassigningProgramId] = useState<string | null>(null);
  const groupedPrograms = useMemo(() => {
    const grouped: Record<
      string,
      { label: string; programs: Program[] }
    > = {};

    programs.forEach((program) => {
      const jurisdiction = program.jurisdiction || 'OTHER';
      const label =
        JURISDICTION_FULL_LABEL[jurisdiction] ||
        JURISDICTION_LABEL[jurisdiction] ||
        jurisdiction;

      if (!grouped[jurisdiction]) {
        grouped[jurisdiction] = { label, programs: [] };
      }
      grouped[jurisdiction].programs.push(program);
    });

    return Object.entries(grouped)
      .map(([jurisdiction, group]) => ({
        jurisdiction,
        label: group.label,
        programs: group.programs.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [programs]);
  const [openDepartments, setOpenDepartments] = useState<Record<string, boolean>>({});

  const FREQUENCY_OPTIONS = [
    { label: 'Annually', value: 12 },
    { label: 'Every 2 years', value: 24 },
    { label: 'Every 3 years', value: 36 },
    { label: 'Every 4 years', value: 48 },
    { label: 'Every 5 years', value: 60 },
  ];

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/compliance/programs');
      if (!res.ok) throw new Error('Failed to load programs');
      const data = await res.json();
      setPrograms(data.programs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    const loadDataSources = async () => {
      try {
        setDataSourcesLoading(true);
        const res = await fetch('/api/nyc-data/sources');
        if (!res.ok) throw new Error('Failed to load data sources');
        const data = await res.json();
        const rows = ((data?.data as DataSourceRow[]) || []).sort((a, b) =>
          a.key.localeCompare(b.key),
        );
        setDataSources(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load data sources');
      } finally {
        setDataSourcesLoading(false);
      }
    };

    loadDataSources();
  }, []);

  useEffect(() => {
    setOpenDepartments((prev) => {
      const next = { ...prev };
      groupedPrograms.forEach((group) => {
        if (typeof next[group.jurisdiction] !== 'boolean') {
          next[group.jurisdiction] = false;
        }
      });
      return next;
    });
  }, [groupedPrograms]);

  const openCriteriaEditor = (program: Program) => {
    const allowPressureType = PRESSURE_TYPE_PROGRAM_CODES.has(program.code);
    const propertyFilters = program.criteria?.property_filters || {};
    const assetFilters = program.criteria?.asset_filters || {};
    const override = (program.override_fields || {}) as Record<string, unknown>;
    const toStringSafe = (value: unknown) => (typeof value === 'string' ? value : '');
    const defaultDue = ELEVATOR_DUE_BY_CODE[program.code] || '';
    const defaultFreqText = ELEVATOR_FREQUENCY_BY_CODE[program.code] || '';
    const defaultMinUnits =
      propertyFilters.min_dwelling_units ??
      (program.code === 'NYC_HPD_REGISTRATION' ? 3 : undefined);
    const savedCriteriaRows = normalizeCriteriaRows(
      override.criteria_rows ?? override.criteriaRows,
    );
    const dueDateValue =
      normalizeIsoDateString(override.due_date_value) || normalizeIsoDateString(override.due_date);
    const dueDateDescription =
      toStringSafe(override.due_date_description) ||
      toStringSafe(override.due_date_text) ||
      defaultDue ||
      '';
    const freqDescription =
      toStringSafe(override.frequency_text) || defaultFreqText || '';
    const applicabilityNotes = toStringSafe(override.applicability_notes);
    const nycDatasetName = toStringSafe(override.nyc_dataset_name);
    const nycDatasetId = toStringSafe(override.nyc_dataset_id);
    const nycDatasourceId = toStringSafe(override.nyc_datasource_id);

    setProgramDraft({
      name: program.name,
      jurisdiction: program.jurisdiction,
      applies_to: program.applies_to,
      frequency_months: program.frequency_months,
      lead_time_days: program.lead_time_days,
      notes: program.notes || '',
      is_enabled: program.is_enabled,
      due_date_value: dueDateValue,
      due_date_description: dueDateDescription,
      frequency_text: freqDescription,
      applicability_notes: applicabilityNotes,
      nyc_dataset_name: nycDatasetName,
      nyc_dataset_id: nycDatasetId,
      nyc_datasource_id: nycDatasourceId,
    });
    const parsedDue = parseMonthDayFromIso(dueDateValue);
    setDueMonthState(parsedDue.month);
    setDueDayState(parsedDue.day);
    setEditorProgram(program);
    setEditorMode('edit');
    setPreviewResult(null);
    setCriteriaRows(savedCriteriaRows);
    setCriteriaDraft({
      scope_override: program.criteria?.scope_override,
      property_filters: {
        boroughs: propertyFilters.boroughs || [],
        require_bin: propertyFilters.require_bin,
        min_dwelling_units: defaultMinUnits,
      },
      asset_filters: {
        asset_types: assetFilters.asset_types || [],
        external_source: assetFilters.external_source || '',
        active_only: assetFilters.active_only,
        pressure_type: allowPressureType ? assetFilters.pressure_type || '' : '',
      },
    });
  };

  const openCreateProgram = () => {
    const draft = createBlankProgramDraft();
    setProgramDraft(draft);
    setCriteriaDraft({
      scope_override: undefined,
      property_filters: { boroughs: [], require_bin: false },
      asset_filters: { asset_types: [], external_source: '', active_only: true, pressure_type: '' },
    });
    setCriteriaRows([createDefaultCriteriaRow()]);
    setDueMonthState('');
    setDueDayState('');
    setEditorProgram(null);
    setEditorMode('create');
    setPreviewResult(null);
  };

  useEffect(() => {
    const parsedDue = parseMonthDayFromIso(programDraft?.due_date_value || null);
    setDueMonthState(parsedDue.month);
    setDueDayState(parsedDue.day);
  }, [programDraft?.due_date_value]);

  const buildCriteriaPayload = (): ProgramCriteria => {
    const allowPressureType = editorProgram
      ? PRESSURE_TYPE_PROGRAM_CODES.has(editorProgram.code)
      : false;
    const payload: ProgramCriteria = {};
    if (criteriaDraft.scope_override) payload.scope_override = criteriaDraft.scope_override;
    const minUnits =
      typeof criteriaDraft.property_filters?.min_dwelling_units === 'number'
        ? criteriaDraft.property_filters.min_dwelling_units
        : editorProgram?.code === 'NYC_HPD_REGISTRATION'
          ? 3
          : undefined;

    if (editorProgram?.code === 'NYC_HPD_REGISTRATION') {
      if (typeof minUnits === 'number') {
        payload.property_filters = { min_dwelling_units: minUnits };
      }
      return payload;
    }

    const pf: ProgramCriteria['property_filters'] = {};
    if (
      criteriaDraft.property_filters?.boroughs &&
      criteriaDraft.property_filters.boroughs.length > 0
    ) {
      pf.boroughs = criteriaDraft.property_filters.boroughs;
    }
    if (typeof criteriaDraft.property_filters?.require_bin === 'boolean') {
      pf.require_bin = criteriaDraft.property_filters.require_bin;
    }
    if (typeof minUnits === 'number') {
      pf.min_dwelling_units = minUnits;
    }
    if (pf && Object.keys(pf).length > 0) payload.property_filters = pf;

    const af: ProgramCriteria['asset_filters'] = {};
    if (
      criteriaDraft.asset_filters?.asset_types &&
      criteriaDraft.asset_filters.asset_types.length > 0
    ) {
      af.asset_types = criteriaDraft.asset_filters.asset_types;
    }
    if (
      allowPressureType &&
      typeof criteriaDraft.asset_filters?.pressure_type === 'string' &&
      criteriaDraft.asset_filters.pressure_type.trim().length > 0
    ) {
      af.pressure_type = criteriaDraft.asset_filters.pressure_type.trim();
    }
    if (typeof criteriaDraft.asset_filters?.external_source === 'string') {
      const trimmed = criteriaDraft.asset_filters.external_source.trim();
      if (trimmed.length > 0) af.external_source = trimmed;
    }
    if (typeof criteriaDraft.asset_filters?.active_only === 'boolean') {
      af.active_only = criteriaDraft.asset_filters.active_only;
    }
    if (af && Object.keys(af).length > 0) payload.asset_filters = af;

    return payload;
  };

  const saveCriteria = async () => {
    if (!editorMode || !programDraft) return;
    if (!programDraft.name.trim()) {
      toast.error('Program name is required');
      return;
    }
    const fallback = editorProgram;
    const baseOverride = editorProgram?.override_fields || {};
    const preparedCriteriaRows = criteriaRows.slice(0, 10).map((row, index) => {
      const fields = getFieldOptions(row.table);
      const fallbackField = fields[0]?.value || 'borough';
      const safeField = fields.some((f) => f.value === row.field) ? row.field : fallbackField;
      const trimmedCompareField =
        typeof row.compareField === 'string' && row.compareField.trim().length > 0
          ? row.compareField.trim()
          : undefined;
      const combinedCompareValue =
        (row.compareValue && row.compareValue.trim()) ||
        (trimmedCompareField && trimmedCompareField.trim()) ||
        '';

      return {
        ...row,
        id: row.id || randomId(),
        field: safeField,
        compareField: trimmedCompareField,
        compareValue: combinedCompareValue,
        compareValueMin: row.operator === 'between' ? row.compareValueMin || '' : undefined,
        compareValueMax: row.operator === 'between' ? row.compareValueMax || '' : undefined,
        connector: index < criteriaRows.length - 1 ? row.connector || 'AND' : undefined,
        negate: false,
      };
    });

    try {
      setSavingCriteria(true);
      const payload = {
        criteria: buildCriteriaPayload(),
        name: programDraft.name || fallback?.name,
        jurisdiction: programDraft.jurisdiction || fallback?.jurisdiction,
        applies_to: programDraft.applies_to || fallback?.applies_to,
        frequency_months:
          typeof programDraft.frequency_months === 'number'
            ? programDraft.frequency_months
            : fallback?.frequency_months,
        lead_time_days:
          typeof programDraft.lead_time_days === 'number'
            ? programDraft.lead_time_days
            : fallback?.lead_time_days,
        notes: programDraft.notes ?? fallback?.notes ?? '',
        is_enabled: typeof programDraft.is_enabled === 'boolean' ? programDraft.is_enabled : true,
        override_fields: {
          ...baseOverride,
          due_date_value: programDraft.due_date_value || null,
          due_date_description: programDraft.due_date_description || null,
          due_date_text: programDraft.due_date_description || null,
          frequency_text: programDraft.frequency_text || null,
          frequency_description: programDraft.frequency_text || null,
          applicability_notes: programDraft.applicability_notes || null,
          nyc_dataset_name: programDraft.nyc_dataset_name || null,
          nyc_dataset_id: programDraft.nyc_dataset_id || null,
          nyc_datasource_id: programDraft.nyc_datasource_id || null,
          criteria_rows: preparedCriteriaRows,
        },
      };
      const res =
        editorMode === 'create'
          ? await fetch('/api/compliance/programs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/compliance/programs/${editorProgram?.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update criteria');
      if (editorMode === 'create') {
        setPrograms((prev) => [...prev, data.program]);
        toast.success('Program created');
      } else {
        setPrograms((prev) =>
          prev.map((p) => (editorProgram && p.id === editorProgram.id ? { ...p, ...data.program } : p)),
        );
        toast.success('Criteria saved');
      }
      resetEditorState();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update criteria');
    } finally {
      setSavingCriteria(false);
    }
  };

  const _previewCriteria = async () => {
    if (!editorProgram) return;
    try {
      setPreviewLoading(true);
      const res = await fetch(`/api/compliance/programs/${editorProgram.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: buildCriteriaPayload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to preview criteria');
      setPreviewResult({
        matched_properties: data.matched_properties,
        matched_assets: data.matched_assets,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to preview criteria');
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateCriteriaRow = (rowId: string, updates: Partial<CriteriaRowConfig>) => {
    setCriteriaRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
  };

  const handleTableChange = (rowId: string, table: CriteriaTable) => {
    const fields = getFieldOptions(table);
    updateCriteriaRow(rowId, {
      table,
      field: fields[0]?.value || '',
      compareField: undefined,
      compareValue: '',
    });
  };

  const handleAddCriteriaRow = () => {
    setCriteriaRows((prev) => {
      if (prev.length >= 10) return prev;
      const nextRow = createDefaultCriteriaRow();
      if (!prev.length) return [nextRow];
      const copy = [...prev];
      copy[copy.length - 1] = {
        ...copy[copy.length - 1],
        connector: copy[copy.length - 1].connector || 'AND',
      };
      return [...copy, nextRow];
    });
  };

  const handleRemoveCriteriaRow = (rowId: string) => {
    setCriteriaRows((prev) => {
      if (prev.length === 1) return prev;
      const idx = prev.findIndex((row) => row.id === rowId);
      if (idx === -1) return prev;
      const removed = prev[idx];
      const remaining = prev.filter((row) => row.id !== rowId);
      if (remaining.length === 1) {
        return [{ ...remaining[0], connector: undefined }];
      }
      if (idx > 0 && idx < prev.length - 1) {
        remaining[idx - 1] = { ...remaining[idx - 1], connector: removed.connector || 'AND' };
      } else if (idx > 0 && idx === prev.length - 1) {
        remaining[idx - 1] = { ...remaining[idx - 1], connector: undefined };
      }
      return remaining;
    });
  };

  const handleConnectorChange = (rowId: string, connector: LogicalConnector) => {
    updateCriteriaRow(rowId, { connector });
  };

  const resetEditorState = () => {
    setEditorProgram(null);
    setEditorMode(null);
    setProgramDraft(null);
    setCriteriaDraft({});
    setCriteriaRows([createDefaultCriteriaRow()]);
    setPreviewResult(null);
    setGeneratePreview({ program: null, result: null });
    setGenerateError(null);
    setGenerateLoading(false);
    setDueMonthState('');
    setDueDayState('');
  };
  const formatCategoryLabel = (category: string) =>
    category
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const formatFrequencyLabel = (months: number) => {
    if (months === 12) return 'Annually';
    if (months === 60) return 'Every 5 years';
    if (months <= 0) return 'Per defect / ad-hoc';
    if (months % 12 === 0) return `Every ${months / 12} year${months === 12 ? '' : 's'}`;
    return `Every ${months} month${months === 1 ? '' : 's'}`;
  };

  const canEditPressureType = (program?: Program | null) =>
    !!(program && PRESSURE_TYPE_PROGRAM_CODES.has(program.code));

  const criteriaSummary = (program: Program) => {
    const parts: string[] = [];
    const allowPressureType = canEditPressureType(program);
    const scope = program.criteria?.scope_override || program.applies_to;
    parts.push(
      scope === 'asset'
        ? 'Asset scope'
        : scope === 'property'
          ? 'Property scope'
          : 'Property & asset scope',
    );
    if (program.criteria?.asset_filters?.asset_types?.length) {
      parts.push(`Assets: ${program.criteria.asset_filters.asset_types.join(', ')}`);
    }
    if (allowPressureType && program.criteria?.asset_filters?.pressure_type) {
      parts.push(
        `Pressure: ${formatCategoryLabel(String(program.criteria.asset_filters.pressure_type).replace(/-/g, '_'))}`,
      );
    }
    if (program.criteria?.asset_filters?.external_source) {
      parts.push(`Source: ${program.criteria.asset_filters.external_source}`);
    }
    if (program.criteria?.property_filters?.boroughs?.length) {
      parts.push(`Boroughs: ${program.criteria.property_filters.boroughs.join(', ')}`);
    }
    if (typeof program.criteria?.property_filters?.min_dwelling_units === 'number') {
      parts.push(`Residential units ≥ ${program.criteria.property_filters.min_dwelling_units}`);
    }
    if (program.criteria?.property_filters?.require_bin) parts.push('BIN required');
    if (program.criteria?.asset_filters?.active_only) parts.push('Active assets only');
    return parts.length ? parts.join(' • ') : 'Applies broadly (no filters set)';
  };

  const toggleProgram = async (programId: string, nextEnabled: boolean) => {
    try {
      const res = await fetch(`/api/compliance/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: nextEnabled }),
      });
      if (!res.ok) throw new Error('Failed to update program');
      const data = await res.json();
      setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, ...data.program } : p)));
      toast.success(`Program ${nextEnabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update program');
    }
  };

  const generateItems = async (programId: string) => {
    try {
      const res = await fetch(`/api/compliance/programs/${programId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periods_ahead: 12 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate items');

      toast.success('Compliance items generated', {
        description: `Created ${data.items_created}, skipped ${data.items_skipped}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate items');
    }
  };

  const _previewGeneration = async (program: Program) => {
    try {
      setGenerateError(null);
      setGeneratePreview({ program, result: null });
      setGenerateLoading(true);
      const res = await fetch(`/api/compliance/programs/${program.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: program.criteria || {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to preview generation');
      setGeneratePreview({ program, result: data });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to preview generation');
    } finally {
      setGenerateLoading(false);
    }
  };

  const reassignProgram = async (program: Program) => {
    try {
      setReassigningProgramId(program.id);
      const res = await fetch(`/api/compliance/programs/${program.id}/reevaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reassign program');
      }
      const closed = data.closed || 0;
      const total = data.total_items || 0;
      toast.success('Program reassigned', {
        description: `Closed ${closed} non-matching item${closed === 1 ? '' : 's'} out of ${total}.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reassign program');
    } finally {
      setReassigningProgramId(null);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Compliance Programs" />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </PageBody>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Compliance Programs" />
        <PageBody>
          <div className="border-destructive bg-destructive/10 rounded-lg border p-4">
            <p className="text-destructive text-sm">Error: {error}</p>
            <Button onClick={loadPrograms} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </PageBody>
      </PageShell>
    );
  }

  const currentFrequency = programDraft?.frequency_months ?? editorProgram?.frequency_months ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Compliance Programs"
        actions={
          <Button variant="default" onClick={openCreateProgram}>
            Create Program
          </Button>
        }
      />
      <PageBody>
        <Stack gap="lg">
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-1 text-sm">
              <div>
                <strong>Programs</strong> are the rulebooks (NYC DOB/HPD/FDNY requirements).
              </div>
              <div>
                <strong>Items</strong> are the generated reminders/todos per building or asset.
              </div>
              <div>
                <strong>Events</strong> are real-world inspections and filings pulled from NYC data.
              </div>
            </CardContent>
          </Card>

          {groupedPrograms.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center">
                No compliance programs found. If this seems wrong, refresh or check
                seeding/permissions.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedPrograms.map((group) => {
                const isOpen = openDepartments[group.jurisdiction] ?? false;
                return (
                  <Collapsible
                    key={group.jurisdiction}
                    open={isOpen}
                    onOpenChange={(open) =>
                      setOpenDepartments((prev) => ({ ...prev, [group.jurisdiction]: open }))
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted"
                      >
                        <span>{group.label}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {group.programs.map((program) => (
                          <Card key={program.id}>
                            <CardHeader className="flex flex-row items-start justify-between gap-3">
                              <div className="space-y-2">
                                <CardTitle className="flex items-center gap-2">
                                  {program.name}
                                  <Badge variant="outline">
                                    {JURISDICTION_LABEL[program.jurisdiction] ||
                                      program.jurisdiction}
                                  </Badge>
                                </CardTitle>
                                <div className="text-muted-foreground text-sm">
                                  <span className="text-foreground font-medium">Criteria: </span>
                                  {criteriaSummary(program)}
                                </div>
                                <div className="text-muted-foreground text-sm">
                                  <span className="text-foreground font-medium">Frequency: </span>
                                  {formatFrequencyLabel(program.frequency_months)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={program.is_enabled}
                                  onCheckedChange={(checked) => toggleProgram(program.id, checked)}
                                />
                                <Badge
                                  variant={program.is_enabled ? 'outline' : 'secondary'}
                                  className={
                                    program.is_enabled
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : undefined
                                  }
                                >
                                  {program.is_enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reassignProgram(program)}
                                  disabled={reassigningProgramId === program.id}
                                >
                                  {reassigningProgramId === program.id && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Reassign
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => openCriteriaEditor(program)}
                                >
                                  Manage
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </Stack>
      </PageBody>

      <Dialog open={!!editorMode} onOpenChange={(open) => (open ? null : resetEditorState())}>
        <DialogContent className="w-[680px] max-w-[680px] sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editorMode === 'create' ? 'Create program' : 'Edit applicability'}</DialogTitle>
            <DialogDescription>
              Choose which properties or assets this program should target before generating items.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[80vh] space-y-6 overflow-y-auto pr-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <Label>Compliance Program</Label>
                <Input
                  value={programDraft?.name ?? editorProgram?.name ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  placeholder="Program name"
                />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={programDraft?.jurisdiction || editorProgram?.jurisdiction || 'NYC_DOB'}
                  onValueChange={(value) =>
                    setProgramDraft((prev) => (prev ? { ...prev, jurisdiction: value } : null))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(JURISDICTION_LABEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Applicability scope (Building / Device / Units)</Label>
                <Select
                  value={programDraft?.applies_to || editorProgram?.applies_to || 'asset'}
                  onValueChange={(value) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, applies_to: value as Program['applies_to'] } : prev,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Per device</SelectItem>
                    <SelectItem value="property">Per building</SelectItem>
                    <SelectItem value="both">Property & device</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Enabled</Label>
                  <div className="text-sm">Generate items for this program</div>
                </div>
                <Switch
                  checked={programDraft?.is_enabled ?? true}
                  onCheckedChange={(checked) =>
                    setProgramDraft((prev) => (prev ? { ...prev, is_enabled: checked } : prev))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={
                    FREQUENCY_OPTIONS.some((opt) => opt.value === currentFrequency)
                      ? String(currentFrequency || 12)
                      : 'custom'
                  }
                  onValueChange={(value) =>
                    setProgramDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            frequency_months: value === 'custom' ? currentFrequency : Number(value),
                          }
                        : prev,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                    {!FREQUENCY_OPTIONS.some((opt) => opt.value === currentFrequency) && (
                      <SelectItem value="custom">Custom ({currentFrequency} months)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lead time (days before period end)</Label>
                <Input
                  type="number"
                  min={0}
                  value={programDraft?.lead_time_days ?? editorProgram?.lead_time_days ?? 0}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, lead_time_days: Number(e.target.value || 0) } : prev,
                    )
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Frequency description (what needs to happen)</Label>
                <Textarea
                  rows={2}
                  value={programDraft?.frequency_text ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, frequency_text: e.target.value } : prev,
                    )
                  }
                  placeholder="e.g., Annual visual inspection by approved elevator agency"
                />
              </div>

              <div className="space-y-2">
                <Label>Due date</Label>
                {(() => {
                  const dueMonth = dueMonthState;
                  const dueDay = dueDayState;
                  const dayOptions = getDayOptionsForMonth(dueMonth || '');

                  const handleMonthChange = (nextMonth: string) => {
                    setDueMonthState(nextMonth);
                    setProgramDraft((prev) => {
                      if (!prev) return prev;
                      const clampedDay = clampDayForMonth(nextMonth, dueDay);
                      setDueDayState(clampedDay);
                      const iso = nextMonth && clampedDay ? buildIsoFromMonthDay(nextMonth, clampedDay) : null;
                      return { ...prev, due_date_value: iso };
                    });
                  };

                  const handleDayChange = (nextDay: string) => {
                    setDueDayState(nextDay);
                    setProgramDraft((prev) => {
                      if (!prev) return prev;
                      const clampedDay = clampDayForMonth(dueMonth, nextDay);
                      const iso = dueMonth && clampedDay ? buildIsoFromMonthDay(dueMonth, clampedDay) : null;
                      return { ...prev, due_date_value: iso };
                    });
                  };

                  return (
                    <div className="grid grid-cols-2 gap-3 max-w-[340px]">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Month</Label>
                        <Select value={dueMonth} onValueChange={handleMonthChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => {
                              const value = String(i + 1).padStart(2, '0');
                              const label = new Date(2000, i).toLocaleString('default', {
                                month: 'long',
                              });
                              return (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Day</Label>
                        <Select value={dueDay} onValueChange={handleDayChange} disabled={!dueMonth}>
                          <SelectTrigger>
                            <SelectValue placeholder="Day" />
                          </SelectTrigger>
                          <SelectContent>
                            {dayOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {Number(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Due date description</Label>
                <Textarea
                  rows={2}
                  value={programDraft?.due_date_description ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, due_date_description: e.target.value } : prev,
                    )
                  }
                  placeholder="e.g., Inspection Jan 1–Dec 31; file within 14 days; late after Jan 14 not accepted"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Applicability notes</Label>
                <Textarea
                  rows={2}
                  value={programDraft?.applicability_notes ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, applicability_notes: e.target.value } : prev,
                    )
                  }
                  placeholder="Clarify nuances for when this program applies (e.g., exemptions, unit-specific guidance)"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={programDraft?.notes ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                  }
                  placeholder="Add program notes/penalties"
                />
              </div>

              <div className="space-y-2">
                <Label>Datasource</Label>
                <Select
                  value={programDraft?.nyc_datasource_id || ''}
                  onValueChange={(value) => {
                    const matched = dataSources.find((ds) => ds.id === value);
                    setProgramDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            nyc_datasource_id: matched?.id || '',
                          }
                        : prev,
                    );
                  }}
                  disabled={dataSourcesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select datasource" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.title || option.key} ({option.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Criteria rows</h3>
                  <p className="text-muted-foreground text-xs">
                    Define up to 10 conditions. Use AND / OR to combine rules. All conditions must be
                    met to apply the program.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCriteriaRow}
                  disabled={criteriaRows.length >= 10}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add row
                </Button>
              </div>

              <div className="space-y-4">
                {criteriaRows.map((row, index) => {
                  const fieldOptions = getFieldOptions(row.table);
                  const fieldType = fieldOptions.find((f) => f.value === row.field)?.type;
                  const isBetween = row.operator === 'between';

                  return (
                    <div key={row.id} className="bg-muted/40 space-y-3 rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-muted-foreground text-xs font-medium">
                          Condition {index + 1}
                        </div>
                        {criteriaRows.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCriteriaRow(row.id)}
                            aria-label="Remove criteria row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Data Source</Label>
                          <Select
                            value={row.table}
                            onValueChange={(value) =>
                              handleTableChange(row.id, value as CriteriaTable)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="building">Buildings</SelectItem>
                              <SelectItem value="property">Properties</SelectItem>
                              <SelectItem value="unit">Units</SelectItem>
                              <SelectItem value="asset">Compliance Assets</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label>Attribute</Label>
                          <Select
                            value={row.field}
                            onValueChange={(value) =>
                              updateCriteriaRow(row.id, {
                                field: value,
                                compareField: row.compareField,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {fieldOptions.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label>Condition</Label>
                          <Select
                            value={row.operator}
                            onValueChange={(value) =>
                              updateCriteriaRow(row.id, {
                                operator: value as CriteriaOperator,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATOR_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-3">
                          {isBetween ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                value={row.compareValueMin || ''}
                                onChange={(e) =>
                                  updateCriteriaRow(row.id, { compareValueMin: e.target.value })
                                }
                                placeholder="Min"
                              />
                              <Input
                                type="number"
                                value={row.compareValueMax || ''}
                                onChange={(e) =>
                                  updateCriteriaRow(row.id, { compareValueMax: e.target.value })
                                }
                                placeholder="Max"
                              />
                            </div>
                          ) : fieldType === 'date' ? (
                            <DatePicker
                              value={row.compareValue || null}
                              onChange={(value) =>
                                updateCriteriaRow(row.id, { compareValue: value || undefined })
                              }
                              placeholder="mm/dd/yyyy"
                            />
                          ) : (
                            <Input
                              type={fieldType === 'number' ? 'number' : 'text'}
                              value={row.compareField || row.compareValue || ''}
                              onChange={(e) =>
                                updateCriteriaRow(row.id, {
                                  compareValue: e.target.value,
                                  compareField: e.target.value,
                                })
                              }
                              placeholder="Enter value"
                            />
                          )}
                        </div>
                      </div>

                      {index < criteriaRows.length - 1 && (
                        <div className="flex items-center gap-2">
                          <Separator className="flex-1" />
                          <Select
                            value={row.connector || 'AND'}
                            onValueChange={(value) =>
                              handleConnectorChange(row.id, value as LogicalConnector)
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                          <Separator className="flex-1" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {previewResult && (
              <div className="rounded-md border p-3 text-sm">
                <div className="text-foreground mb-1 font-medium">Preview</div>
                <div className="text-muted-foreground">
                  Matches {previewResult.matched_properties} properties and{' '}
                  {previewResult.matched_assets} assets.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <Button onClick={saveCriteria} disabled={savingCriteria}>
              {savingCriteria && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editorMode === 'create' ? 'Create program' : 'Save criteria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!generatePreview.program}
        onOpenChange={(open) => (open ? null : setGeneratePreview({ program: null, result: null }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate items</DialogTitle>
            <DialogDescription>
              Preview how many properties/assets this will target before creating items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {generateError && (
              <div className="text-destructive border-destructive/30 rounded-md border p-2 text-sm">
                {generateError}
              </div>
            )}
            <div className="rounded-md border p-3 text-sm">
              {generateLoading && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading preview...
                </div>
              )}
              {!generateLoading && generatePreview.result && (
                <div className="text-muted-foreground space-y-1">
                  <div>
                    <span className="text-foreground font-medium">Matches</span>{' '}
                    {generatePreview.result.matched_properties} properties /{' '}
                    {generatePreview.result.matched_assets} assets
                  </div>
                  <div className="text-xs">
                    Total available: {generatePreview.result.total_properties} properties /{' '}
                    {generatePreview.result.total_assets} assets
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setGeneratePreview({ program: null, result: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!generatePreview.program) return;
                setGeneratePreview({ program: null, result: null });
                generateItems(generatePreview.program.id);
              }}
              disabled={generateLoading || !!generateError}
            >
              Generate now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

/**
 * Compliance Management TypeScript Types
 *
 * Types for compliance assets, programs, items, events, and violations.
 * These types match the database schema defined in the compliance tables migration.
 */

import type { Json } from '@/types/database';

// ============================================================================
// ENUMS
// ============================================================================

export type ComplianceAssetType =
  | 'elevator'
  | 'boiler'
  | 'facade'
  | 'gas_piping'
  | 'sprinkler'
  | 'generic'
  | 'other'

export type ComplianceJurisdiction =
  | 'NYC_DOB'
  | 'NYC_HPD'
  | 'FDNY'
  | 'NYC_DEP'
  | 'OTHER'

export type ComplianceItemStatus =
  | 'not_started'
  | 'scheduled'
  | 'in_progress'
  | 'inspected'
  | 'filed'
  | 'accepted'
  | 'accepted_with_defects'
  | 'failed'
  | 'overdue'
  | 'closed'

export type ComplianceItemSource =
  | 'manual'
  | 'dob_sync'
  | 'hpd_sync'
  | 'fdny_sync'
  | 'open_data_sync'

export type ComplianceEventType =
  | 'inspection'
  | 'filing'
  | 'correction'
  | 'violation_clearance'

export type ComplianceViolationAgency =
  | 'DOB'
  | 'HPD'
  | 'FDNY'
  | 'DEP'
  | 'OTHER'

export type ComplianceViolationStatus =
  | 'open'
  | 'in_progress'
  | 'cleared'
  | 'closed'

export type ComplianceViolationCategory =
  | 'violation'
  | 'complaint'

export type ComplianceWorkOrderRole =
  | 'primary'
  | 'related'

export type ComplianceStatus = string | null

export type ExternalSyncSource =
  | 'dob_now'
  | 'nyc_open_data'
  | 'hpd'
  | 'fdny'

export type ExternalSyncStatus =
  | 'idle'
  | 'running'
  | 'error'

export type ComplianceAppliesTo =
  | 'property'
  | 'asset'
  | 'both'

export type ComplianceDeviceCategory =
  | 'elevator'
  | 'escalator'
  | 'dumbwaiter'
  | 'wheelchair_lift'
  | 'material_lift'
  | 'manlift'
  | 'pneumatic_elevator'
  | 'other_vertical'
  | 'lift'
  | 'chairlift'
  | 'boiler'
  | 'sprinkler'
  | 'gas_piping'
  | 'generic'
  | 'other'

// ============================================================================
// BASE TYPES
// ============================================================================

export interface ComplianceProgramTemplate {
  id: string
  code: string
  name: string
  jurisdiction: ComplianceJurisdiction
  frequency_months: number
  lead_time_days: number
  applies_to: ComplianceAppliesTo
  severity_score: number // 1-5
  criteria: ComplianceProgramCriteria | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ComplianceProgram {
  id: string
  org_id: string
  template_id: string | null
  code: string
  name: string
  jurisdiction: ComplianceJurisdiction
  frequency_months: number
  lead_time_days: number
  applies_to: ComplianceAppliesTo
  severity_score: number // 1-5
  criteria: ComplianceProgramCriteria | null
  is_enabled: boolean
  override_fields: Record<string, unknown> // jsonb
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CompliancePropertyProgramOverride {
  id: string
  org_id: string
  property_id: string
  program_id: string
  is_assigned: boolean
  is_enabled: boolean | null
  assigned_at: string | null
  assigned_by: string | null
  created_at: string
  updated_at: string
}

export type ComplianceProgramWithOverride = ComplianceProgram & {
  override?: CompliancePropertyProgramOverride | null
  effective_is_enabled?: boolean
}

export type ComplianceProgramWithPropertyContext = ComplianceProgram & {
  override?: CompliancePropertyProgramOverride | null
  is_assigned: boolean
  suppressed?: boolean
  effective_is_enabled: boolean
  matches_criteria: boolean
  warning_message?: string | null
}

export interface ComplianceProgramCriteria {
  scope_override?: ComplianceAppliesTo
  property_filters?: {
    boroughs?: string[]
    require_bin?: boolean
    occupancy_groups?: string[]
    is_one_two_family?: boolean
    is_private_residence_building?: boolean
    min_dwelling_units?: number
    max_dwelling_units?: number
  }
  asset_filters?: {
    asset_types?: ComplianceAssetType[]
    external_source?: string | null
    active_only?: boolean
    device_categories?: ComplianceDeviceCategory[]
    exclude_device_categories?: ComplianceDeviceCategory[]
    device_technologies?: string[]
    is_private_residence?: boolean
    pressure_type?: string
  }
}

export interface ComplianceAsset {
  id: string
  property_id: string
  org_id: string
  asset_type: ComplianceAssetType
  name: string
  location_notes: string | null
  external_source: string | null
  external_source_id: string | null
  active: boolean
  device_category?: ComplianceDeviceCategory | null
  device_technology?: string | null
  device_subtype?: string | null
  is_private_residence?: boolean | null
  metadata: Json | null // jsonb
  created_at: string
  updated_at: string
}

export interface ComplianceItem {
  id: string
  property_id: string
  asset_id: string | null
  program_id: string
  org_id: string
  period_start: string // date
  period_end: string // date
  due_date: string // date
  status: ComplianceItemStatus
  source: ComplianceItemSource
  external_tracking_number: string | null
  result: string | null
  defect_flag: boolean
  next_action: string | null
  primary_work_order_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ComplianceItemWorkOrder {
  id: string
  item_id: string
  work_order_id: string
  org_id: string
  role: ComplianceWorkOrderRole
  created_at: string
}

export interface ComplianceEvent {
  id: string
  property_id: string
  asset_id: string | null
  item_id: string | null
  org_id: string
  event_type: ComplianceEventType
  inspection_type: string | null
  inspection_date: string | null // date
  filed_date: string | null // date
  compliance_status: ComplianceStatus
  defects: boolean
  inspector_name: string | null
  inspector_company: string | null
  external_tracking_number: string | null
  raw_source: Record<string, unknown> // jsonb
  created_at: string
  updated_at: string
}

export interface ComplianceViolation {
  id: string
  property_id: string
  asset_id: string | null
  org_id: string
  agency: ComplianceViolationAgency
  category: ComplianceViolationCategory
  violation_number: string
  issue_date: string // date
  description: string
  severity_score: number | null // 1-5
  status: ComplianceViolationStatus
  cure_by_date: string | null // date
  cleared_date: string | null // date
  linked_item_id: string | null
  linked_work_order_id: string | null
  metadata: Json | null // jsonb
  created_at: string
  updated_at: string
}

export interface ExternalSyncState {
  id: string
  org_id: string
  source: ExternalSyncSource
  last_cursor: string | null
  last_seen_at: string | null
  last_run_at: string | null
  status: ExternalSyncStatus
  last_error: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// INSERT TYPES
// ============================================================================

export type ComplianceProgramTemplateInsert = Omit<
  ComplianceProgramTemplate,
  'id' | 'created_at' | 'updated_at'
>

export type ComplianceProgramInsert = Omit<
  ComplianceProgram,
  'id' | 'created_at' | 'updated_at'
>

export type ComplianceAssetInsert = Omit<
  ComplianceAsset,
  'id' | 'created_at' | 'updated_at'
>

export type ComplianceItemInsert = Omit<
  ComplianceItem,
  'id' | 'created_at' | 'updated_at'
>

export type ComplianceItemWorkOrderInsert = Omit<
  ComplianceItemWorkOrder,
  'id' | 'created_at'
>

export type ComplianceEventInsert = Omit<
  ComplianceEvent,
  'id' | 'created_at' | 'updated_at'
>

export type ComplianceViolationInsert = Omit<
  ComplianceViolation,
  'id' | 'created_at' | 'updated_at'
>

export type ExternalSyncStateInsert = Omit<
  ExternalSyncState,
  'id' | 'created_at' | 'updated_at'
>

// ============================================================================
// UPDATE TYPES
// ============================================================================

export type ComplianceProgramTemplateUpdate = Partial<
  Omit<ComplianceProgramTemplate, 'id' | 'created_at' | 'updated_at'>
>

export type ComplianceProgramUpdate = Partial<
  Omit<ComplianceProgram, 'id' | 'org_id' | 'created_at' | 'updated_at'>
>

export type ComplianceAssetUpdate = Partial<
  Omit<ComplianceAsset, 'id' | 'property_id' | 'org_id' | 'created_at' | 'updated_at'>
>

export type ComplianceItemUpdate = Partial<
  Omit<ComplianceItem, 'id' | 'property_id' | 'program_id' | 'org_id' | 'created_at' | 'updated_at'>
>

export type ComplianceEventUpdate = Partial<
  Omit<ComplianceEvent, 'id' | 'property_id' | 'org_id' | 'created_at' | 'updated_at'>
>

export type ComplianceViolationUpdate = Partial<
  Omit<ComplianceViolation, 'id' | 'property_id' | 'org_id' | 'created_at' | 'updated_at'>
>

export type ExternalSyncStateUpdate = Partial<
  Omit<ExternalSyncState, 'id' | 'org_id' | 'source' | 'created_at' | 'updated_at'>
>

// ============================================================================
// QUERY RESULT TYPES (with relationships)
// ============================================================================

export interface ComplianceItemWithRelations extends ComplianceItem {
  program?: ComplianceProgram
  asset?: ComplianceAsset
  property?: {
    id: string
    name: string
    address_line1: string
    borough: string | null
    bin: string | null
  }
  work_orders?: ComplianceItemWorkOrder[]
  events?: ComplianceEvent[]
  violations?: ComplianceViolation[]
}

export interface ComplianceAssetWithRelations extends ComplianceAsset {
  property?: {
    id: string
    name: string
    address_line1: string
    borough: string | null
    bin: string | null
  }
  items?: ComplianceItem[]
  events?: ComplianceEvent[]
  violations?: ComplianceViolation[]
}

export interface ComplianceViolationWithRelations extends ComplianceViolation {
  property?: {
    id: string
    name: string
    address_line1: string
    borough: string | null
  }
  asset?: ComplianceAsset
  linked_item?: ComplianceItem
  linked_work_order?: {
    id: string
    subject: string
    status: string
  }
}

export interface ComplianceEventWithRelations extends ComplianceEvent {
  property?: {
    id: string
    name: string
    address_line1: string
  }
  asset?: ComplianceAsset
  item?: ComplianceItem
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface ComplianceItemFilters {
  property_id?: string
  asset_id?: string
  program_id?: string
  status?: ComplianceItemStatus[]
  jurisdiction?: ComplianceJurisdiction[]
  asset_type?: ComplianceAssetType[]
  due_before?: string // date
  due_after?: string // date
  overdue_only?: boolean
}

export interface ComplianceViolationFilters {
  property_id?: string
  asset_id?: string
  agency?: ComplianceViolationAgency[]
  status?: ComplianceViolationStatus[]
  category?: ComplianceViolationCategory[]
  open_only?: boolean
}

export interface ComplianceAssetFilters {
  property_id?: string
  asset_type?: ComplianceAssetType[]
  active_only?: boolean
}

// ============================================================================
// PORTFOLIO SUMMARY TYPES
// ============================================================================

export interface CompliancePortfolioSummary {
  total_properties: number
  properties_with_assets: number
  total_assets: number
  open_violations: number
  overdue_items: number
  items_due_next_30_days: number
  average_risk_score: number | null
  properties: CompliancePropertySummary[]
}

export interface CompliancePropertySummary {
  property_id: string
  property_name: string
  address_line1: string
  borough: string | null
  bin: string | null
  asset_count: number
  open_violations: number
  overdue_items: number
  items_due_next_30_days: number
  last_elevator_inspection: string | null
  risk_score: number | null
  status_indicator: 'critical' | 'warning' | 'ok'
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ComplianceSyncRequest {
  property_id?: string
  org_id: string
  force?: boolean
}

export interface ComplianceSyncResponse {
  success: boolean
  synced_assets: number
  synced_events: number
  synced_violations: number
  updated_items: number
  errors?: string[]
}

export interface ComplianceItemGenerationRequest {
  property_id?: string
  asset_id?: string
  program_id?: string
  org_id: string
  periods_ahead?: number // default 12 months
}

export interface ComplianceItemGenerationResponse {
  success: boolean
  items_created: number
  items_skipped: number
  errors?: string[]
}

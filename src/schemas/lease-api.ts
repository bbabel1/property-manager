import { z } from 'zod'

// Enums mapped to DB enums
export const RentCycleEnumDb = z.enum([
  'Monthly',
  'Weekly',
  'Every2Weeks',
  'Quarterly',
  'Yearly',
  'Every2Months',
  'Daily',
  'Every6Months',
])

export const LeaseContactRoleEnum = z.enum(['Tenant', 'Cosigner'])
export const LeaseContactStatusEnum = z.enum(['Future', 'Active', 'Past'])

const UUID = z.string().uuid('Must be a valid UUID')
const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/g, 'Must be YYYY-MM-DD')
const Email = z.string().email('Invalid email').transform(v => v.trim().toLowerCase())
const Phone = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/g, 'Invalid phone')
  .transform(v => v.replace(/\s|-/g, ''))

export const LeaseAPIPersonSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: Email.optional(),
  phone: Phone.optional(),
  same_as_unit_address: z.boolean().optional().default(true),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postal_code: z.string().max(32).optional(),
  country: z.string().max(100).optional(),
})

export const LeaseAPIContactSchema = z.object({
  tenant_id: UUID.optional(),
  role: LeaseContactRoleEnum.default('Tenant'),
  status: LeaseContactStatusEnum.default('Active'),
  move_in_date: ISODate.optional(),
  move_out_date: ISODate.optional(),
  notice_given_date: ISODate.optional(),
  is_rent_responsible: z.boolean().optional().default(false),
  email: Email.optional(),
  phone: Phone.optional(),
})

export const LeaseAPIRentScheduleSchema = z.object({
  start_date: ISODate,
  end_date: ISODate.optional(),
  total_amount: z.coerce.number().positive('Amount must be greater than 0'),
  rent_cycle: RentCycleEnumDb.default('Monthly'),
  backdate_charges: z.boolean().optional().default(false),
})

export const LeaseAPIRecurringTransactionSchema = z.object({
  frequency: RentCycleEnumDb.default('Monthly'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  memo: z.string().max(255).optional(),
  start_date: ISODate,
  end_date: ISODate.optional(),
})

export const LeaseAPIDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().max(100).optional(),
  storage_path: z.string().min(1),
  mime_type: z.string().max(128).optional(),
  size_bytes: z.coerce.number().int().nonnegative().optional(),
  is_private: z.boolean().optional().default(true),
})

export const LeaseAPICreateSchema = z
  .object({
    // Either local UUIDs or Buildium IDs must be provided (server will resolve as needed)
    property_id: UUID.optional(),
    unit_id: UUID.optional(),
    buildium_property_id: z.coerce.number().int().positive().optional(),
    buildium_unit_id: z.coerce.number().int().positive().optional(),

    // Lease details
    lease_from_date: ISODate,
    lease_to_date: ISODate.optional(),
    lease_type: z.string().optional(),
    payment_due_day: z.coerce.number().int().min(1).max(31).optional(),
    security_deposit: z.coerce.number().min(0, 'Security deposit cannot be negative').optional(),
    rent_amount: z.coerce.number().positive('Rent must be greater than 0').optional(),
    prorated_first_month_rent: z.coerce.number().min(0).optional(),
    prorated_last_month_rent: z.coerce.number().min(0).optional(),
    renewal_offer_status: z.string().optional(),
    status: z.string().optional(),
    // Optional Buildium convenience fields
    current_number_of_occupants: z.coerce.number().int().min(0).optional(),
    is_eviction_pending: z.coerce.boolean().optional(),
    automatically_move_out_tenants: z.coerce.boolean().optional(),

    // Associations
    contacts: z.array(LeaseAPIContactSchema).default([]),
    new_people: z.array(LeaseAPIPersonSchema).default([]),
    rent_schedules: z.array(LeaseAPIRentScheduleSchema).default([]),
    recurring_transactions: z.array(LeaseAPIRecurringTransactionSchema).default([]),
    documents: z.array(LeaseAPIDocumentSchema).default([]),

    // Controls
    syncBuildium: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Require property and unit via either local or Buildium fields
    const hasProperty = Boolean(data.property_id || data.buildium_property_id)
    const hasUnit = Boolean(data.unit_id || data.buildium_unit_id)
    if (!hasProperty) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'property_id or buildium_property_id is required', path: ['property_id'] })
    if (!hasUnit) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unit_id or buildium_unit_id is required', path: ['unit_id'] })

    // Dates: from <= to (if to provided)
    if (data.lease_to_date && data.lease_from_date > data.lease_to_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'lease_to_date must be on or after lease_from_date', path: ['lease_to_date'] })
    }

    // Contacts: at least one rent-responsible Tenant
    const tenants = (data.contacts || []).filter(c => (c.role ?? 'Tenant') === 'Tenant')
    const hasRentResponsible = tenants.some(c => Boolean(c.is_rent_responsible))
    if (!hasRentResponsible) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one rent-responsible tenant is required', path: ['contacts'] })
    }

    // Contacts: dedupe by tenant_id or normalized email/phone
    const seenTenant = new Set<string>()
    const seenIdentity = new Set<string>()
    for (let i = 0; i < (data.contacts || []).length; i++) {
      const c = data.contacts[i]
      if (c.tenant_id) {
        if (seenTenant.has(c.tenant_id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate tenant in contacts', path: ['contacts', i, 'tenant_id'] })
        }
        seenTenant.add(c.tenant_id)
      } else {
        const key = `${c.email || ''}|${c.phone || ''}`
        if (key !== '|' && seenIdentity.has(key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate contact (email/phone)', path: ['contacts', i] })
        }
        if (key !== '|') seenIdentity.add(key)
      }
    }

    // Schedules: amounts positive and dates within the lease term (if term provided)
    for (let i = 0; i < (data.rent_schedules || []).length; i++) {
      const s = data.rent_schedules[i]
      if (s.end_date && s.end_date < s.start_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_date must be on or after start_date', path: ['rent_schedules', i, 'end_date'] })
      }
      if (data.lease_from_date && s.start_date < data.lease_from_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'schedule start_date before lease term', path: ['rent_schedules', i, 'start_date'] })
      }
      if (data.lease_to_date && s.end_date && s.end_date > data.lease_to_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'schedule end_date after lease term', path: ['rent_schedules', i, 'end_date'] })
      }
    }

    for (let i = 0; i < (data.recurring_transactions || []).length; i++) {
      const r = data.recurring_transactions[i]
      if (r.end_date && r.end_date < r.start_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'end_date must be on or after start_date', path: ['recurring_transactions', i, 'end_date'] })
      }
      // If start==end, must be OneTime frequency
      if (r.end_date && r.end_date === r.start_date && r.frequency !== 'OneTime') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'One-day transactions must use frequency OneTime', path: ['recurring_transactions', i, 'frequency'] })
      }
      if (data.lease_from_date && r.start_date < data.lease_from_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'transaction start_date before lease term', path: ['recurring_transactions', i, 'start_date'] })
      }
      if (data.lease_to_date && r.end_date && r.end_date > data.lease_to_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'transaction end_date after lease term', path: ['recurring_transactions', i, 'end_date'] })
      }
    }
  })

export type LeaseAPICreateInput = z.infer<typeof LeaseAPICreateSchema>

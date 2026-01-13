// deno-lint-ignore-file
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"
import { SUPPORTED_EVENT_NAMES, canonicalizeEventName } from "./eventValidation.ts"

const SUPPORTED_EVENT_TYPE_SET = new Set<string>(SUPPORTED_EVENT_NAMES as unknown as string[])
const identifierSchema = z.union([z.string().min(1), z.number()])
const dateValueSchema = z.union([z.string().min(1), z.number()])

function isValidDate(val: unknown): boolean {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const ts = val < 1_000_000_000_000 ? val * 1000 : val
    return !Number.isNaN(new Date(ts).getTime())
  }
  if (typeof val === 'string' && val.trim().length) {
    const parsed = new Date(val)
    return !Number.isNaN(parsed.getTime())
  }
  return false
}

export function deriveEventType(evt: Record<string, unknown>): string {
  const value =
    (evt as any)?.EventType ||
    (evt as any)?.EventName ||
    (evt as any)?.eventType ||
    (evt as any)?.type ||
    (evt as any)?.Data?.EventType ||
    (evt as any)?.Data?.EventName ||
    ''
  if (typeof value !== 'string' || !value.trim().length) return ''
  return canonicalizeEventName(value)
}

function eventHasTimestamp(evt: Record<string, unknown>): boolean {
  const candidates = [
    (evt as any)?.EventDate,
    (evt as any)?.EventDateTime,
    (evt as any)?.eventDateTime,
    (evt as any)?.EventTimestamp,
    (evt as any)?.Timestamp,
    (evt as any)?.Data?.EventDate,
    (evt as any)?.Data?.EventDateTime,
  ]
  return candidates.some(isValidDate)
}

const buildiumWebhookEventBaseSchema = z.object({
  Id: identifierSchema.optional(),
  EventId: identifierSchema.optional(),
  EventType: z.string().min(1).optional(),
  EventName: z.string().min(1).optional(),
  EventDate: dateValueSchema.optional(),
  EventDateTime: dateValueSchema.optional(),
  EntityId: identifierSchema.optional(),
  LeaseId: z.number().optional(),
  TransactionType: z.string().optional(),
  TransactionId: z.number().optional(),
  BillId: z.number().optional(),
  BillIds: z.array(z.number()).optional(),
  PaymentId: z.number().optional(),
  GLAccountId: z.number().optional(),
  PropertyId: z.number().optional(),
  UnitId: z.number().optional(),
  TaskId: z.number().optional(),
  TaskCategoryId: z.number().optional(),
  VendorId: z.number().optional(),
  VendorCategoryId: z.number().optional(),
  WorkOrderId: z.number().optional(),
  RentalOwnerId: z.number().optional(),
  TenantId: z.number().optional(),
  AccountId: z.number().optional(),
  BankAccountId: z.number().optional(),
  // Explicit key schema to satisfy Zod v4 typings while remaining valid in v3
  Data: z.record(z.string(), z.unknown()).optional(),
})

function refineBuildiumWebhookEvent(event: z.infer<typeof buildiumWebhookEventBaseSchema>, ctx: z.RefinementCtx): void {
  const primaryId =
    event.Id ??
    event.EventId ??
    event.TransactionId ??
    event.LeaseId ??
    event.BillId ??
    event.PaymentId ??
    (Array.isArray(event.BillIds) && event.BillIds.length ? event.BillIds[0] : null) ??
    event.PropertyId ??
    event.UnitId ??
    event.GLAccountId ??
    event.TaskId ??
    event.TaskCategoryId ??
    event.VendorId ??
    event.VendorCategoryId ??
    event.WorkOrderId ??
    event.RentalOwnerId ??
    event.BankAccountId ??
    event.AccountId ??
    event.EntityId ??
    (event as any)?.Data?.TransactionId ??
    (event as any)?.Data?.BillId ??
    (Array.isArray((event as any)?.Data?.BillIds) && (event as any)?.Data?.BillIds.length ? (event as any)?.Data?.BillIds[0] : null) ??
    (event as any)?.Data?.PropertyId ??
    (event as any)?.Data?.UnitId ??
    (event as any)?.Data?.GLAccountId ??
    (event as any)?.Data?.TaskId ??
    (event as any)?.Data?.TaskCategoryId ??
    (event as any)?.Data?.VendorId ??
    (event as any)?.Data?.VendorCategoryId ??
    (event as any)?.Data?.WorkOrderId ??
    (event as any)?.Data?.RentalOwnerId ??
    (event as any)?.Data?.BankAccountId ??
    (event as any)?.Data?.AccountId ??
    (event as any)?.Data?.Id
  if (primaryId == null || primaryId === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'missing event identifier (Id/EventId/TransactionId/LeaseId/EntityId)',
    })
  }

  const eventType = deriveEventType(event as Record<string, unknown>)
  if (!eventType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'missing EventType/EventName' })
  } else if (!SUPPORTED_EVENT_TYPE_SET.has(eventType)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unsupported EventType ${eventType}` })
  }

  if (!eventHasTimestamp(event as Record<string, unknown>)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'missing or invalid EventDate/EventDateTime' })
  }
}

export const BuildiumWebhookEventSchema = buildiumWebhookEventBaseSchema.superRefine(refineBuildiumWebhookEvent)

export const BuildiumWebhookPayloadSchema = z
  .object({
    Events: z.array(BuildiumWebhookEventSchema).min(1, 'Events array must contain at least one entry'),
  })
  .strict()

export const LeaseTransactionsWebhookPayloadSchema = BuildiumWebhookPayloadSchema.extend({
  credentials: z
    .object({
      baseUrl: z.string().url().optional(),
      clientId: z.string().min(1).optional(),
      clientSecret: z.string().min(1).optional(),
    })
    .partial()
    .optional(),
}).strict()

export function validateWebhookPayload<T>(payload: unknown, schema: z.ZodSchema<T>) {
  const parsed = schema.safeParse(payload)
  if (parsed.success) return { ok: true as const, data: parsed.data }
  const errors = parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
  return { ok: false as const, errors }
}

export type BuildiumWebhookEvent = z.infer<typeof BuildiumWebhookEventSchema>
export type BuildiumWebhookPayload = z.infer<typeof BuildiumWebhookPayloadSchema>
export type LeaseTransactionsWebhookPayload = z.infer<typeof LeaseTransactionsWebhookPayloadSchema>

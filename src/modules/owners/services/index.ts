import { createServiceClientGetter, ensureFound, validateWithSchema } from '@/modules/shared/supabase-service'

// Owners domain services. Currently owner data access flows through property-service helpers.
export const getOwnersServiceClient = createServiceClientGetter('owners')
export { ensureFound, validateWithSchema }

export * from '@/lib/property-service'

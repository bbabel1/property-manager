import { createServiceClientGetter, ensureFound, validateWithSchema } from '@/modules/shared/supabase-service'

export const getLeasesServiceClient = createServiceClientGetter('leases')
export { ensureFound, validateWithSchema }

export * from '@/lib/lease-transaction-service'
export * from '@/lib/lease-transaction-helpers';

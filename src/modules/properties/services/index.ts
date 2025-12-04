import { createServiceClientGetter, ensureFound, validateWithSchema } from '@/modules/shared/supabase-service'

export const getPropertiesServiceClient = createServiceClientGetter('properties')
export { ensureFound, validateWithSchema }

export * from '@/lib/property-service'

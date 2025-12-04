import { createServiceClientGetter, ensureFound, validateWithSchema } from '@/modules/shared/supabase-service'

export const getUnitsServiceClient = createServiceClientGetter('units')
export { ensureFound, validateWithSchema }

export * from '@/lib/unit-service'

import { createServiceClientGetter, ensureFound, validateWithSchema } from '@/modules/shared/supabase-service'

export const getStaffServiceClient = createServiceClientGetter('staff')
export { ensureFound, validateWithSchema }

export * from '@/lib/staff-role'

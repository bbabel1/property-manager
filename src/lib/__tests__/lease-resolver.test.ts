import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveLeaseWithOrg } from '../../../supabase/functions/_shared/leaseResolver'

type StubResponse<T> = { data: T | null; error: { code?: string } | null }
type LeaseRowStub = { id: number; org_id: string | null; property_id: string | null }
type PropertyRowStub = { org_id: string | null }
type StubRow = LeaseRowStub | PropertyRowStub
type SupabaseTestClient = SupabaseClient & {
  calls: Array<{ table: string; column: string; value: number | string }>
}

function createSupabaseStub(queue: StubResponse<StubRow>[]): SupabaseTestClient {
  const calls: Array<{ table: string; column: string; value: number | string }> = []
  const stub = {
    calls,
    from(table: string) {
      return {
        select() {
          return this
        },
        eq(column: string, value: number | string) {
          calls.push({ table, column, value })
          const response = queue.shift() ?? { data: null, error: { code: 'PGRST116' } }
          return {
            async single() {
              return response
            },
          }
        },
      }
    },
  }
  return stub as unknown as SupabaseTestClient
}

describe('resolveLeaseWithOrg', () => {
  it('returns lease org when present', async () => {
    const supabase = createSupabaseStub([
      { data: { id: 1, org_id: 'org-1', property_id: 'prop-1' }, error: null },
    ])

    const result = await resolveLeaseWithOrg(supabase, 123)
    expect(result).toEqual({ id: 1, org_id: 'org-1' })
    expect(supabase.calls).toEqual([{ table: 'lease', column: 'buildium_lease_id', value: 123 }])
  })

  it('falls back to property org when lease org is null', async () => {
    const supabase = createSupabaseStub([
      { data: { id: 2, org_id: null, property_id: 'prop-99' }, error: null },
      { data: { org_id: 'org-prop' }, error: null },
    ])

    const result = await resolveLeaseWithOrg(supabase, 456)
    expect(result).toEqual({ id: 2, org_id: 'org-prop' })
    expect(supabase.calls).toEqual([
      { table: 'lease', column: 'buildium_lease_id', value: 456 },
      { table: 'properties', column: 'id', value: 'prop-99' },
    ])
  })

  it('returns null when lease is missing', async () => {
    const supabase = createSupabaseStub([{ data: null, error: { code: 'PGRST116' } }])
    const result = await resolveLeaseWithOrg(supabase, 789)
    expect(result).toBeNull()
    expect(supabase.calls).toEqual([{ table: 'lease', column: 'buildium_lease_id', value: 789 }])
  })
})

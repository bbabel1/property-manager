import { describe, expect, it } from 'vitest'
import { resolveLeaseWithOrg } from '../../../supabase/functions/_shared/leaseResolver'

type StubResponse<T> = { data: T | null; error: { code?: string } | null }

function createSupabaseStub(queue: StubResponse<any>[]) {
  return {
    calls: [] as Array<{ table: string; column: string; value: any }>,
    from(table: string) {
      const ctx = this
      return {
        select() {
          return this
        },
        eq(column: string, value: any) {
          ctx.calls.push({ table, column, value })
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

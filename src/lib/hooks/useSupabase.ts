import { useState, useEffect } from 'react'
import type { Database } from '@/types/database'
import { supabase } from '@/lib/db'

type TableName = keyof Database['public']['Tables'] & string
type TableRow<Table extends TableName> = Database['public']['Tables'][Table]['Row']
type TableInsert<Table extends TableName> = Database['public']['Tables'][Table]['Insert']
type TableUpdate<Table extends TableName> = Database['public']['Tables'][Table]['Update']
type TableFilters<Table extends TableName> = Partial<
  Record<keyof TableRow<Table> & string, TableRow<Table>[keyof TableRow<Table>]>
>

export function useSupabaseQuery<Table extends TableName>(
  table: Table,
  query?: {
    select?: string
    filters?: TableFilters<Table>
    orderBy?: { column: keyof TableRow<Table> & string; ascending?: boolean }
    limit?: number
  }
) {
  const [data, setData] = useState<TableRow<Table>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      try {
        setLoading(true)
        const client = supabase as unknown as { from: (table: string) => any }
        let queryBuilder = client.from(table).select(query?.select ?? '*')

        if (query?.filters) {
          Object.entries(query.filters).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key as string, value as TableRow<Table>[keyof TableRow<Table>])
          })
        }

        if (query?.orderBy) {
          queryBuilder = queryBuilder.order(query.orderBy.column as string, {
            ascending: query.orderBy.ascending ?? true,
          })
        }

        if (query?.limit) {
          queryBuilder = queryBuilder.limit(query.limit)
        }

        const { data, error } = await queryBuilder

        if (!isMounted) return

        if (error) {
          setError(error.message)
        } else {
          setData((data as unknown as TableRow<Table>[] | null) ?? [])
        }
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [table, query?.filters, query?.limit, query?.orderBy, query?.select])

  return { data, loading, error }
}

export function useSupabaseMutation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insert = async <Table extends TableName>(table: Table, data: Partial<TableInsert<Table>>) => {
    setLoading(true)
    setError(null)

    try {
      const client = supabase as unknown as { from: (table: string) => any }
      const { data: result, error } = await client.from(table).insert([data]).select()

      if (error) {
        setError(error.message)
        return null
      }

      return (result?.[0] as TableRow<Table> | undefined) ?? null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const update = async <Table extends TableName>(
    table: Table,
    id: string | number,
    data: Partial<TableUpdate<Table>>,
  ) => {
    setLoading(true)
    setError(null)

    try {
      const client = supabase as unknown as { from: (table: string) => any }
      const { data: result, error } = await client
        .from(table)
        .update(data)
        .eq('id' as any, id as any)
        .select()

      if (error) {
        setError(error.message)
        return null
      }

      return (result?.[0] as TableRow<Table> | undefined) ?? null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const remove = async <Table extends TableName>(table: Table, id: string | number) => {
    setLoading(true)
    setError(null)

    try {
      const client = supabase as unknown as { from: (table: string) => any }
      const { error } = await client.from(table).delete().eq('id' as any, id as any)

      if (error) {
        setError(error.message)
        return false
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }

  return { insert, update, remove, loading, error }
}

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useSupabaseQuery<T>(
  table: string,
  query?: {
    select?: string
    filters?: Record<string, any>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        let queryBuilder = supabase.from(table).select(query?.select || '*')

        // Apply filters
        if (query?.filters) {
          Object.entries(query.filters).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value)
          })
        }

        // Apply ordering
        if (query?.orderBy) {
          queryBuilder = queryBuilder.order(query.orderBy.column, {
            ascending: query.orderBy.ascending ?? true
          })
        }

        // Apply limit
        if (query?.limit) {
          queryBuilder = queryBuilder.limit(query.limit)
        }

        const { data, error } = await queryBuilder

        if (error) {
          setError(error.message)
        } else {
          setData(data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [table, JSON.stringify(query)])

  return { data, loading, error }
}

export function useSupabaseMutation<T>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insert = async (table: string, data: Partial<T>) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert([data])
        .select()

      if (error) {
        setError(error.message)
        return null
      }

      return result?.[0] || null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const update = async (table: string, id: string | number, data: Partial<T>) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()

      if (error) {
        setError(error.message)
        return null
      }

      return result?.[0] || null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const remove = async (table: string, id: string | number) => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

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

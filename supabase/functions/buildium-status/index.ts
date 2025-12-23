// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Main handler
serve(async (req) => {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { method } = req
    const url = new URL(req.url)
    const { searchParams } = url

    if (method === 'GET') {
      const entityType = searchParams.get('entityType')
      const entityId = searchParams.get('entityId')

      if (entityId) {
        // Get sync status for specific entity
        const { data: syncStatus, error } = await supabase
          .from('buildium_sync_status')
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .single()

        if (error) {
          return new Response(
            JSON.stringify({ syncStatus: null }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }

        return new Response(
          JSON.stringify({ syncStatus }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      } else {
        // Get all failed syncs
        let query = supabase
          .from('buildium_sync_status')
          .select('*')
          .eq('sync_status', 'failed')

        if (entityType) {
          query = query.eq('entity_type', entityType)
        }

        const { data: failedSyncs, error } = await query

        if (error) {
          return new Response(
            JSON.stringify({ failedSyncs: [] }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }

        return new Response(
          JSON.stringify({ failedSyncs: failedSyncs || [] }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    if (method === 'POST') {
      const body = await req.json()
      const { entityType } = body

      // Get failed syncs
      let query = supabase
        .from('buildium_sync_status')
        .select('*')
        .eq('sync_status', 'failed')

      if (entityType) {
        query = query.eq('entity_type', entityType)
      }

      const { data: failedSyncs, error } = await query

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch failed syncs' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      const results = []
      const errors = []
      let retried = 0

      // For each failed sync, we would typically retry the sync operation
      // For now, we'll just mark them as pending for retry
      for (const sync of failedSyncs || []) {
        try {
          // Update sync status to pending for retry
          await supabase.rpc('update_buildium_sync_status', {
            p_entity_type: sync.entity_type,
            p_entity_id: sync.entity_id,
            p_buildium_id: sync.buildium_id,
            p_status: 'pending',
            p_error_message: null
          })

          retried++
          results.push({ entityId: sync.entity_id, success: true })
        } catch (error) {
          const errorMessage = error.message || 'Unknown error'
          errors.push(`Failed to retry sync for ${sync.entity_type}/${sync.entity_id}: ${errorMessage}`)
          results.push({ entityId: sync.entity_id, success: false, error: errorMessage })
        }
      }

      return new Response(
        JSON.stringify({
          success: retried > 0,
          retried,
          errors,
          results
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not supported' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )

  } catch (error) {
    console.error('Error in buildium-status function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Content-Type': 'application/json' 
        },
        status: 500,
      }
    )
  }
})

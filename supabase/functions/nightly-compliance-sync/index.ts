import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:3000'
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify cron secret if provided
    const providedSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (cronSecret && providedSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Get all active organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)

    if (orgsError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch organizations', details: orgsError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const results: Array<{ orgId: string; success: boolean; synced: number; errors?: string[] }> = []

    // Sync compliance for each org
    for (const org of orgs || []) {
      try {
        // Get properties with BIN for this org
        const { data: properties, error: propertiesError } = await supabase
          .from('properties')
          .select('id')
          .eq('org_id', org.id)
          .not('bin', 'is', null)

        if (propertiesError) {
          results.push({ orgId: org.id, success: false, synced: 0, errors: [propertiesError.message] })
          continue
        }

        // Sync each property
        let syncedCount = 0
        const errors: string[] = []

        for (const property of properties || []) {
          try {
            const url = new URL(`${appBaseUrl}/api/compliance/sync`)
            const res = await fetch(url.toString(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': cronSecret,
              },
              body: JSON.stringify({
                property_id: property.id,
                org_id: org.id,
                force: false,
              }),
            })

            if (res.ok) {
              syncedCount++
            } else {
              const errorData = await res.json().catch(() => ({}))
              errors.push(`Property ${property.id}: ${errorData.error || res.statusText}`)
            }
          } catch (error) {
            errors.push(`Property ${property.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        results.push({
          orgId: org.id,
          success: errors.length === 0,
          synced: syncedCount,
          errors: errors.length > 0 ? errors : undefined,
        })
      } catch (error) {
        results.push({
          orgId: org.id,
          success: false,
          synced: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        })
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
    const totalErrors = results.filter((r) => !r.success).length

    return new Response(
      JSON.stringify({
        success: totalErrors === 0,
        total_orgs: orgs?.length || 0,
        total_synced: totalSynced,
        total_errors: totalErrors,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})


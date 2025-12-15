import { supabaseAdmin } from '@/lib/db'

async function main() {
  const propertyId = 'ecc0e44d-7e1d-4918-b2f8-f0846b5c989e'

  const deriveStatus = (meta?: Record<string, any> | null) => {
    if (!meta) return undefined
    const raw =
      (meta.device_status as string | null | undefined) ||
      (meta.status as string | null | undefined) ||
      (meta.report_status as string | null | undefined) ||
      (meta.compliance_status as string | null | undefined) ||
      (meta.current_status as string | null | undefined) ||
      (meta.filing_status as string | null | undefined)
    return typeof raw === 'string' ? raw : undefined
  }

  const normalizeStatus = (value?: string) =>
    value?.trim().toLowerCase().replace(/[\s-]+/g, '_') || undefined

  const retiredStatuses = new Set([
    'retired',
    'removed',
    'inactive',
    'out_of_service',
    'removed_from_service',
    'decommissioned',
  ])

  const { data, error } = await supabaseAdmin
    .from('compliance_assets')
    .select('id, external_source, external_source_id, active, metadata')
    .eq('property_id', propertyId)
    .eq('asset_type', 'elevator')

  if (error) {
    console.error('Failed to fetch inactive elevators:', error)
    process.exit(1)
  }

  const candidates = (data || [])
    .map((row: any) => {
      const status = normalizeStatus(deriveStatus(row.metadata))
      const shouldDelete = row.active === false || (status && retiredStatuses.has(status))
      return {
        id: row.id as string | undefined,
        external_source_id: row.external_source_id as string | null | undefined,
        status,
        active: row.active as boolean | null | undefined,
        shouldDelete,
      }
    })
    .filter((row) => row.id)

  const toDelete = candidates.filter((row) => row.shouldDelete).map((row) => row.id!) // already filtered

  console.log(
    `Found ${toDelete.length} elevator assets to delete (matching inactive flag or retired/removed status).`
  )
  if (!toDelete.length) {
    console.log(
      'Nothing to delete. Current statuses:',
      candidates.map((row) => ({
        id: row.id,
        external_source_id: row.external_source_id,
        status: row.status,
        active: row.active,
      }))
    )
    return
  }

  const { error: deleteError } = await supabaseAdmin.from('compliance_assets').delete().in('id', toDelete)
  if (deleteError) {
    console.error('Failed to delete inactive elevators:', deleteError)
    process.exit(1)
  }

  console.log('Deleted inactive elevator assets:', toDelete)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

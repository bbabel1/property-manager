import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

type FilingRow = {
  id: string
  inspection_date: string | null
  filed_date: string | null
  compliance_status: string | null
  inspection_type: string | null
  control_number: string | null
  defects: boolean
  raw: Record<string, any>
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const OPEN_DATA_BASE = (process.env.NYC_OPEN_DATA_BASE_URL || 'https://data.cityofnewyork.us/').replace(/\/$/, '') + '/'
const APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN || process.env.NYC_OPEN_DATA_API_KEY || ''

// Target property/org and dataset
const ORG_ID = '1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3'
const PROPERTY_ID = 'ecc0e44d-7e1d-4918-b2f8-f0846b5c989e'
const DATASET_FILINGS = 'e5aq-a4j2'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function normDate(val: any): string | null {
  if (!val) return null
  const s = String(val).trim()
  const m = s.match(/\d{4}-\d{2}-\d{2}/) || s.match(/\d{2}\/\d{2}\/\d{4}/)
  if (!m) return null
  const t = m[0]
  if (t.includes('/')) {
    const [mm, dd, yy] = t.split('/')
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return t
}

async function fetchFilingsByDevice(deviceNumber: string): Promise<FilingRow[]> {
  const url = new URL(`resource/${DATASET_FILINGS}.json`, OPEN_DATA_BASE)
  url.searchParams.set('device_number', deviceNumber)
  url.searchParams.set('$limit', '5000')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (APP_TOKEN) headers['X-App-Token'] = APP_TOKEN
  const res = await fetch(url.toString(), { headers })
  const text = await res.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Parse error for device ${deviceNumber}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for device ${deviceNumber}: ${text.slice(0, 200)}`)
  }
  const rows = Array.isArray(json) ? json : []
  return rows.map((row: any) => {
    const raw = row as Record<string, any>
    const inspection_date =
      normDate(raw.inspection_date) ||
      normDate(raw.cat1_latest_report_filed) ||
      normDate(raw.periodic_latest_inspection) ||
      normDate(raw.cat5_latest_report_filed) ||
      normDate(raw.status_date)
    const filed_date = normDate(raw.filed_date) || normDate(raw.control_date)
    const status = raw.compliance_status || raw.device_status || raw.status || null
    const control = raw.control_number || raw.tracking_number || null
    const defects =
      Boolean(raw.defects_flag) ||
      (raw.defects && String(raw.defects).toLowerCase() !== 'no') ||
      false
    return {
      id: raw.id || crypto.randomUUID(),
      inspection_date,
      filed_date,
      compliance_status: status,
      inspection_type: raw.inspection_type || raw.periodic_report_year || raw.cat1_report_year || raw.cat5_report_year || null,
      control_number: control,
      defects,
      raw,
    }
  })
}

async function main() {
  // Fetch devices for property/org
  const { data: assets, error: assetErr } = await supabase
    .from('compliance_assets')
    .select('id, external_source_id, metadata')
    .eq('property_id', PROPERTY_ID)
    .eq('org_id', ORG_ID)
  if (assetErr) throw assetErr
  const deviceNumbers = (assets || [])
    .map((a) => a.external_source_id)
    .filter((d): d is string => Boolean(d))

  const filings: FilingRow[] = []
  for (const device of deviceNumbers) {
    const rows = await fetchFilingsByDevice(device)
    filings.push(
      ...rows.map((r) => ({
        ...r,
        raw: { ...r.raw, device_number: device },
      }))
    )
  }

  if (!filings.length) {
    console.log('No filings fetched.')
    return
  }

  const trackingNumbers = filings
    .map((f) => f.control_number)
    .filter((t): t is string => Boolean(t))

  // Delete existing events with same tracking numbers for this org to avoid conflicts
  if (trackingNumbers.length) {
    await supabase
      .from('compliance_events')
      .delete()
      .eq('org_id', ORG_ID)
      .in('external_tracking_number', trackingNumbers)
  }

  const rows = filings.map((f) => {
    // Map asset by device number
    const assetId =
      (assets || []).find((a) => a.external_source_id === (f.raw.device_number || f.raw.device_id || f.raw.deviceid))?.id || null
    return {
      org_id: ORG_ID,
      property_id: PROPERTY_ID,
      asset_id: assetId,
      event_type: 'inspection',
      inspection_type: f.inspection_type,
      inspection_date: f.inspection_date,
      filed_date: f.filed_date,
      compliance_status: f.compliance_status,
      defects: f.defects,
      external_tracking_number: f.control_number || f.id,
      raw_source: f.raw,
    }
  })

  const { error: insertErr } = await supabase.from('compliance_events').insert(rows)
  if (insertErr) throw insertErr

  // Update asset metadata with the key DOB NOW summary fields for easy access in UI
  const summaryFields = [
    'periodic_report_year',
    'cat1_report_year',
    'cat1_latest_report_filed',
    'cat5_latest_report_filed',
    'periodic_latest_inspection',
  ]
  for (const asset of assets || []) {
    const deviceNumber = asset.external_source_id
    if (!deviceNumber) continue
    const filing = filings.find((f) => f.raw.device_number === deviceNumber)
    if (!filing) continue
    const metaUpdates: Record<string, any> = {}
    for (const key of summaryFields) {
      const val = (filing.raw as any)[key]
      if (val !== undefined) metaUpdates[key] = val
    }
    if (Object.keys(metaUpdates).length === 0) continue
    const nextMeta = { ...(asset.metadata || {}), ...metaUpdates }
    await supabase
      .from('compliance_assets')
      .update({ metadata: nextMeta })
      .eq('id', asset.id)
      .eq('org_id', ORG_ID)
  }

  console.log(`Inserted ${rows.length} filings for ${deviceNumbers.length} devices.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

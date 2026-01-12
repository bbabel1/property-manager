import { config } from 'dotenv'
import { logger } from '../../utils/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

config({ path: '.env.local' })

const leaseId = process.argv[2] || '16235'

async function fetchLeaseFromBuildium(orgId: string, leaseId: string) {
  const res = await buildiumFetch('GET', `/leases/${leaseId}`, undefined, undefined, orgId)
  if (!res.ok || !res.json) {
    const details = res.errorText || res.json
    throw new Error(`Buildium API error: ${res.status} ${res.statusText} ${details ? `- ${details}` : ''}`)
  }
  logger.info(`Successfully fetched lease ${leaseId} from Buildium`)
  return res.json as Record<string, any>
}

async function main() {
  try {
    const { orgId } = await ensureBuildiumEnabledForScript()
    logger.info(`Fetching lease ${leaseId} from Buildium...`)
    const lease = await fetchLeaseFromBuildium(orgId, leaseId)
    
    console.log('\nKey lease fields:')
    console.log('ID:', lease.Id)
    console.log('Property ID:', lease.PropertyId)
    console.log('Unit ID:', lease.UnitId)
    console.log('Start Date:', lease.StartDate)
    console.log('End Date:', lease.EndDate)
    console.log('Status:', lease.Status)
    console.log('Rent Amount:', lease.RentAmount)
    console.log('Security Deposit:', lease.SecurityDepositAmount)
    
    console.log('\nAll lease fields:')
    Object.keys(lease || {}).forEach(key => {
      console.log(`${key}:`, (lease as any)[key])
    })
    
  } catch (error) {
    logger.error('Failed to fetch lease')
    console.error('Error details:', error)
    process.exit(1)
  }
}

main()

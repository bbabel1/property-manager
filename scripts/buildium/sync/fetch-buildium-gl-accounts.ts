 
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

async function main() {
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
  console.log('TODO: implement Buildium GL accounts fetch; guard added to block when disabled.')
}

main().catch((err) => {
  console.error('Failed to run fetch-buildium-gl-accounts placeholder:', err)
  process.exit(1)
})

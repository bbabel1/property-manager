 
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

async function main() {
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
  console.log('TODO: implement Buildium properties listing; guard added to block when disabled.')
}

main().catch((err) => {
  console.error('Failed to run list-buildium-properties placeholder:', err)
  process.exit(1)
})

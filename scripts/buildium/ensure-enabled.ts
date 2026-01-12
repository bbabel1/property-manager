import { getOrgScopedBuildiumConfig } from '@/lib/buildium/credentials-manager';

/**
 * Ensure Buildium integration is enabled for scripts before making outbound calls.
 * Resolves orgId from argument, DEFAULT_ORG_ID, or process argv.
 * Exits process with code 1 if disabled or missing.
 */
export async function ensureBuildiumEnabledForScript(
  orgIdInput?: string | null,
): Promise<{ orgId: string }> {
  const orgId = orgIdInput ?? process.env.DEFAULT_ORG_ID ?? process.argv[2];

  if (!orgId) {
    console.error('Buildium script requires an orgId (pass as argv[2] or set DEFAULT_ORG_ID).');
    process.exit(1);
  }

  const config = await getOrgScopedBuildiumConfig(orgId);
  if (!config || !config.isEnabled) {
    console.error(`Buildium integration is disabled for org ${orgId}`);
    process.exit(1);
  }

  return { orgId };
}

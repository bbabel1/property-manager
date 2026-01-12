'use client';

import { useAuth } from '@/components/providers';
import type { AppRole } from '@/lib/auth/roles';

export function BillAdminNotes() {
  const { user } = useAuth();
  const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const claims = (appMeta?.claims ?? {}) as Record<string, unknown>;
  const roles =
    ((claims as { roles?: AppRole[] })?.roles ??
      (appMeta as { roles?: AppRole[] })?.roles ??
      []) || [];

  const isAdmin = roles.includes('platform_admin') || roles.includes('org_admin');

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="mt-8 space-y-2 border-t border-border/60 pt-6">
      <p className="text-muted-foreground text-xs">
        <strong className="text-foreground">Admin note:</strong> The following features are currently
        hidden as they are unfinished:
      </p>
      <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
        <li>Approval Workflow</li>
        <li>Vendor Credits</li>
      </ul>
    </div>
  );
}

